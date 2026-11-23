'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabase';

interface ExpenseCategoryRecord {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  is_favorite?: boolean | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

interface ExpenseRecord {
  id: string;
  business_session_id?: string | null;
  expense_category_id?: string | null;
  amount: number;
  note?: string | null;
  paid_to?: string | null;
  expense_date?: string | null;
  created_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ProductOption {
  id: string;
  name: string;
}

const ICON_CHOICES = ['💸', '🏪', '🕯️', '🍱', '🧊', '🍺', '⛽', '💡', '🧾', '📦'];

// แกะข้อมูล [รับเข้าสต็อก: <ชื่อสินค้า> +<จำนวน>] จาก note เพื่อกันสต็อกเบิ้ล/ค้างตอนแก้ไขหรือลบ
function parseLinkedStockFromNote(note?: string | null): {
  productName: string | null;
  qty: number;
  plainNote: string;
} {
  const raw = String(note || '');
  const match = raw.match(/^\[รับเข้าสต็อก:\s*(.+?)\s*\+(\d+)\]\s*(.*)$/);
  if (!match) {
    return { productName: null, qty: 0, plainNote: raw };
  }
  return {
    productName: match[1].trim(),
    qty: Number(match[2] || 0),
    plainNote: (match[3] || '').trim(),
  };
}

export default function StoreExpensesPage() {
  const router = useRouter();

  const todayISO = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const currentMonthISO = useMemo(() => todayISO.slice(0, 7), [todayISO]);

  // Main Data States
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [cashierName, setCashierName] = useState<string>('แคชเชียร์');
  const [cashierId, setCashierId] = useState<string | null>(null);

  // Add Quick Category / Shortcut States
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<string>('💸');
  const [showAddCategoryBox, setShowAddCategoryBox] = useState<boolean>(false);
  const [savingCategory, setSavingCategory] = useState<boolean>(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Add Expense Form States
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(todayISO);
  const [paidTo, setPaidTo] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');

  // Stock Link States (ซื้อของเข้าร้าน -> บวกเพิ่มเข้า stocks.current_qty)
  const [linkStockEnabled, setLinkStockEnabled] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [stockQtyToAdd, setStockQtyToAdd] = useState<string>('');

  // Edit Expense Modal States
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>(todayISO);
  const [editPaidTo, setEditPaidTo] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editStockQty, setEditStockQty] = useState<string>('0');
  const [editLinkedProductName, setEditLinkedProductName] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Delete Expense Modal States
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<boolean>(false);

  // Filter & History States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilterId, setCategoryFilterId] = useState<string>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'day' | 'month' | 'all'>('day');
  const [selectedDay, setSelectedDay] = useState<string>(todayISO);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthISO);
  const [selectedYear, setSelectedYear] = useState<string>('all');

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCashierName(data.user.display_name || data.user.name || 'พนักงาน');
          setCashierId(data.user.id || null);
        }
      } catch {
        setCashierName('แคชเชียร์');
      }
    };
    fetchUser();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [
        { data: catData, error: catErr },
        { data: expData, error: expErr },
        { data: prodData, error: prodErr },
      ] = await Promise.all([
        supabase
          .from('expense_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, name').order('name', { ascending: true }),
      ]);

      if (catErr) throw catErr;
      if (expErr) throw expErr;
      if (prodErr) console.warn('Products fetch warning:', prodErr);

      const activeCats = catData || [];
      setCategories(activeCats);
      if (activeCats.length > 0) {
        setSelectedCategoryId((prev) =>
          prev && activeCats.some((c) => c.id === prev) ? prev : activeCats[0].id
        );
      } else {
        setSelectedCategoryId('');
      }

      setExpenses(expData || []);
      setProducts(prodData || []);
      if (prodData && prodData.length > 0) {
        setSelectedProductId((prev) =>
          prev && prodData.some((p) => p.id === prev) ? prev : prodData[0].id
        );
      }
    } catch (err: any) {
      console.error('Error loading expenses page data:', err);
      setFeedbackMsg({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ปรับ current_qty ของสินค้าตาม delta (+ เพิ่ม / - ลด) โดยอ้างอิงชื่อสินค้าในตาราง products
  const adjustStockByProductName = async (
    productName: string,
    deltaQty: number,
    nowIso: string
  ): Promise<string> => {
    if (!productName || deltaQty === 0) return '';

    const matchedProduct = products.find(
      (p) => p.name.trim().toLowerCase() === productName.trim().toLowerCase()
    );
    if (!matchedProduct) {
      return ` (ไม่พบสินค้า "${productName}" ในระบบสำหรับปรับสต็อก)`;
    }

    const { data: stockRow, error: stockFetchErr } = await supabase
      .from('stocks')
      .select('id, current_qty')
      .eq('product_id', matchedProduct.id)
      .maybeSingle();

    if (stockFetchErr) throw stockFetchErr;
    if (!stockRow) {
      return ` (ไม่พบแถวสต็อกของ "${matchedProduct.name}")`;
    }

    const currentQty = Number(stockRow.current_qty ?? 0);
    const nextQty = Math.max(0, currentQty + deltaQty);

    const { error: stockUpdateErr } = await supabase
      .from('stocks')
      .update({
        current_qty: nextQty,
        last_adjusted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', stockRow.id);

    if (stockUpdateErr) throw stockUpdateErr;

    const signText = deltaQty > 0 ? `+${deltaQty}` : `${deltaQty}`;
    return ` | สต็อก "${matchedProduct.name}" ${signText} (คงเหลือ ${nextQty})`;
  };

  // เพิ่มหมวดหมู่ / ทางลัดรายจ่ายประจำลงตาราง expense_categories
  const handleAddCategoryShortcut = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;

    const existing = categories.find(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      setSelectedCategoryId(existing.id);
      setNewCategoryName('');
      setShowAddCategoryBox(false);
      return;
    }

    try {
      setSavingCategory(true);
      const nowIso = new Date().toISOString();
      const nextSort =
        categories.reduce((max, c) => Math.max(max, Number(c.sort_order || 0)), 0) + 1;

      const { data: inserted, error } = await supabase
        .from('expense_categories')
        .insert([
          {
            name: cleanName,
            icon: newCategoryIcon || '💸',
            color: '#f59e0b',
            is_favorite: true,
            sort_order: nextSort,
            is_active: true,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ])
        .select('*')
        .single();

      if (error) throw error;

      if (inserted) {
        setCategories((prev) => [...prev, inserted]);
        setSelectedCategoryId(inserted.id);
      }
      setNewCategoryName('');
      setNewCategoryIcon('💸');
      setShowAddCategoryBox(false);
      setFeedbackMsg({
        type: 'success',
        text: `เพิ่มเมนูทางลัด "${cleanName}" เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      console.error('Error adding expense category:', err);
      setFeedbackMsg({
        type: 'error',
        text: `ไม่สามารถเพิ่มเมนูทางลัดได้: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setSavingCategory(false);
    }
  };

  // ลบเมนูทางลัดออกจริง (is_active = false ใน expense_categories)
  const handleDeleteCategoryShortcut = async (cat: ExpenseCategoryRecord) => {
    try {
      setDeletingCategoryId(cat.id);
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: false, is_favorite: false, updated_at: nowIso })
        .eq('id', cat.id);

      if (error) throw error;

      const remaining = categories.filter((c) => c.id !== cat.id);
      setCategories(remaining);

      if (selectedCategoryId === cat.id) {
        setSelectedCategoryId(remaining[0]?.id || '');
      }
      if (categoryFilterId === cat.id) {
        setCategoryFilterId('all');
      }

      setFeedbackMsg({
        type: 'success',
        text: `ลบเมนูทางลัด "${cat.name}" ออกแล้ว`,
      });
    } catch (err: any) {
      console.error('Error removing expense category:', err);
      setFeedbackMsg({
        type: 'error',
        text: `ไม่สามารถลบเมนูทางลัดได้: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const getExpenseLocalDateISO = (row: ExpenseRecord): string | null => {
    if (row.expense_date) {
      return String(row.expense_date).slice(0, 10);
    }
    if (row.created_at) {
      const d = new Date(row.created_at);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return null;
  };

  const formatThaiDate = (isoOrDate?: string | null) => {
    if (!isoOrDate) return '-';
    const raw = String(isoOrDate).length === 10 ? `${isoOrDate}T00:00:00` : String(isoOrDate);
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(isoOrDate);
    return d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    expenses.forEach((row) => {
      const iso = getExpenseLocalDateISO(row);
      if (iso && iso.length >= 4) {
        yrs.add(iso.slice(0, 4));
      }
    });
    return Array.from(yrs).sort((a, b) => Number(b) - Number(a));
  }, [expenses]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategoryRecord>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const productNameMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [products]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((row) => {
      const iso = getExpenseLocalDateISO(row);
      const q = searchQuery.trim().toLowerCase();
      const catInfo = row.expense_category_id ? categoryMap.get(row.expense_category_id) : null;
      const catName = String(catInfo?.name || '').toLowerCase();
      const noteText = String(row.note || '').toLowerCase();
      const paidToText = String(row.paid_to || '').toLowerCase();

      const matchesSearch =
        !q || catName.includes(q) || noteText.includes(q) || paidToText.includes(q);

      const matchesCategory =
        categoryFilterId === 'all' || row.expense_category_id === categoryFilterId;

      let matchesDate = true;
      if (dateFilterMode === 'day') {
        matchesDate = iso === selectedDay;
      } else if (dateFilterMode === 'month') {
        matchesDate = Boolean(iso && iso.startsWith(selectedMonth));
      }

      if (matchesDate && selectedYear !== 'all') {
        matchesDate = Boolean(iso && iso.startsWith(selectedYear));
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [
    expenses,
    searchQuery,
    categoryFilterId,
    dateFilterMode,
    selectedDay,
    selectedMonth,
    selectedYear,
    categoryMap,
  ]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [filteredExpenses]);

  const todayExpensesTotal = useMemo(() => {
    return expenses
      .filter((item) => getExpenseLocalDateISO(item) === todayISO)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [expenses, todayISO]);

  // บันทึกรายจ่ายใหม่ + บวกเพิ่มเข้า stocks.current_qty (ถ้าเปิดใช้งาน)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const numericAmount = Number(expenseAmount);
    if (!selectedCategoryId) {
      setFeedbackMsg({
        type: 'error',
        text: 'กรุณาเพิ่มหรือเลือกหมวดหมู่รายจ่ายก่อนครับ',
      });
      return;
    }
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setFeedbackMsg({ type: 'error', text: 'กรุณาระบุยอดเงินรายจ่ายให้มากกว่า 0 บาท' });
      return;
    }

    const qtyToAdd = Number(stockQtyToAdd);
    if (linkStockEnabled) {
      if (!selectedProductId) {
        setFeedbackMsg({ type: 'error', text: 'กรุณาเลือกสินค้าที่ต้องการเพิ่มสต็อก' });
        return;
      }
      if (Number.isNaN(qtyToAdd) || qtyToAdd <= 0) {
        setFeedbackMsg({
          type: 'error',
          text: 'กรุณาระบุจำนวนชิ้น/ขวดที่รับเข้าสต็อกให้มากกว่า 0 (เช่น 2 ลัง × 12 = 24)',
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      const nowIso = new Date().toISOString();

      const prodName = linkStockEnabled ? productNameMap.get(selectedProductId) || 'สินค้า' : '';
      const stockNotePrefix =
        linkStockEnabled && qtyToAdd > 0 ? `[รับเข้าสต็อก: ${prodName} +${qtyToAdd}] ` : '';
      const cleanNote = `${stockNotePrefix}${expenseNote.trim()}`.trim();

      const { data: insertedRow, error: insertErr } = await supabase
        .from('expenses')
        .insert([
          {
            expense_category_id: selectedCategoryId,
            amount: numericAmount,
            note: cleanNote || `บันทึกโดย ${cashierName}`,
            paid_to: paidTo.trim() || null,
            expense_date: expenseDate || todayISO,
            created_by_user_id: cashierId,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ])
        .select('*')
        .single();

      if (insertErr) throw insertErr;

      let stockSummaryText = '';
      if (linkStockEnabled && selectedProductId && qtyToAdd > 0) {
        stockSummaryText = await adjustStockByProductName(prodName, qtyToAdd, nowIso);
      }

      if (insertedRow) {
        setExpenses((prev) => [insertedRow, ...prev]);
      } else {
        await fetchAllData();
      }

      const catLabel = categoryMap.get(selectedCategoryId)?.name || 'รายจ่ายร้าน';
      setExpenseAmount('');
      setPaidTo('');
      setExpenseNote('');
      setStockQtyToAdd('');
      setLinkStockEnabled(false);

      setFeedbackMsg({
        type: 'success',
        text: `บันทึกรายจ่าย "${catLabel}" ยอด ฿${numericAmount.toLocaleString()} เรียบร้อยแล้ว${stockSummaryText}`,
      });
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setFeedbackMsg({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการบันทึกรายจ่าย: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // เปิด Modal แก้ไขรายการรายจ่าย
  const openEditModal = (row: ExpenseRecord) => {
    const parsed = parseLinkedStockFromNote(row.note);
    setEditingExpense(row);
    setEditCategoryId(row.expense_category_id || categories[0]?.id || '');
    setEditAmount(String(Number(row.amount || 0)));
    setEditDate(getExpenseLocalDateISO(row) || todayISO);
    setEditPaidTo(row.paid_to || '');
    setEditNote(parsed.plainNote);
    setEditLinkedProductName(parsed.productName);
    setEditStockQty(String(parsed.qty));
  };

  // บันทึกการแก้ไขรายการรายจ่าย + ปรับสต็อกตามส่วนต่าง (กันบวกเบิ้ล)
  const handleConfirmEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    const numericAmount = Number(editAmount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setFeedbackMsg({ type: 'error', text: 'ยอดเงินต้องมากกว่า 0 บาท' });
      return;
    }

    try {
      setSavingEdit(true);
      const nowIso = new Date().toISOString();

      const oldParsed = parseLinkedStockFromNote(editingExpense.note);
      const nextStockQty = Math.max(0, Number(editStockQty || 0));
      const linkedName = editLinkedProductName || oldParsed.productName;

      let stockMsg = '';
      let finalNote = editNote.trim();

      if (linkedName) {
        const deltaStock = nextStockQty - oldParsed.qty;
        if (deltaStock !== 0) {
          stockMsg = await adjustStockByProductName(linkedName, deltaStock, nowIso);
        }
        finalNote = `[รับเข้าสต็อก: ${linkedName} +${nextStockQty}] ${editNote.trim()}`.trim();
      }

      const { data: updatedRow, error: updateErr } = await supabase
        .from('expenses')
        .update({
          expense_category_id: editCategoryId || null,
          amount: numericAmount,
          expense_date: editDate || todayISO,
          paid_to: editPaidTo.trim() || null,
          note: finalNote || `แก้ไขโดย ${cashierName}`,
          updated_at: nowIso,
        })
        .eq('id', editingExpense.id)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      setExpenses((prev) =>
        prev.map((item) => (item.id === editingExpense.id ? updatedRow || { ...item } : item))
      );
      setEditingExpense(null);
      setFeedbackMsg({
        type: 'success',
        text: `แก้ไขรายการรายจ่ายเรียบร้อยแล้ว${stockMsg}`,
      });
    } catch (err: any) {
      console.error('Error editing expense:', err);
      setFeedbackMsg({
        type: 'error',
        text: `ไม่สามารถแก้ไขรายการได้: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // ยืนยันลบรายการรายจ่าย + หักสต็อกคืนถ้าเคยเพิ่มสต็อกไว้ (กันสต็อกค้าง)
  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;

    try {
      setDeletingExpense(true);
      const nowIso = new Date().toISOString();
      const parsed = parseLinkedStockFromNote(expenseToDelete.note);

      let stockMsg = '';
      if (parsed.productName && parsed.qty > 0) {
        stockMsg = await adjustStockByProductName(parsed.productName, -parsed.qty, nowIso);
      }

      const { error: delErr } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseToDelete.id);

      if (delErr) throw delErr;

      setExpenses((prev) => prev.filter((item) => item.id !== expenseToDelete.id));
      setExpenseToDelete(null);
      setFeedbackMsg({
        type: 'success',
        text: `ลบรายการรายจ่ายเรียบร้อยแล้ว${stockMsg}`,
      });
    } catch (err: any) {
      console.error('Error deleting expense:', err);
      setFeedbackMsg({
        type: 'error',
        text: `ไม่สามารถลบรายการได้: ${err?.message || 'โปรดลองอีกครั้ง'}`,
      });
    } finally {
      setDeletingExpense(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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
                💸 รายจ่ายร้าน (Store Expenses)
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                คีย์บิลรับของเข้าร้าน เชื่อมเพิ่มสต็อกสินค้าอัตโนมัติ ใช้ทางลัดหมวดหมู่ประจำ และดูย้อนหลังรายวัน/เดือน/ปี
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-right">
            <p className="text-[11px] text-slate-400 font-semibold">
              รายจ่ายรวมวันนี้ ({formatThaiDate(todayISO)})
            </p>
            <p className="text-xl font-black text-rose-400 font-mono">
              ฿{todayExpensesTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`rounded-2xl p-4 border text-sm font-bold flex items-center justify-between gap-3 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-xs opacity-80 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Preset Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-amber-400">
                ⚡ ทางลัดรายจ่ายประจำ (คลิกเพื่อเลือกหมวดหมู่ได้ทันที)
              </h2>
              <p className="text-[11px] text-slate-400">
                เพิ่มหรือลบเมนูทางลัดได้ตามจริง เก็บในฐานข้อมูลโดยตรง กด ✕ ที่ปุ่มเพื่อลบรายการที่ไม่ใช้แล้ว
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCategoryBox((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-black transition cursor-pointer"
            >
              {showAddCategoryBox ? 'ปิดกล่องเพิ่ม' : '+ เพิ่มเมนูทางลัด'}
            </button>
          </div>

          {showAddCategoryBox && (
            <form
              onSubmit={handleAddCategoryShortcut}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div>
                <p className="text-[11px] text-slate-400 font-bold mb-1.5">เลือกไอคอน:</p>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_CHOICES.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewCategoryIcon(ic)}
                      className={`w-9 h-9 rounded-xl border text-base flex items-center justify-center transition cursor-pointer ${
                        newCategoryIcon === ic
                          ? 'bg-amber-500 text-slate-950 border-amber-400 scale-105'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-base">
                  {newCategoryIcon}
                </div>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="พิมพ์ชื่อรายจ่ายประจำ เช่น ค่าที่, ค่าน้ำแข็ง, ค่าอาหาร..."
                  className="flex-1 min-w-[220px] bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={savingCategory || !newCategoryName.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-black transition cursor-pointer"
                >
                  {savingCategory ? 'กำลังบันทึก...' : 'บันทึกทางลัด'}
                </button>
              </div>
            </form>
          )}

          {categories.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              ยังไม่มีเมนูทางลัด — กดปุ่ม{' '}
              <strong className="text-amber-400">+ เพิ่มเมนูทางลัด</strong> เพื่อสร้างรายการใช้งานได้เลยครับ
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const isDeleting = deletingCategoryId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`inline-flex items-center rounded-2xl border text-xs font-bold transition ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-amber-500/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="px-3.5 py-2 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{cat.icon || '💸'}</span>
                      <span>{cat.name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      title={`ลบทางลัด ${cat.name}`}
                      onClick={() => handleDeleteCategoryShortcut(cat)}
                      className={`px-2 py-2 rounded-r-2xl text-[11px] font-black transition cursor-pointer ${
                        isSelected
                          ? 'text-slate-950/80 hover:text-slate-950 hover:bg-amber-400'
                          : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                      }`}
                    >
                      {isDeleting ? '…' : '✕'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form: บันทึกรายจ่ายใหม่ + เชื่อมเพิ่มสต็อก */}
        <form
          onSubmit={handleSaveExpense}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-100">➕ คีย์บันทึกรายจ่ายร้าน</h2>
            <span className="text-xs text-slate-400">
              ผู้บันทึก: <strong className="text-amber-400">{cashierName}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <label className="block text-xs text-slate-400 font-bold mb-1.5">
                หมวดหมู่รายจ่าย *
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white outline-none"
                required
              >
                {categories.length === 0 ? (
                  <option value="">— กรุณาเพิ่มหมวดหมู่ทางลัดด้านบนก่อน —</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs text-slate-400 font-bold mb-1.5">
                ยอดเงินรวม (บาท) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-amber-400 placeholder-slate-600 outline-none"
                required
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs text-slate-400 font-bold mb-1.5">
                วันที่เกิดรายจ่าย (สำหรับรวมยอด Daily Close)
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <label className="inline-flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={linkStockEnabled}
                onChange={(e) => setLinkStockEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <span className="text-sm font-black text-amber-300">
                📦 ซื้อสินค้าเข้าร้าน — บวกจำนวนเพิ่มเข้าสต็อกสินค้าในร้านทันที
              </span>
            </label>

            {linkStockEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
                <div className="md:col-span-6">
                  <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                    เลือกรายการสินค้าในร้าน
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  >
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-6">
                  <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                    จำนวนชิ้น/ขวดจริงที่เพิ่มเข้าสต็อก (เช่น 2 ลัง × 12 = 24)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={stockQtyToAdd}
                    onChange={(e) => setStockQtyToAdd(e.target.value)}
                    placeholder="กรอกจำนวนที่บวกเพิ่ม เช่น 24"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-400 placeholder-slate-600 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4">
              <label className="block text-xs text-slate-400 font-bold mb-1.5">
                จ่ายให้ / ร้านค้าผู้ขาย (paid_to)
              </label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="เช่น ร้านค้าส่ง, เจ้าของที่, ร้านน้ำแข็ง..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs text-slate-400 font-bold mb-1.5">
                หมายเหตุ / รายละเอียดบิล (note)
              </label>
              <input
                type="text"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                placeholder="เช่น ซื้อ 2 ลัง ลังละ 12 ขวด, แอดมินส่งบิลมา..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                {submitting ? 'กำลังบันทึก...' : '✓ บันทึกรายจ่าย'}
              </button>
            </div>
          </div>
        </form>

        {/* Filter & Historical Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-amber-400">
                🗂️ ประวัติรายจ่ายย้อนหลัง ({filteredExpenses.length} รายการ)
              </h2>
              <p className="text-xs text-slate-400">
                กรองดูรายวัน รายเดือน รายปี แก้ไขหรือลบรายการผิดพลาดได้ (ระบบปรับยอดสต็อกตามจริงอัตโนมัติ)
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5">
              <span className="text-xs text-slate-400 mr-2">ยอดรวมตามตัวกรอง:</span>
              <span className="text-lg font-black text-amber-400 font-mono">
                ฿{totalFilteredAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">
                ค้นหาหมายเหตุ / ผู้รับเงิน
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="พิมพ์คำค้นหา..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">หมวดหมู่</label>
              <select
                value={categoryFilterId}
                onChange={(e) => setCategoryFilterId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-white outline-none"
              >
                <option value="all">ทุกหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">มุมมองเวลา</label>
              <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-2xl border border-slate-800">
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
                <button
                  type="button"
                  onClick={() => setDateFilterMode('all')}
                  className={`py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    dateFilterMode === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  ทั้งหมด
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-white outline-none"
                />
              ) : (
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setDateFilterMode('day');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-white outline-none"
                />
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 font-bold mb-1.5">ปี (ค.ศ.)</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-3 py-2.5 text-xs text-white outline-none"
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

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('day');
                setSelectedDay(todayISO);
                setSelectedYear('all');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
            >
              📅 ดูรายจ่ายวันนี้
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilterId('all');
                setDateFilterMode('all');
                setSelectedYear('all');
              }}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
            >
              ↺ แสดงทั้งหมด
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 font-bold">
              กำลังโหลดประวัติรายจ่าย...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-12 text-center bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
              <p className="text-base font-black text-slate-300">ไม่พบรายการรายจ่ายในช่วงที่เลือก</p>
              <p className="text-xs text-slate-500">
                ลองเปลี่ยนวันที่/เดือน หรือเพิ่มรายจ่ายใหม่ด้านบนได้เลยครับ
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                    <th className="py-3 px-4">วันที่</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4">จ่ายให้</th>
                    <th className="py-3 px-4">หมายเหตุ</th>
                    <th className="py-3 px-4 text-right">ยอดเงิน</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredExpenses.map((row) => {
                    const iso = getExpenseLocalDateISO(row);
                    const catInfo = row.expense_category_id
                      ? categoryMap.get(row.expense_category_id)
                      : null;
                    return (
                      <tr key={row.id} className="hover:bg-slate-950/70 transition">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                          {formatThaiDate(iso)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                          {catInfo?.icon ? `${catInfo.icon} ` : ''}
                          {catInfo?.name || 'รายจ่ายร้าน'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          {row.paid_to || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {row.note || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 whitespace-nowrap">
                          -฿{Number(row.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 text-slate-200 hover:text-slate-950 text-xs font-bold transition cursor-pointer"
                            >
                              ✏️ แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpenseToDelete(row)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                            >
                              ✕ ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal แก้ไขรายการรายจ่าย */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmEditExpense}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4"
          >
            <h3 className="text-xl font-black text-amber-400">✏️ แก้ไขรายการรายจ่าย</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">หมวดหมู่</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">ยอดเงิน (บาท) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-amber-400 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">วันที่</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">จ่ายให้</label>
                <input
                  type="text"
                  value={editPaidTo}
                  onChange={(e) => setEditPaidTo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>
            </div>

            {editLinkedProductName && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1.5">
                <label className="block text-xs font-bold text-emerald-300">
                  จำนวนรับเข้าสต็อกของ "{editLinkedProductName}" (ปรับตามส่วนต่าง ไม่บวกเบิ้ล)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editStockQty}
                  onChange={(e) => setEditStockQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 font-bold mb-1">หมายเหตุ</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingExpense(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition cursor-pointer"
              >
                {savingEdit ? 'กำลังบันทึก...' : '✓ บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal ยืนยันลบรายการรายจ่าย */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto text-2xl font-black">
              ✕
            </div>
            <h3 className="text-xl font-black text-slate-100">ยืนยันลบรายการรายจ่าย?</h3>
            <p className="text-sm text-slate-300">
              ต้องการลบรายการยอด{' '}
              <strong className="text-rose-400 font-mono">
                ฿{Number(expenseToDelete.amount || 0).toLocaleString()}
              </strong>{' '}
              ใช่หรือไม่? หากรายการนี้เคยบวกสต็อกไว้ ระบบจะหักจำนวนที่บวกไว้คืนออกให้อัตโนมัติ
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={deletingExpense}
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition cursor-pointer"
              >
                ปิดไว้ก่อน
              </button>
              <button
                type="button"
                disabled={deletingExpense}
                onClick={handleConfirmDeleteExpense}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-black text-sm transition cursor-pointer"
              >
                {deletingExpense ? 'กำลังลบ...' : '✓ ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}