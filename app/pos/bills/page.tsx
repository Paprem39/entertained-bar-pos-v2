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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  // Cancel Bill Modal States
  const [billToCancel, setBillToCancel] = useState<BillRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Settle Credit Bill Modal States (รับชำระบิลเครดิต: เงินสด หรือ โอนจ่าย -> ยอดเข้าวันที่จ่ายจริง)
  const [creditBillToPay, setCreditBillToPay] = useState<BillRecord | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'transfer'>('cash');
  const [settleCashReceived, setSettleCashReceived] = useState<string>('');
  const [settleTransferNote, setSettleTransferNote] = useState<string>('');
  const [settleError, setSettleError] = useState<string | null>(null);
  const [isSettlingCredit, setIsSettlingCredit] = useState<boolean>(false);

  // ดึงข้อมูลแคชเชียร์ปัจจุบัน
  useEffect(() => {
    const fetchCashier = async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCashierName(data.user.display_name || data.user.name || 'พนักงาน');
          setCurrentUserId(data.user.id || null);
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

  // เปิด Modal รับชำระบิลเครดิต
  const handleOpenSettleCreditModal = (bill: BillRecord) => {
    setCreditBillToPay(bill);
    setSettleMethod('cash');
    setSettleCashReceived(String(Number(bill.total_amount || 0)));
    setSettleTransferNote('');
    setSettleError(null);
  };

  const settleBillAmount = Number(creditBillToPay?.total_amount || 0);
  const settleCashNum = parseFloat(settleCashReceived) || 0;
  const settleChangeAmount = Math.max(0, settleCashNum - settleBillAmount);

  // ยืนยันรับชำระบิลเครดิต: บันทึก payments ด้วย paid_at วันนี้ (ยอดเข้าวันที่จ่ายจริง) และเปลี่ยนสถานะบิลเป็น 'paid'
  const handleConfirmSettleCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditBillToPay) return;
    setSettleError(null);

    if (settleMethod === 'cash' && settleCashNum < settleBillAmount) {
      setSettleError('จำนวนเงินสดที่รับมาน้อยกว่ายอดค้างชำระครับ');
      return;
    }

    try {
      setIsSettlingCredit(true);
      const paidAtIso = new Date().toISOString();

      // 1. บันทึกการรับชำระลง payments ตามวันที่ลูกค้ามาจ่ายจริง (paid_at = วันนี้)
      const { error: payErr } = await supabase.from('payments').insert({
        bill_id: creditBillToPay.id,
        payment_method: settleMethod,
        amount: settleBillAmount,
        received_amount: settleMethod === 'cash' ? settleCashNum : settleBillAmount,
        change_amount: settleMethod === 'cash' ? settleChangeAmount : 0,
        payment_note:
          settleMethod === 'transfer'
            ? settleTransferNote.trim() || 'รับชำระบิลเครดิต (โอนจ่าย)'
            : 'รับชำระบิลเครดิต (เงินสด)',
        paid_at: paidAtIso,
        received_by_user_id: currentUserId,
      });

      if (payErr) throw payErr;

      // 2. เปลี่ยนสถานะบิลเป็น 'paid' (ชำระเงินแล้ว)
      const { error: billErr } = await supabase
        .from('bills')
        .update({ status: 'paid' })
        .eq('id', creditBillToPay.id);

      if (billErr) throw billErr;

      setBills((prev) =>
        prev.map((b) => (b.id === creditBillToPay.id ? { ...b, status: 'paid' } : b))
      );
      if (selectedBill?.id === creditBillToPay.id) {
        setSelectedBill((prev) => (prev ? { ...prev, status: 'paid' } : prev));
      }

      setCreditBillToPay(null);
      setSettleCashReceived('');
      setSettleTransferNote('');
    } catch (err: any) {
      console.error('Error settling credit bill:', err);
      setSettleError(`เกิดข้อผิดพลาดในการรับชำระ: ${err?.message || 'โปรดลองอีกครั้ง'}`);
    } finally {
      setIsSettlingCredit(false);
    }
  };

  // ยืนยันยกเลิกบิล: คืนสต็อกกลับเข้า stocks.current_qty และเปลี่ยนสถานะบิลเป็น 'cancelled'
  const handleConfirmCancelBill = async () => {
    if (!billToCancel) return;

    try {
      setIsCancelling(true);

      const { data: latestBill, error: fetchLatestErr } = await supabase
        .from('bills')
        .select('id, status, bill_number')
        .eq('id', billToCancel.id)
        .single();

      if (fetchLatestErr) throw fetchLatestErr;
      if (!latestBill || latestBill.status === 'cancelled') {
        setBillToCancel(null);
        await fetchBills();
        return;
      }

      const { data: billItemsRows, error: itemsErr } = await supabase
        .from('bill_items')
        .select('product_id, qty')
        .eq('bill_id', latestBill.id);

      if (itemsErr) throw itemsErr;

      const returnMap = new Map<string, number>();
      (billItemsRows || []).forEach((row: any) => {
        const qtyNum = Number(row.qty || 0);
        if (row.product_id && qtyNum > 0) {
          returnMap.set(row.product_id, (returnMap.get(row.product_id) || 0) + qtyNum);
        }
      });

      const nowIso = new Date().toISOString();
      for (const [productId, addQty] of returnMap.entries()) {
        const { data: stockRow, error: stockFetchErr } = await supabase
          .from('stocks')
          .select('id, current_qty')
          .eq('product_id', productId)
          .maybeSingle();

        if (stockFetchErr) {
          console.error('Stock fetch error:', stockFetchErr, { productId });
          continue;
        }

        if (!stockRow) {
          console.warn('No stock row found for product_id:', productId);
          continue;
        }

        const currentQty = Number(stockRow.current_qty ?? 0);
        const { error: stockUpdateErr } = await supabase
          .from('stocks')
          .update({
            current_qty: currentQty + addQty,
            last_adjusted_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', stockRow.id);

        if (stockUpdateErr) {
          console.error('Stock update error:', stockUpdateErr, { productId, stockRow });
        }
      }

      const { error: updateBillErr } = await supabase
        .from('bills')
        .update({ status: 'cancelled' })
        .eq('id', latestBill.id);

      if (updateBillErr) throw updateBillErr;

      setBills((prev) =>
        prev.map((b) => (b.id === latestBill.id ? { ...b, status: 'cancelled' } : b))
      );
      if (selectedBill?.id === latestBill.id) {
        setSelectedBill((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      }

      setBillToCancel(null);
    } catch (err) {
      console.error('Error cancelling bill:', err);
      alert('เกิดข้อผิดพลาดในการยกเลิกบิล กรุณาลองใหม่อีกครั้งครับ');
    } finally {
      setIsCancelling(false);
    }
  };

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
          ✓ ชำระเงินแล้ว
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
                ค้นหาย้อนหลัง รับชำระบิลเครดิต (เงินสด/โอน) และเปิดรีปริ้นใบเสร็จได้ทันที
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-amber-400">
                  👉 ปัดเลื่อนดูบิลทีละใบ ({filteredBills.length} บิล)
                </h2>
                <p className="text-xs text-slate-400">
                  ลากหรือปัดซ้าย-ขวาบนมือถือ/ทัชแพด หรือกดปุ่มลูกศร เพื่อดูบิลเรียงลำดับทีละใบ แล้วกดรับชำระหรือรีปริ้น
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

                  <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">ยอดรวมสุทธิ</span>
                      <p className="text-2xl font-black text-amber-400">
                        ฿{Number(bill.total_amount || 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {bill.status === 'credit' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSettleCreditModal(bill);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
                        >
                          💳 รับชำระ
                        </button>
                      )}
                      {bill.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBillToCancel(bill);
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs transition cursor-pointer"
                        >
                          ✕ ยกเลิกบิล
                        </button>
                      )}
                      <span className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs group-hover:bg-amber-400 transition">
                        🖨️ รีปริ้น
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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

                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">ยอดสุทธิ</span>
                    <span className="text-xl font-black text-amber-400">
                      ฿{Number(bill.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {bill.status === 'credit' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSettleCreditModal(bill);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
                      >
                        💳 รับชำระ
                      </button>
                    )}
                    {bill.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBillToCancel(bill);
                        }}
                        className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs transition cursor-pointer"
                      >
                        ✕ ยกเลิกบิล
                      </button>
                    )}
                    <span className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                      🖨️ รีปริ้นใบเสร็จ
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal รับชำระบิลเครดิต (เลือก เงินสด หรือ โอนจ่าย -> ยอดเข้าวันที่ชำระจริง) */}
      {creditBillToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmSettleCredit}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xl font-black text-emerald-400">💳 รับชำระบิลเครดิต</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  บิล {creditBillToPay.bill_number} • {extractCustomerName(creditBillToPay.bill_name)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreditBillToPay(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">ยอดค้างชำระสุทธิ</span>
              <span className="text-2xl font-black text-amber-400 font-mono">
                ฿{settleBillAmount.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                เลือกช่องทางรับชำระวันนี้ (ยอดจะบันทึกเข้าวันที่จ่ายจริง)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSettleMethod('cash');
                    setSettleError(null);
                  }}
                  className={`py-3 rounded-xl text-xs font-black border transition cursor-pointer ${
                    settleMethod === 'cash'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  💵 เงินสด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettleMethod('transfer');
                    setSettleError(null);
                  }}
                  className={`py-3 rounded-xl text-xs font-black border transition cursor-pointer ${
                    settleMethod === 'transfer'
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  📲 โอนจ่าย
                </button>
              </div>
            </div>

            {settleMethod === 'cash' ? (
              <div className="space-y-3 bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1">
                    รับเงินสดมา (บาท)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settleCashReceived}
                    onChange={(e) => setSettleCashReceived(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white outline-none"
                    required
                  />
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400">เงินทอน:</span>
                  <span className="text-base font-mono font-black text-emerald-400">
                    ฿{settleChangeAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5">
                <label className="block text-xs text-sky-300 font-bold">
                  หมายเหตุการโอน / เลขสลิป (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={settleTransferNote}
                  onChange={(e) => setSettleTransferNote(e.target.value)}
                  placeholder="เช่น โอน KBank วันนี้ / สลิป 1234..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                />
              </div>
            )}

            {settleError && (
              <p className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                {settleError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSettlingCredit}
                onClick={() => setCreditBillToPay(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSettlingCredit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 font-black text-sm transition cursor-pointer"
              >
                {isSettlingCredit ? 'กำลังบันทึก...' : '✓ ยืนยันรับชำระ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal ยืนยันการยกเลิกบิล */}
      {billToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto text-2xl font-black">
              ✕
            </div>
            <h3 className="text-xl font-black text-slate-100">ยืนยันการยกเลิกบิล?</h3>
            <p className="text-sm text-slate-300">
              ต้องการยกเลิกบิล{' '}
              <span className="font-mono font-bold text-amber-400">
                {billToCancel.bill_number}
              </span>{' '}
              (ยอด{' '}
              <strong className="text-amber-400">
                ฿{Number(billToCancel.total_amount || 0).toLocaleString()}
              </strong>
              ) ใช่หรือไม่?
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-400 text-left space-y-1">
              <p>• บิลจะถูกเปลี่ยนเป็นสถานะ <strong className="text-rose-400">ยกเลิกบิล</strong> และไม่รวมในยอดขาย</p>
              <p>• ระบบจะคืนสต็อกสินค้าในบิลนี้กลับเข้าที่เดิม</p>
              <p>• บิลยังคงอยู่ในประวัติให้ดู/รีปริ้นเป็นหลักฐานได้ เพื่อเปิดบิลใหม่คีย์รายการถูกต้อง</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setBillToCancel(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
              >
                ปิดไว้ก่อน
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancelBill}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-black text-sm transition cursor-pointer"
              >
                {isCancelling ? 'กำลังยกเลิก...' : '✓ ยืนยันยกเลิกบิล'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        paymentMethod={modalPayment?.payment_method || (selectedBill?.status === 'credit' ? 'credit' : 'cash')}
        cashReceived={
          modalPayment?.received_amount ? String(modalPayment.received_amount) : ''
        }
        changeAmount={Number(modalPayment?.change_amount || 0)}
        transferNote={modalPayment?.payment_note || ''}
      />
    </div>
  );
}