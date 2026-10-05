'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../supabase';
import AddProductModal from './AddProductModal';
import CheckoutModal from './CheckoutModal';
import ReceiptModal from './ReceiptModal';

interface BillItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  mixers?: string[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  category: string;
  stock: number;
  minStock: number;
}

export default function PosBlockDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  const [blockId, setBlockId] = useState<string>('');
  const [blockName, setBlockName] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [openTime, setOpenTime] = useState<string>('');
  const [checkoutTime, setCheckoutTime] = useState<string>('');
  const [cashierName, setCashierName] = useState<string>('กำลังโหลด...');

  // 1. ดึงข้อมูลชื่อพนักงานที่ Login ผ่าน API /api/auth ตาม layout.tsx
  const fetchCurrentCashier = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCashierName(data.user.display_name || data.user.name || 'พนักงาน');
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
        setBlockName(data.name || `Block ${id}`);
        setCustomerName(data.customer && data.customer !== 'NULL' && data.customer !== 'EMPTY' ? data.customer : 'ยังไม่ระบุชื่อลูกค้า');
        setBillNo(data.bill_code && data.bill_code !== 'NULL' && data.bill_code !== 'EMPTY' ? data.bill_code : '-');
        setOpenTime(data.time && data.time !== 'NULL' && data.time !== 'EMPTY' ? data.time : '-');
      }
    } catch (err) {
      console.error('Unexpected error fetching block details:', err);
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

  // 3. ดึงสินค้า หมวดหมู่ และ Mixer จาก Supabase จริงๆ
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

      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          normal_price,
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

        return {
          id: p.id,
          name: p.name,
          price: p.normal_price,
          category_id: p.category_id,
          category: categoryName,
          stock: stockQty,
          minStock: minQty
        };
      });

      setProductCatalog(formattedProducts);

      // ดึงรายชื่อ Mixer จากฐานข้อมูลจริง
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
  }, []);

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

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
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

    const newStockQty = selectedProductForAdd.stock - addQuantity;

    try {
      const { error } = await supabase
        .from('stocks')
        .update({ current_qty: newStockQty })
        .eq('product_id', selectedProductForAdd.id);

      if (error) throw error;

      const isWhiskey = selectedProductForAdd.category.toLowerCase().includes('whiskey') || selectedProductForAdd.category.toLowerCase().includes('เหล้า');
      const finalItemName = isWhiskey && selectedMixers.length > 0 
        ? `${selectedProductForAdd.name} + ${selectedMixers.join(' + ')}` 
        : selectedProductForAdd.name;

      setItems(prev => [
        ...prev,
        {
          id: `${selectedProductForAdd.id}-${Date.now()}`,
          productId: selectedProductForAdd.id,
          name: finalItemName,
          price: selectedProductForAdd.price,
          quantity: addQuantity,
          category: selectedProductForAdd.category,
          mixers: selectedMixers
        }
      ]);

      setIsAddModalOpen(false);
      setSelectedProductForAdd(null);
      fetchSupabaseData();

    } catch (err) {
      console.error('Error updating stock:', err);
      alert('เกิดข้อผิดพลาดในการตัดสต็อก');
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
          .map(item => (item.productId === productId ? { ...item, quantity: item.quantity + delta } : item))
          .filter(item => item.quantity > 0)
      );

      fetchSupabaseData();
    } catch (err) {
      console.error('Error updating stock qty:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตสต็อก');
    }
  };

  const handleDeleteItem = async (itemId: string, productId: string, quantity: number) => {
    const targetProduct = productCatalog.find(p => p.id === productId);
    if (!targetProduct) return;

    const newStockQty = targetProduct.stock + quantity;

    try {
      const { error } = await supabase
        .from('stocks')
        .update({ current_qty: newStockQty })
        .eq('product_id', productId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== itemId));
      fetchSupabaseData();
    } catch (err) {
      console.error('Error returning stock on delete:', err);
      alert('เกิดข้อผิดพลาดในการคืนสต็อก');
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
            onClick={() => router.push('/pos')}
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
                    <p className="text-xs text-amber-400 font-semibold mt-0.5">ราคาหน่วยละ ฿{item.price}</p>
                  </div>

                  <div className="flex items-center space-x-4 mx-6">
                    <button
                      onClick={() => requestChangeQty(item.productId, item.quantity, -1)}
                      className="w-11 h-11 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-black flex items-center justify-center cursor-pointer transition text-slate-200 border border-slate-700 shadow"
                    >
                      -
                    </button>
                    <span className="text-xl font-black w-10 text-center text-amber-300">{item.quantity}</span>
                    <button
                      onClick={() => requestChangeQty(item.productId, item.quantity, 1)}
                      className="w-11 h-11 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-black flex items-center justify-center cursor-pointer transition text-slate-200 border border-slate-700 shadow"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right w-32">
                    <span className="text-lg font-black text-amber-400">฿{(item.price * item.quantity).toLocaleString()}</span>
                  </div>

                  <div className="ml-6 pl-4 border-l border-slate-800">
                    <button
                      onClick={() => handleDeleteItem(item.id, item.productId, item.quantity)}
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
        items={items}
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