'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabase';
import ReceiptModal from '../components/ReceiptModal';

interface BillRecord {
  id: string;
  bill_number: string;
  bill_name: string | null;
  subtotal: number;
  total_amount: number;
  discount_amount: number;
  status: string;
  opened_at: string | null;
  created_by_user_id: string | null;
}

interface BillItemDetail {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isStaffDrink?: boolean;
}

interface PaymentInfo {
  payment_method: string;
  amount: number;
  received_amount: number;
  change_amount: number;
  payment_note: string | null;
  paid_at: string | null;
}

export default function AllBillsPage() {
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const [bills, setBills] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cashierName, setCashierName] = useState<string>('แคชเชียร์');

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'credit' | 'active' | 'cancelled'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'day' | 'month' | 'all'>('all');

  const todayISO = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const currentMonthISO = useMemo(() => todayISO.slice(0, 7), [todayISO]);

  const [selectedDay, setSelectedDay] = useState<string>(todayISO);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'swipe' | 'grid'>('swipe');

  // Receipt / Reprint Modal States
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);
  const [modalItems, setModalItems] = useState<BillItemDetail[]>([]);
  const [modalPayment, setModalPayment] = useState<PaymentInfo | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [loadingBillDetail, setLoadingBillDetail] = useState<boolean>(false);

  // ดึงข้อมูลแคชเชียร์ปัจจุบัน
  useEffect(() => {
    const fetchCashier = async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCashierName(data.user.display_name || data.user.name || 'พนักงาน');
        }
      } catch {
        setCashierName('ระบบแคชเชียร์');
      }
    };
    fetchCashier();
  }, []);

  // ดึงรายการบิลทั้งหมดจาก Supabase
  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching all bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // รายการปีที่มีในบิลทั้งหมดสำหรับตัวกรองปี
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    bills.forEach((b) => {
      if (b.opened_at) {
        const d = new Date(b.opened_at);
        if (!Number.isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [bills]);

  // แยกชื่อลูกค้าออกจาก bill_name (เช่น "Block Block 6 - จินตหรา" -> "จินตหรา")
  const extractCustomerName = (billName?: string | null) => {
    if (!billName) return 'ไม่ระบุชื่อลูกค้า';
    const parts = billName.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ').trim() : billName.trim();
  };

  const extractBlockLabel = (billName?: string | null) => {
    if (!billName) return '-';
    const parts = billName.split(' - ');
    return parts[0]?.replace(/^Block\s+/i, '').trim() || '-';
  };

  // ฟอร์แมตวันเวลาแบบ DD/MM/YYYY HH:mm
  const formatThaiDateTime = (isoStr?: string | null, onlyDate = false) => {
    if (!isoStr) return '-';
    const parsed = new Date(isoStr);
    if (Number.isNaN(parsed.getTime())) return isoStr;

    const datePart = parsed.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    if (onlyDate) return datePart;

    const timePart = parsed.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} ${timePart}`;
  };

  // กรองบิลตาม วัน/เดือน/ปี, สถานะ และคำค้นหา (เลขที่บิล / ชื่อลูกค้า)
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      const customer = extractCustomerName(bill.bill_name).toLowerCase();
      const billNo = (bill.bill_number || '').toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch = !q || billNo.includes(q) || customer.includes(q);
      const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;

      let matchesDate = true;
      if (bill.opened_at) {
        const d = new Date(bill.opened_at);
        if (!Number.isNaN(d.getTime())) {
          const yyyy = String(d.getFullYear());
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const localDay = `${yyyy}-${mm}-${dd}`;
          const localMonth = `${yyyy}-${mm}`;

          if (dateFilterMode === 'day' && selectedDay) {
            matchesDate = localDay === selectedDay;
          } else if (dateFilterMode === 'month' && selectedMonth) {
            matchesDate = localMonth === selectedMonth;
          }

          if (matchesDate && selectedYear !== 'all') {
            matchesDate = yyyy === selectedYear;
          }
        }
      } else if (dateFilterMode !== 'all' || selectedYear !== 'all') {
        matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bills, searchQuery, statusFilter, dateFilterMode, selectedDay, selectedMonth, selectedYear]);

  // สรุปยอดจากบิลที่กรองได้
  const summaryStats = useMemo(() => {
    const totalCount = filteredBills.length;
    const paidBills = filteredBills.filter((b) => b.status === 'paid');
    const creditBills = filteredBills.filter((b) => b.status === 'credit');
    const paidSales = paidBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    const creditSales = creditBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    return {
      totalCount,
      paidCount: paidBills.length,
      creditCount: creditBills.length,
      paidSales,
      creditSales,
    };
  }, [filteredBills]);

  // เปิดดูรายละเอียดบิล + โหลดรายการสินค้าและข้อมูลการชำระเงินเพื่อแสดงใน ReceiptModal
  const handleOpenBillReceipt = async (bill: BillRecord) => {
    try {
      setSelectedBill(bill);
      setModalItems([]);
      setModalPayment(null);
      setLoadingBillDetail(true);
      setIsReceiptOpen(true);

      const [{ data: itemsData }, { data: paymentData }] = await Promise.all([
        supabase
          .from('bill_items')
          .select('id, product_name, unit_price, qty, is_staff_drink')
          .eq('bill_id', bill.id),
        supabase
          .from('payments')
          .select('payment_method, amount, received_amount, change_amount, payment_note, paid_at')
          .eq('bill_id', bill.id)
          .order('paid_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const formattedItems: BillItemDetail[] = (itemsData || []).map((row: any) => ({
        id: row.id,
        name: row.product_name,
        price: Number(row.unit_price || 0),
        quantity: Number(row.qty || 0),
        isStaffDrink: Boolean(row.is_staff_drink),
      }));

      setModalItems(formattedItems);
      setModalPayment(paymentData || null);
    } catch (err) {
      console.error('Error loading bill receipt detail:', err);
    } finally {
      setLoadingBillDetail(false);
    }
  };

  // เลื่อนแถวปัดบิลซ้าย/ขวาด้วยปุ่ม
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const amount = direction === 'left' ? -360 : 360;
    carouselRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const renderStatusBadge = (status: string) => {

    if (status === 'cancelled') {
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
            ✕ ยกเลิกบิล
          </span>
        );
      }

    if (status === 'paid') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          ✓ ชำระแล้ว
        </span>
      );
    }

    if (status === 'credit') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
          ⏳ เครดิต
        </span>
      );
    }
    
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-sky-500/15 text-sky-300 border border-sky-500/30">
        ● กำลังเปิดบิล
      </span>
    );
  };

  const modalTotalQty = modalItems.reduce((sum, i) => sum + i.quantity, 0);
  const modalTotalAmount =
    selectedBill && Number(selectedBill.total_amount) > 0
      ? Number(selectedBill.total_amount)
      : modalItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/pos')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition cursor-pointer"
            >
              ← หน้า POS
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight">
                🧾 รายการบิลทั้งหมด (Bills History)
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                ค้นหาย้อนหลัง เลือกดูบิลรายวันแบบปัดสไลด์ และเปิดรีปริ้นใบเสร็จได้ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('swipe')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                viewMode === 'swipe'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚡ โหมดปัดดูทีละบิล
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ▦ โหมดตารางการ์ด
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs text-slate-400 font-semibold">จำนวนบิลที่พบ</p>
            <p className="text-2xl font-black text-slate-100 mt-1">{summaryStats.totalCount} บิล</p>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs text-emerald-400 font-semibold">ยอดชำระแล้ว ({summaryStats.paidCount} บิล)</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              ฿{summaryStats.paidSales.toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs text-amber-300 font-semibold">ยอดค้างเครดิต ({summaryStats.creditCount} บิล)</p>
            <p className="text-2xl font-black text-amber-300 mt-1">
              ฿{summaryStats.creditSales.toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <p className="text-xs text-slate-400 font-semibold">ทางลัดดูบิลวันนี้</p>
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('day');
                setSelectedDay(todayISO);
                setViewMode('swipe');
              }}
              className="mt-2 py-2 px-3 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded-xl text-xs font-black transition cursor-pointer text-center"
            >
              📅 ดูบิลของวันนี้ ({formatThaiDateTime(new Date().toISOString(), true)})
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search เลขที่บิล / ชื่อลูกค้า */}
            <div className="md:col-span-5">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                ค้นหาเลขที่บิล หรือ ชื่อลูกค้า
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="พิมพ์เลขที่บิล เช่น 02-22112026 หรือชื่อลูกค้า..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
            </div>

            {/* โหมดกรองวัน/เดือน/ทั้งหมด */}
            <div className="md:col-span-3">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                ช่วงเวลา
              </label>
              <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDateFilterMode('all')}
                  className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    dateFilterMode === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('day')}
                  className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    dateFilterMode === 'day' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  รายวัน
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('month')}
                  className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    dateFilterMode === 'month' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  รายเดือน
                </button>
              </div>
            </div>

            {/* ตัวเลือก วัน หรือ เดือน */}
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                {dateFilterMode === 'month' ? 'เลือกเดือน' : 'เลือกวันที่'}
              </label>
              {dateFilterMode === 'month' ? (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-slate-100 outline-none"
                />
              ) : (
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setDateFilterMode('day');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-slate-100 outline-none"
                />
              )}
            </div>

            {/* ตัวเลือกปี */}
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                ปี (ค.ศ.)
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-slate-100 outline-none"
              >
                <option value="all">ทุกปี</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* แถบกรองสถานะบิล */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'ทุกสถานะ' },
                { key: 'paid', label: 'ชำระแล้ว (Paid)' },
                { key: 'credit', label: 'เครดิต (Credit)' },
                { key: 'active', label: 'กำลังเปิดบิล (Active)' },
                { key: 'cancelled', label: 'ยกเลิกบิล (Cancelled)' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDateFilterMode('all');
                setSelectedYear('all');
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
            >
              ↺ ล้างตัวกรองทั้งหมด
            </button>
          </div>
        </div>

        {/* Bills Display Area */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-400 font-bold">
            กำลังโหลดรายการบิลจากฐานข้อมูล...
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center space-y-2">
            <p className="text-lg font-black text-slate-300">ไม่พบบิลตามเงื่อนไขที่เลือก</p>
            <p className="text-xs text-slate-500">ลองเปลี่ยนวันที่/เดือน หรือล้างคำค้นหาดูอีกครั้งครับ</p>
          </div>
        ) : viewMode === 'swipe' ? (
          /* โหมดปัดเลื่อนดูบิลทีละใบ (Swipeable Snap Deck) */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-amber-400">
                  👉 ปัดเลื่อนดูบิลทีละใบ ({filteredBills.length} บิล)
                </h2>
                <p className="text-xs text-slate-400">
                  ลากหรือปัดซ้าย-ขวาบนมือถือ/ทัชแพด หรือกดปุ่มลูกศร เพื่อดูบิลเรียงลำดับทีละใบ แล้วกดเปิดใบเสร็จเพื่อรีปริ้น
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-black flex items-center justify-center cursor-pointer border border-slate-700"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-black flex items-center justify-center cursor-pointer border border-slate-700"
                >
                  →
                </button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scroll-smooth"
            >
              {filteredBills.map((bill, idx) => (
                <div
                  key={bill.id}
                  onClick={() => handleOpenBillReceipt(bill)}
                  className="snap-start shrink-0 w-80 sm:w-96 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-6 flex flex-col justify-between transition cursor-pointer shadow-lg group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                        #{idx + 1} • {extractBlockLabel(bill.bill_name)}
                      </span>
                      {renderStatusBadge(bill.status)}
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-400">เลขที่บิล</p>
                      <p className="text-lg font-mono font-black text-amber-400 group-hover:text-amber-300">
                        {bill.bill_number}
                      </p>
                    </div>

                    <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800/80 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">ลูกค้า:</span>
                        <strong className="text-slate-100">{extractCustomerName(bill.bill_name)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">วัน-เวลาเปิด:</span>
                        <span className="font-mono text-slate-300">
                          {formatThaiDateTime(bill.opened_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">ยอดรวมสุทธิ</p>
                      <p className="text-2xl font-black text-amber-400">
                        ฿{Number(bill.total_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <span className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs group-hover:bg-amber-400 transition">
                      🖨️ ดูใบเสร็จ / รีปริ้น
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* โหมดกริดการ์ดทั้งหมด */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => handleOpenBillReceipt(bill)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 flex flex-col justify-between transition cursor-pointer shadow-lg"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-amber-400">
                      {bill.bill_number}
                    </span>
                    {renderStatusBadge(bill.status)}
                  </div>
                  <p className="text-base font-bold text-slate-100">
                    ลูกค้า: {extractCustomerName(bill.bill_name)}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    เปิดบิล: {formatThaiDateTime(bill.opened_at)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xl font-black text-amber-400">
                    ฿{Number(bill.total_amount || 0).toLocaleString()}
                  </span>
                  <span className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                    🖨️ รีปริ้นใบเสร็จ
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal ใบเสร็จสำหรับดูย้อนหลังและกดรีปริ้น */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        cashierName={cashierName}
        billNo={selectedBill?.bill_number || '-'}
        customerName={extractCustomerName(selectedBill?.bill_name)}
        openTime={formatThaiDateTime(selectedBill?.opened_at)}
        checkoutTime={
          loadingBillDetail
            ? 'กำลังโหลด...'
            : formatThaiDateTime(modalPayment?.paid_at || new Date().toISOString())
        }
        items={modalItems}
        totalQuantity={modalTotalQty}
        totalAmount={modalTotalAmount}
        paymentMethod={modalPayment?.payment_method || 'cash'}
        cashReceived={
          modalPayment?.received_amount ? String(modalPayment.received_amount) : ''
        }
        changeAmount={Number(modalPayment?.change_amount || 0)}
        transferNote={modalPayment?.payment_note || ''}
      />
    </div>
  );
}