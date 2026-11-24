'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';

interface StaffMenuItem {
  id: string;
  name: string;
  normal_price: number;
  tournament_price: number;
  category: string;
  stockQty: number;
  minStock: number;
}

interface StaffDrinkRecord {
  id: string;
  productName: string;
  qty: number;
  drinkFee: number;
  lineTotal: number;
  recipientName: string;
  billNumber: string;
  customerName: string;
  openedAt: string | null;
  billStatus: string;
}

interface ActiveBlockInfo {
  id: number;
  name: string;
  status: string;
  customer: string;
  bill_code: string;
  time: string;
}

interface ActiveBillDetail {
  billNumber: string;
  customerName: string;
  openedAt: string | null;
  totalAmount: number;
  items: {
    id: string;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
}

export default function StaffPortalPage() {
  const router = useRouter();

  const todayISO = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const currentMonthISO = useMemo(() => todayISO.slice(0, 7), [todayISO]);

  // Active Tab: 'menu' | 'drinks' | 'blocks'
  const [activeTab, setActiveTab] = useState<'menu' | 'drinks' | 'blocks'>('menu');

  // Staff Session Info
  const [staffName, setStaffName] = useState<string>('กำลังโหลด...');
  const [staffUserId, setStaffUserId] = useState<string | null>(null);

  // Tab 1: Menu + Stock + Customer QR Modal
  const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['ทั้งหมด']);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [publicMenuUrl, setPublicMenuUrl] = useState<string>('');

  // Tab 2: My Staff Drinks & Income
  const [drinkRecords, setDrinkRecords] = useState<StaffDrinkRecord[]>([]);
  const [loadingDrinks, setLoadingDrinks] = useState<boolean>(true);
  const [drinkFilterMode, setDrinkFilterMode] = useState<'day' | 'range' | 'month' | 'year' | 'all'>('day');
  const [drinkSelectedDay, setDrinkSelectedDay] = useState<string>(todayISO);
  const [drinkStartDate, setDrinkStartDate] = useState<string>(todayISO);
  const [drinkEndDate, setDrinkEndDate] = useState<string>(todayISO);
  const [drinkSelectedMonth, setDrinkSelectedMonth] = useState<string>(currentMonthISO);
  const [drinkSelectedYear, setDrinkSelectedYear] = useState<string>(todayISO.slice(0, 4));

  // Tab 3: Read-only Active Block Bills
  const [activeBlocks, setActiveBlocks] = useState<ActiveBlockInfo[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState<boolean>(true);
  const [selectedBlockDetail, setSelectedBlockDetail] = useState<ActiveBillDetail | null>(null);
  const [loadingBlockDetail, setLoadingBlockDetail] = useState<boolean>(false);

  // ตั้งค่า URL สำหรับหน้า QR เมนูลูกค้า
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPublicMenuUrl(`${window.location.origin}/menu`);
    }
  }, []);

  // 1. ดึงข้อมูลพนักงานที่ล็อกอินอยู่
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setStaffName(data.user.display_name || data.user.name || 'พนักงาน');
          setStaffUserId(data.user.id || null);
        } else {
          router.push('/');
        }
      } catch {
        setStaffName('พนักงาน');
      }
    };
    fetchSession();
  }, [router]);

  // 2. โหลดข้อมูลเมนู + สต็อกคงเหลือ (สำหรับ Staff)
  const fetchStaffMenu = async () => {
    try {
      setLoadingMenu(true);
      const [{ data: catData }, { data: prodData }] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('products')
          .select(`
            id,
            name,
            normal_price,
            tournament_price,
            category_id,
            categories ( name ),
            stocks ( current_qty, minimum_qty )
          `)
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      const catMap: Record<string, string> = {};
      (catData || []).forEach((c: any) => {
        catMap[c.id] = c.name;
      });
      setCategories(['ทั้งหมด', ...(catData || []).map((c: any) => c.name)]);

      const formatted: StaffMenuItem[] = (prodData || []).map((p: any) => {
        const stockObj = Array.isArray(p.stocks) ? p.stocks[0] : p.stocks;
        return {
          id: p.id,
          name: p.name,
          normal_price: Number(p.normal_price || 0),
          tournament_price: Number(p.tournament_price ?? p.normal_price ?? 0),
          category: p.categories?.name || catMap[p.category_id] || 'อื่นๆ',
          stockQty: Number(stockObj?.current_qty ?? 0),
          minStock: Number(stockObj?.minimum_qty ?? 5),
        };
      });

      setMenuItems(formatted);
    } catch (err) {
      console.error('Error loading staff menu:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  // 3. โหลดรายการดื่มของพนักงานคนนี้ (กรองเฉพาะบิลที่ status !== 'cancelled' เสมอ)
  const fetchMyDrinks = async (currentName: string) => {
    if (!currentName || currentName === 'กำลังโหลด...') return;
    try {
      setLoadingDrinks(true);
      const { data, error } = await supabase
        .from('bill_items')
        .select(`
          id,
          product_name,
          qty,
          staff_drink_fee,
          line_total,
          is_staff_drink,
          staff_drink_recipient,
          bills!inner (
            id,
            bill_number,
            bill_name,
            status,
            opened_at
          )
        `)
        .eq('is_staff_drink', true)
        .neq('bills.status', 'cancelled');

      if (error) throw error;

      const normalizedSelf = currentName.trim().toLowerCase();

      const mine: StaffDrinkRecord[] = (data || [])
        .filter((row: any) => {
          const recipient = String(row.staff_drink_recipient || '').trim().toLowerCase();
          return recipient === normalizedSelf || recipient.includes(normalizedSelf);
        })
        .map((row: any) => {
          const billObj = Array.isArray(row.bills) ? row.bills[0] : row.bills;
          const rawBillName = String(billObj?.bill_name || '');
          const parts = rawBillName.split(' - ');
          const customer = parts.length > 1 ? parts.slice(1).join(' - ').trim() : rawBillName || 'ไม่ระบุลูกค้า';

          return {
            id: row.id,
            productName: row.product_name,
            qty: Number(row.qty || 0),
            drinkFee: Number(row.staff_drink_fee || 0),
            lineTotal: Number(row.line_total || 0),
            recipientName: row.staff_drink_recipient || currentName,
            billNumber: billObj?.bill_number || '-',
            customerName: customer,
            openedAt: billObj?.opened_at || null,
            billStatus: billObj?.status || 'active',
          };
        })
        .sort((a, b) => {
          const ta = a.openedAt ? new Date(a.openedAt).getTime() : 0;
          const tb = b.openedAt ? new Date(b.openedAt).getTime() : 0;
          return tb - ta;
        });

      setDrinkRecords(mine);
    } catch (err) {
      console.error('Error loading staff drinks:', err);
    } finally {
      setLoadingDrinks(false);
    }
  };

  // 4. โหลด Block ที่กำลังเปิดบิลอยู่ (Read-only)
  const fetchOpenBlocks = async () => {
    try {
      setLoadingBlocks(true);
      const { data, error } = await supabase
        .from('pos_blocks')
        .select('id, name, status, customer, bill_code, time')
        .neq('status', 'available')
        .order('id', { ascending: true });

      if (error) throw error;
      setActiveBlocks(data || []);
    } catch (err) {
      console.error('Error loading active blocks:', err);
    } finally {
      setLoadingBlocks(false);
    }
  };

  useEffect(() => {
    fetchStaffMenu();
    fetchOpenBlocks();
  }, []);

  useEffect(() => {
    if (staffName && staffName !== 'กำลังโหลด...') {
      fetchMyDrinks(staffName);
    }
  }, [staffName]);

  // เปิดดูรายละเอียดรายการอาหาร/เครื่องดื่มในบิลที่เปิดอยู่ (ดูอย่างเดียว แก้ไขไม่ได้)
  const handleInspectBlockBill = async (block: ActiveBlockInfo) => {
    if (!block.bill_code) return;
    try {
      setLoadingBlockDetail(true);
      const { data: billData, error: billErr } = await supabase
        .from('bills')
        .select('id, bill_number, bill_name, opened_at, total_amount')
        .eq('bill_number', block.bill_code)
        .single();

      if (billErr || !billData) {
        setLoadingBlockDetail(false);
        return;
      }

      const { data: itemsData } = await supabase
        .from('bill_items')
        .select('id, product_name, qty, unit_price, line_total')
        .eq('bill_id', billData.id);

      const mappedItems = (itemsData || []).map((it: any) => ({
        id: it.id,
        name: it.product_name,
        qty: Number(it.qty || 0),
        unitPrice: Number(it.unit_price || 0),
        lineTotal: Number(it.line_total || 0),
      }));

      const calcTotal = mappedItems.reduce((sum, i) => sum + i.lineTotal, 0);

      setSelectedBlockDetail({
        billNumber: billData.bill_number,
        customerName: block.customer || 'ไม่ระบุชื่อลูกค้า',
        openedAt: billData.opened_at,
        totalAmount: Number(billData.total_amount) > 0 ? Number(billData.total_amount) : calcTotal,
        items: mappedItems,
      });
    } catch (err) {
      console.error('Error inspecting block bill:', err);
    } finally {
      setLoadingBlockDetail(false);
    }
  };

  // Filter รายการเมนู
  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menuItems.filter((m) => {
      const matchCat = selectedCategory === 'ทั้งหมด' || m.category === selectedCategory;
      const matchSearch = !q || m.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCategory, menuSearch]);

  // แปลง openedAt เป็น YYYY-MM-DD ตามเวลาท้องถิ่น
  const getLocalDateISO = (isoStr?: string | null): string | null => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const availableDrinkYears = useMemo(() => {
    const yrs = new Set<string>([todayISO.slice(0, 4)]);
    drinkRecords.forEach((r) => {
      const iso = getLocalDateISO(r.openedAt);
      if (iso) yrs.add(iso.slice(0, 4));
    });
    return Array.from(yrs).sort((a, b) => Number(b) - Number(a));
  }, [drinkRecords, todayISO]);

  // Filter รายได้ยอดดื่มของฉันตาม วัน / ช่วงวันที่ / เดือน / ปี
  const filteredDrinks = useMemo(() => {
    return drinkRecords.filter((rec) => {
      const localDate = getLocalDateISO(rec.openedAt);
      if (!localDate) return drinkFilterMode === 'all';

      if (drinkFilterMode === 'day') {
        return localDate === drinkSelectedDay;
      }
      if (drinkFilterMode === 'range') {
        if (drinkStartDate && localDate < drinkStartDate) return false;
        if (drinkEndDate && localDate > drinkEndDate) return false;
        return true;
      }
      if (drinkFilterMode === 'month') {
        return localDate.startsWith(drinkSelectedMonth);
      }
      if (drinkFilterMode === 'year') {
        return localDate.startsWith(drinkSelectedYear);
      }
      return true;
    });
  }, [
    drinkRecords,
    drinkFilterMode,
    drinkSelectedDay,
    drinkStartDate,
    drinkEndDate,
    drinkSelectedMonth,
    drinkSelectedYear,
  ]);

  const totalDrinkQty = useMemo(
    () => filteredDrinks.reduce((sum, r) => sum + r.qty, 0),
    [filteredDrinks]
  );

  const totalDrinkIncome = useMemo(
    () => filteredDrinks.reduce((sum, r) => sum + r.drinkFee, 0),
    [filteredDrinks]
  );

  const formatThaiDateTime = (isoStr?: string | null) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {
      // ignore
    }
    router.push('/');
  };

  // URL สร้างรูป QR Code ชี้ไปที่ /menu เพื่อให้ลูกค้าสแกนดูเมนู (ซ่อนสต็อก)
  const qrImageSrc = publicMenuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
        publicMenuUrl
      )}`
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 md:pb-10">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                STAFF MODE
              </span>
              <h1 className="text-base sm:text-xl font-black text-amber-400">
                สวัสดี, {staffName}
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ดูเมนูและสต็อก • เช็กยอดดื่มของฉัน • ดูบิลลูกค้าที่เปิดอยู่
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            ออกจากระบบ
          </button>
        </div>

        {/* Desktop / Tablet Tab Bar */}
        <div className="hidden md:grid max-w-5xl mx-auto grid-cols-3 gap-2 mt-4 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'menu' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📋 เมนูสินค้า & สต็อก (พร้อม QR ลูกค้า)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drinks')}
            className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'drinks' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🍹 รายได้ & ยอดดื่มของฉัน
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('blocks');
              fetchOpenBlocks();
            }}
            className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'blocks' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            🧾 เช็กบิลที่เปิดอยู่ ({activeBlocks.length})
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        {/* ==================== TAB 1: เมนู & สต็อก + QR ลูกค้า ==================== */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-amber-400">
                  📋 ใบเมนูรายการสินค้า & สต็อกคงเหลือ
                </h2>
                <p className="text-xs text-slate-400">
                  เช็กจำนวนคงเหลือจริงก่อนรับออเดอร์ หรือให้ลูกค้าสแกน QR เพื่อดูเมนู (ไม่เห็นสต็อก)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer shrink-0"
              >
                📱 เปิด QR เมนูให้ลูกค้าสแกน
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า / เครื่องดื่ม..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none"
              />

              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingMenu ? (
              <div className="py-14 text-center text-slate-400 text-sm font-bold">
                กำลังโหลดรายการสินค้าและสต็อก...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMenu.map((item) => {
                  const isOut = item.stockQty <= 0;
                  const isLow = item.stockQty > 0 && item.stockQty <= item.minStock;
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {item.category}
                          </span>
                          <h3 className="font-bold text-slate-100 text-base mt-1">{item.name}</h3>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
                            isOut
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isOut ? 'หมด (0)' : `เหลือ ${item.stockQty}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <div>
                          <span className="text-slate-400">ปกติ: </span>
                          <strong className="text-amber-400 font-mono text-sm">
                            ฿{item.normal_price.toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">วันแข่ง: </span>
                          <strong className="text-orange-400 font-mono text-sm">
                            ฿{item.tournament_price.toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: รายได้ & ยอดดื่มของฉัน ==================== */}
        {activeTab === 'drinks' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-semibold">จำนวนดื่มที่ได้</p>
                <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono">
                  {totalDrinkQty} <span className="text-sm font-bold text-slate-300">ดื่ม</span>
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-emerald-400 font-semibold">รายได้ค่าดื่มรวม</p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono">
                  ฿{totalDrinkIncome.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Filter Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                {[
                  { key: 'day', label: 'รายวัน' },
                  { key: 'range', label: 'ช่วงวันที่' },
                  { key: 'month', label: 'รายเดือน' },
                  { key: 'year', label: 'รายปี' },
                  { key: 'all', label: 'ทั้งหมด' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDrinkFilterMode(tab.key as any)}
                    className={`py-2 rounded-lg transition cursor-pointer ${
                      drinkFilterMode === tab.key
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {drinkFilterMode === 'day' && (
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1">เลือกวันที่</label>
                  <input
                    type="date"
                    value={drinkSelectedDay}
                    onChange={(e) => setDrinkSelectedDay(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              )}

              {drinkFilterMode === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1">
                      ตั้งแต่วันที่
                    </label>
                    <input
                      type="date"
                      value={drinkStartDate}
                      onChange={(e) => setDrinkStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1">ถึงวันที่</label>
                    <input
                      type="date"
                      value={drinkEndDate}
                      onChange={(e) => setDrinkEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              )}

              {drinkFilterMode === 'month' && (
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1">เลือกเดือน</label>
                  <input
                    type="month"
                    value={drinkSelectedMonth}
                    onChange={(e) => setDrinkSelectedMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              )}

              {drinkFilterMode === 'year' && (
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold mb-1">เลือกปี (ค.ศ.)</label>
                  <select
                    value={drinkSelectedYear}
                    onChange={(e) => setDrinkSelectedYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  >
                    {availableDrinkYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Drink List */}
            {loadingDrinks ? (
              <div className="py-12 text-center text-slate-400 text-sm font-bold">
                กำลังโหลดรายการดื่มของ {staffName}...
              </div>
            ) : filteredDrinks.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center space-y-1">
                <p className="text-sm font-bold text-slate-300">ไม่พบรายการดื่มในช่วงเวลาที่เลือก</p>
                <p className="text-xs text-slate-500">ระบบนับเฉพาะบิลที่ใช้งานจริง (ตัดบิลที่ยกเลิกออกแล้ว)</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredDrinks.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          บิล {rec.billNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-200">
                          ลูกค้า: {rec.customerName}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-100 truncate">{rec.productName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {formatThaiDateTime(rec.openedAt)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-xs font-bold text-amber-300">
                        {rec.qty} ดื่ม
                      </span>
                      <span className="block text-lg font-black text-emerald-400 font-mono">
                        +฿{rec.drinkFee.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: เช็กบิลที่เปิดอยู่ (Read-Only) ==================== */}
        {activeTab === 'blocks' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-amber-400">
                  🧾 บิลลูกค้าที่กำลังเปิดอยู่ (ดูได้อย่างเดียว)
                </h2>
                <p className="text-xs text-slate-400">
                  แตะที่โต๊ะ/บล็อกเพื่อดูรายการที่สั่งและยอดรวมปัจจุบันสำหรับแจ้งลูกค้า
                </p>
              </div>
              <button
                type="button"
                onClick={fetchOpenBlocks}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 cursor-pointer"
              >
                ↻ รีเฟรช
              </button>
            </div>

            {loadingBlocks ? (
              <div className="py-12 text-center text-slate-400 text-sm font-bold">
                กำลังโหลดบิลที่เปิดอยู่...
              </div>
            ) : activeBlocks.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl py-12 text-center text-slate-400 text-sm font-bold">
                ขณะนี้ยังไม่มีโต๊ะ/บล็อกที่เปิดบิลอยู่ครับ
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeBlocks.map((blk) => (
                  <button
                    key={blk.id}
                    type="button"
                    onClick={() => handleInspectBlockBill(blk)}
                    className="text-left bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 space-y-2 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-amber-400">
                        {blk.name || `Block ${blk.id}`}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        ● กำลังเปิดบิล
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-100">
                      ลูกค้า: {blk.customer || 'ไม่ระบุชื่อ'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1 border-t border-slate-800">
                      <span>บิล: {blk.bill_code || '-'}</span>
                      <span className="text-amber-300 font-bold">แตะดูรายการ →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30 grid grid-cols-3">
        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`py-3 flex flex-col items-center gap-1 text-[11px] font-black cursor-pointer ${
            activeTab === 'menu' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <span className="text-base">📋</span>
          <span>เมนู & สต็อก</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('drinks')}
          className={`py-3 flex flex-col items-center gap-1 text-[11px] font-black cursor-pointer ${
            activeTab === 'drinks' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <span className="text-base">🍹</span>
          <span>ยอดดื่มของฉัน</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('blocks');
            fetchOpenBlocks();
          }}
          className={`py-3 flex flex-col items-center gap-1 text-[11px] font-black cursor-pointer ${
            activeTab === 'blocks' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <span className="text-base">🧾</span>
          <span>เช็กบิล ({activeBlocks.length})</span>
        </button>
      </nav>

      {/* Modal แสดง QR Code เมนูให้ลูกค้าสแกน (หน้า /menu ซ่อนสต็อกทั้งหมด) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900">📱 QR รายการเมนู</h3>
            <p className="text-xs text-slate-600">
              แสดงรายการสินค้าและราคาของร้าน (ซ่อนจำนวนสต็อกคงเหลืออัตโนมัติ)
            </p>
            {qrImageSrc && (
              <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border-2 border-slate-200 flex items-center justify-center">
                <img src={qrImageSrc} alt="QR เมนูร้าน" className="w-full h-full object-contain" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition cursor-pointer"
            >
              ปิดหน้าต่าง QR
            </button>
          </div>
        </div>
      )}

      {/* Modal ดูรายละเอียดบิลที่เปิดอยู่ (Read-Only สำหรับ Staff) */}
      {(loadingBlockDetail || selectedBlockDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            {loadingBlockDetail || !selectedBlockDetail ? (
              <div className="py-10 text-center text-slate-300 font-bold text-sm">
                กำลังโหลดรายการในบิล...
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      ดูอย่างเดียว (READ-ONLY)
                    </span>
                    <h3 className="text-lg font-black text-amber-400 mt-1">
                      ลูกค้า: {selectedBlockDetail.customerName}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      บิล {selectedBlockDetail.billNumber} • เปิด {formatThaiDateTime(selectedBlockDetail.openedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBlockDetail(null)}
                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {selectedBlockDetail.items.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">
                      ยังไม่มีรายการสั่งซื้อในบิลนี้
                    </p>
                  ) : (
                    selectedBlockDetail.items.map((it) => (
                      <div
                        key={it.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-100">{it.name}</p>
                          <p className="text-slate-400 font-mono mt-0.5">
                            ฿{it.unitPrice.toLocaleString()} x {it.qty}
                          </p>
                        </div>
                        <span className="font-mono font-black text-amber-400 text-sm">
                          ฿{it.lineTotal.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">ยอดรวมสุทธิปัจจุบัน</span>
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      ฿{selectedBlockDetail.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBlockDetail(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}