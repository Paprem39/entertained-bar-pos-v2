'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../supabase';
import AddProductModal from './AddProductModal';
import CheckoutModal from './CheckoutModal';
import ReceiptModal from './ReceiptModal';

interface BillItem {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  category: string;
  mixers?: string[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  normal_price: number;
  tournament_price: number;
  category_id: string;
  category: string;
  stock: number;
  minStock: number;
}

export default function PosBlockDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // เช็กโหมดปัจจุบันจาก URL (support ทั้ง ?mode=tournament และปกติ)
  const modeParam = searchParams.get('mode');
  const priceMode = modeParam === 'tournament' ? 'tournament' : 'normal';

  const [blockId, setBlockId] = useState<string>('');
  const [blockName, setBlockName] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [openTime, setOpenTime] = useState<string>('');
  const [checkoutTime, setCheckoutTime] = useState<string>('');
  const [cashierName, setCashierName] = useState<string>('กำลังโหลด...');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State สำหรับจัดการ Popup ยืนยันการลบสินค้า
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<BillItem | null>(null);

  // 1. ดึงข้อมูลชื่อพนักงานและ ID ที่ Login ผ่าน API /api/auth ตาม layout.tsx
  const fetchCurrentCashier = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCashierName(data.user.display_name || data.user.name || 'พนักงาน');
        setCurrentUserId(data.user.id || null);
      } else {
        setCashierName('ยังไม่ได้เข้าสู่ระบบ');
      }
    } catch (err) {
      console.error("Failed to fetch session user", err);
      setCashierName('ระบบแคชเชียร์');
    }
  };

  // 2. ดึงข้อมูล Block จาก Supabase ตามตาราง pos_blocks จริง
  const fetchBlockDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('pos_blocks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching block data:', error);
        return;
      }

      if (data) {
        const currentBillCode = data.bill_code && data.bill_code !== 'NULL' && data.bill_code !== 'EMPTY' ? data.bill_code : '-';
        setBlockName(data.name || `Block ${id}`);
        setCustomerName(data.customer && data.customer !== 'NULL' && data.customer !== 'EMPTY' ? data.customer : 'ยังไม่ระบุชื่อลูกค้า');
        setBillNo(currentBillCode);
        setOpenTime(data.time && data.time !== 'NULL' && data.time !== 'EMPTY' ? data.time : '-');

        if (currentBillCode && currentBillCode !== '-') {
          fetchBillAndItems(currentBillCode);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching block details:', err);
    }
  };

  // ฟังก์ชันดึงรายการสินค้าในบิลจากตาราง bills และ bill_items
  const fetchBillAndItems = async (currentBillCode: string) => {
    try {
      const { data: billData, error: billError } = await supabase
        .from('bills')
        .select('id')
        .eq('bill_number', currentBillCode)
        .single();

      if (billError || !billData) return;

      const { data: itemsData, error: itemsError } = await supabase
        .from('bill_items')
        .select(`
          id,
          product_id,
          product_name,
          unit_price,
          qty,
          line_total,
          bill_item_mixers ( mixer_name )
        `)
        .eq('bill_id', billData.id);

      if (itemsError) throw itemsError;

      const loadedItems: BillItem[] = (itemsData || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        name: item.product_name,
        unitPrice: item.unit_price || 0,
        qty: item.qty || 0,
        lineTotal: item.line_total || 0,
        category: 'อื่นๆ',
        mixers: item.bill_item_mixers?.map((m: any) => m.mixer_name) || []
      }));

      setItems(loadedItems);
    } catch (err) {
      console.error('Error fetching bill items from database:', err);
    }
  };

  useEffect(() => {
    fetchCurrentCashier();
    if (params?.blockID) {
      const id = Array.isArray(params.blockID) ? params.blockID[0] : params.blockID;
      setBlockId(id);
      fetchBlockDetails(id);
    }
  }, [params]);

  const [items, setItems] = useState<BillItem[]>([]);
  const [productCatalog, setProductCatalog] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['ทั้งหมด']);
  const [mixerList, setMixerList] = useState<string[]>([]);

  // 3. ดึงสินค้า หมวดหมู่ และ Mixer จาก Supabase พร้อมดึง tournament_price และสลับราคาตาม mode
  const fetchSupabaseData = async () => {
    try {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (catError) throw catError;

      const catMap: Record<string, string> = {};
      catData?.forEach((c: any) => { catMap[c.id] = c.name; });
      setCategories(['ทั้งหมด', ...(catData?.map((c: any) => c.name) || [])]);

      // เพิ่ม tournament_price เข้าไปใน query เลือกข้อมูลจากตาราง products
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          normal_price,
          tournament_price,
          category_id,
          is_active,
          categories ( name ),
          stocks ( current_qty, minimum_qty )
        `)
        .eq('is_active', true);

      if (prodError) throw prodError;

      const formattedProducts: Product[] = (prodData || []).map((p: any) => {
        const stockQty = p.stocks && p.stocks.length > 0 ? p.stocks[0].current_qty : 0;
        const minQty = p.stocks && p.stocks.length > 0 ? p.stocks[0].minimum_qty : 5;
        const categoryName = p.categories?.name || catMap[p.category_id] || 'อื่นๆ';

        const normalPrice = p.normal_price || 0;
        const tournamentPrice = p.tournament_price ?? normalPrice; // ถ้าไม่มีราคาแข่งให้ fallback ใช้ราคาปกติ

        // เลือกราคาหลักที่จะแสดงผลตามโหมด URL ปัจจุบันทันที
        const activePrice = priceMode === 'tournament' ? tournamentPrice : normalPrice;

        return {
          id: p.id,
          name: p.name,
          price: activePrice,
          normal_price: normalPrice,
          tournament_price: tournamentPrice,
          category_id: p.category_id,
          category: categoryName,
          stock: stockQty,
          minStock: minQty
        };
      });

      setProductCatalog(formattedProducts);

      const mixers = formattedProducts
        .filter(p => p.category.toLowerCase().includes('mixer') || p.category.toLowerCase().includes('มิกเซอร์'))
        .map(p => p.name);
      
      setMixerList(mixers);

    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
    }
  };

  useEffect(() => {
    fetchSupabaseData();
  }, [priceMode]); // โหลดข้อมูลใหม่หรืออัปเดตราคาอัตโนมัติเมื่อโหมดเปลี่ยน

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');

  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<Product | null>(null);
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [selectedMixers, setSelectedMixers] = useState<string[]>([]);

  const totalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.qty, 0);
  const cashNum = parseFloat(cashReceived) || 0;
  const changeAmount = cashNum - totalAmount;

  const filteredCatalog = productCatalog.filter(p => {
    const matchesCat = selectedCategory === 'ทั้งหมด' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenAddModal = () => {
    fetchSupabaseData();
    setSelectedCategory('ทั้งหมด');
    setSearchQuery('');
    setSelectedProductForAdd(null);
    setIsAddModalOpen(true);
  };

  const handleSelectProduct = (product: Product) => {
    if (product.stock <= 0) return;
    setSelectedProductForAdd(product);
    setAddQuantity(1);
    setSelectedMixers([]);
  };

  const handleQuantityChangeInModal = (delta: number) => {
    if (!selectedProductForAdd) return;
    const newQty = addQuantity + delta;
    if (newQty < 1 || newQty > selectedProductForAdd.stock) return;
    setAddQuantity(newQty);
  };

  const handleConfirmAddProduct = async () => {
    if (!selectedProductForAdd) return;

    if (addQuantity > selectedProductForAdd.stock) {
      alert('จำนวนสินค้าในสต็อกไม่พอครับ');
      return;
    }

    try {
      let currentBillId = '';
      
      const { data: existingBill, error: findBillErr } = await supabase
        .from('bills')
        .select('id')
        .eq('bill_number', billNo)
        .single();

      if (findBillErr || !existingBill) {
        const { data: newBill, error: createBillErr } = await supabase
          .from('bills')
          .insert({
            bill_number: billNo,
            bill_name: `Block ${blockName || blockId} - ${customerName}`,
            subtotal: 0,
            total_amount: 0,
            discount_amount: 0,
            status: 'active',
            opened_at: new Date().toISOString(),
            created_by_user_id: currentUserId
          })
          .select('id')
          .single();

        if (createBillErr) throw createBillErr;
        currentBillId = newBill.id;
      } else {
        currentBillId = existingBill.id;
      }

      const isWhiskey = selectedProductForAdd.category.toLowerCase().includes('whiskey') || selectedProductForAdd.category.toLowerCase().includes('เหล้า');
      const finalItemName = isWhiskey && selectedMixers.length > 0 
        ? `${selectedProductForAdd.name} + ${selectedMixers.join(' + ')}` 
        : selectedProductForAdd.name;

      const calculatedLineTotal = selectedProductForAdd.price * addQuantity;

      const { data: insertedItem, error: insertItemErr } = await supabase
        .from('bill_items')
        .insert({
          bill_id: currentBillId,
          product_id: selectedProductForAdd.id,
          product_name: finalItemName,
          qty: addQuantity,
          unit_price: selectedProductForAdd.price,
          line_total: calculatedLineTotal,
          added_by_user_id: currentUserId
        })
        .select('id')
        .single();

      if (insertItemErr) throw insertItemErr;

      if (isWhiskey && selectedMixers.length > 0 && insertedItem) {
        const mixerRows = selectedMixers.map(mixerName => ({
          bill_item_id: insertedItem.id,
          mixer_name: mixerName
        }));
        const { error: mixerErr } = await supabase.from('bill_item_mixers').insert(mixerRows);
        if (mixerErr) throw mixerErr;
      }

      const newStockQty = selectedProductForAdd.stock - addQuantity;
      const { error: stockErr } = await supabase
        .from('stocks')
        .update({ current_qty: newStockQty })
        .eq('product_id', selectedProductForAdd.id);

      if (stockErr) throw stockErr;

      setIsAddModalOpen(false);
      setSelectedProductForAdd(null);
      await fetchBillAndItems(billNo);
      fetchSupabaseData();

    } catch (err) {
      console.error('Error saving bill item to database:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล');
    }
  };

  const requestChangeQty = async (productId: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty < 0) return;

    const targetProduct = productCatalog.find(p => p.id === productId);
    if (!targetProduct) return;

    const stockChange = -delta; 
    const newStockQty = targetProduct.stock + stockChange;

    if (newStockQty < 0) {
      alert('สต็อกสินค้าไม่พอ');
      return;
    }

    try {
      const { error } = await supabase
        .from('stocks')
        .update({ current_qty: newStockQty })
        .eq('product_id', productId);

      if (error) throw error;

      setItems(prev =>
        prev
          .map(item => (item.productId === productId ? { ...item, qty: item.qty + delta, lineTotal: item.unitPrice * (item.qty + delta) } : item))
          .filter(item => item.qty > 0)
      );

      fetchSupabaseData();
    } catch (err) {
      console.error('Error updating stock qty:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตสต็อก');
    }
  };

  // ฟังก์ชันเปิด Modal ยืนยันการลบรายการ
  const handleOpenDeleteModal = (item: BillItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  // ฟังก์ชันยืนยันการลบและคืนยอดกลับเข้าสต็อกจริง
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    const targetProduct = productCatalog.find(p => p.id === itemToDelete.productId);
    if (!targetProduct) {
      setIsDeleteModalOpen(false);
      return;
    }

    const newStockQty = targetProduct.stock + itemToDelete.qty;

    try {
      const { error: stockErr } = await supabase
        .from('stocks')
        .update({ current_qty: newStockQty })
        .eq('product_id', itemToDelete.productId);

      if (stockErr) throw stockErr;

      const { error: deleteItemErr } = await supabase
        .from('bill_items')
        .delete()
        .eq('id', itemToDelete.id);

      if (deleteItemErr) throw deleteItemErr;

      setItems(prev => prev.filter(item => item.id !== itemToDelete.id));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchSupabaseData();
    } catch (err) {
      console.error('Error returning stock on delete:', err);
      alert('เกิดข้อผิดพลาดในการลบรายการสินค้า');
    }
  };

  const handleConfirmCheckout = async () => {
    const nowStr = new Date().toLocaleString('th-TH', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
    setCheckoutTime(nowStr);

    if (paymentMethod === 'cash' && cashNum < totalAmount) {
      alert('จำนวนเงินสดที่รับมาน้อยกว่ายอดรวมสุทธิ');
      return;
    }

    if (paymentMethod === 'credit') {
      alert('บันทึกบิลค้างชำระ (เครดิต) เรียบร้อยแล้ว!');
      router.push('/pos');
      return;
    }

    setIsCheckoutModalOpen(false);
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => router.push(`/pos?mode=${priceMode}`)}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition cursor-pointer flex items-center space-x-2"
          >
            <span>← กลับหน้าภาพรวม Block</span>
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-black text-amber-400">กำลังให้บริการ: {blockName || `Block ${blockId}`}</h1>
              <span className="bg-amber-500/20 text-amber-300 text-sm px-3 py-1 rounded-full border border-amber-500/30 font-bold">
                ลูกค้า: {customerName}
              </span>
              {/* ป้ายแสดงสถานะโหมดราคาปัจจุบัน */}
              <span className={`text-xs px-3 py-1 rounded-full border font-bold ${
                priceMode === 'tournament' 
                  ? 'bg-orange-600/20 text-orange-400 border-orange-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {priceMode === 'tournament' ? '🏆 ราคาวันแข่ง (Tournament)' : '🏷️ ราคาปกติ (Normal)'}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-slate-400 mt-1.5 font-medium">
              <span>พนักงาน: <strong className="text-amber-300">{cashierName}</strong></span>
              <span>•</span>
              <span>เลขที่บิล: <strong className="text-slate-200 font-mono">{billNo}</strong></span>
              <span>•</span>
              <span>เวลาเปิดบิล: <strong className="text-slate-200 font-mono">{openTime}</strong></span>
            </div>
          </div>
        </div>

        <button
          disabled={items.length === 0}
          onClick={() => {
            setCashReceived('');
            setTransferNote('');
            setPaymentMethod('cash');
            setIsCheckoutModalOpen(true);
          }}
          className={`px-8 py-4 rounded-2xl font-black transition shadow-xl text-base flex items-center space-x-3 ${
            items.length === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer animate-pulse'
          }`}
        >
          <span className="text-xl">💳</span>
          <span>ชำระเงิน / คิดเงิน (฿{totalAmount.toLocaleString()})</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-8 py-5 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-lg text-slate-100">📋 รายการสั่งซื้อในบิล {blockName || `Block ${blockId}`}</h2>
              <span className="text-xs text-slate-400 font-medium">จำนวนทั้งหมด {totalQuantity} รายการ</span>
            </div>
            
            <button
              onClick={handleOpenAddModal}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-sm transition cursor-pointer flex items-center space-x-2 shadow-lg border-2 border-amber-400"
            >
              <span className="text-lg">➕</span>
              <span>เพิ่มรายการสินค้า</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center text-slate-500 py-24 text-base font-semibold">ยังไม่มีรายการสินค้าในบิลนี้</div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {items.map((item) => (
                <div key={item.id} className="px-8 py-5 flex items-center justify-between hover:bg-slate-850/50 transition">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-100 text-lg">{item.name}</h3>
                    {item.mixers && item.mixers.length > 0 && (
                      <p className="text-xs text-amber-300/80 mt-0.5">มิกเซอร์: {item.mixers.join(', ')}</p>
                    )}
                    <p className="text-xs text-amber-400 font-semibold mt-0.5">ราคาหน่วยละ ฿{item.unitPrice}</p>
                  </div>

                  <div className="flex items-center space-x-4 mx-6">
                    <button
                      onClick={() => requestChangeQty(item.productId, item.qty, -1)}
                      className="w-11 h-11 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-black flex items-center justify-center cursor-pointer transition text-slate-200 border border-slate-700 shadow"
                    >
                      -
                    </button>
                    <span className="text-xl font-black w-10 text-center text-amber-300">{item.qty}</span>
                    <button
                      onClick={() => requestChangeQty(item.productId, item.qty, 1)}
                      className="w-11 h-11 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-black flex items-center justify-center cursor-pointer transition text-slate-200 border border-slate-700 shadow"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right w-32">
                    <span className="text-lg font-black text-amber-400">฿{(item.unitPrice * item.qty).toLocaleString()}</span>
                  </div>

                  <div className="ml-6 pl-4 border-l border-slate-800">
                    <button
                      onClick={() => handleOpenDeleteModal(item)}
                      className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer border border-rose-500/30 flex items-center space-x-1"
                    >
                      <span>🗑️</span>
                      <span>DEL</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-8 py-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
            <span className="text-slate-300 font-bold text-base">ยอดรวมสุทธิทั้งสิ้น (QTY: {totalQuantity})</span>
            <span className="text-3xl font-black text-amber-400">฿{totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl border border-rose-500/30">
              ⚠️
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-100">ยืนยันการลบรายการสินค้า?</h3>
              <p className="text-sm text-slate-400 mt-2">
                คุณต้องการลบ <strong className="text-amber-400">{itemToDelete.name}</strong> (จำนวน {itemToDelete.qty} ชิ้น) ออกจากบิลนี้ใช่หรือไม่?
              </p>
              <p className="text-xs text-amber-300/80 mt-1 font-medium bg-amber-500/10 py-1.5 px-3 rounded-lg border border-amber-500/20">
                💡 ระบบจะทำการคืนจำนวนสินค้าจำนวน {itemToDelete.qty} ชิ้น กลับเข้าสู่สต็อกสินค้าอัตโนมัติ
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-sm transition cursor-pointer shadow-lg shadow-rose-600/30"
              >
                ยืนยันการลบและคืนสต็อก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        blockId={blockId}
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredCatalog={filteredCatalog}
        selectedProductForAdd={selectedProductForAdd}
        handleSelectProduct={handleSelectProduct}
        addQuantity={addQuantity}
        handleQuantityChangeInModal={handleQuantityChangeInModal}
        mixerList={mixerList}
        selectedMixers={selectedMixers}
        setSelectedMixers={setSelectedMixers}
        handleConfirmAddProduct={handleConfirmAddProduct}
      />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        blockId={blockId}
        totalAmount={totalAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        changeAmount={changeAmount}
        transferNote={transferNote}
        setTransferNote={setTransferNote}
        onPrintPreview={() => {
          const nowStr = new Date().toLocaleString('th-TH', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
          });
          setCheckoutTime(nowStr);
          setIsReceiptModalOpen(true);
        }}
        onConfirmCheckout={handleConfirmCheckout}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        cashierName={cashierName}
        billNo={billNo}
        customerName={customerName}
        openTime={openTime}
        checkoutTime={checkoutTime}
        items={items.map(i => ({ ...i, price: i.unitPrice, quantity: i.qty }))}
        totalQuantity={totalQuantity}
        totalAmount={totalAmount}
        paymentMethod={paymentMethod}
        cashReceived={cashReceived}
        changeAmount={changeAmount}
        transferNote={transferNote}
      />

    </div>
  );
}