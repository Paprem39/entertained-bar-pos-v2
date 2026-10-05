'use client'

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../supabase'

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
  const [billNo, setBillNo] = useState<string>('01-06102026-0055'); // แก้ไขรูปแบบเลขที่บิลให้ตรงตามที่เปิดบิลจริง
  const [customerName, setCustomerName] = useState<string>('bb bar'); // ตัด Block ออก แสดงแค่ชื่อลูกค้า
  const [openTime, setOpenTime] = useState<string>('05/10/2569 03:39:22');
  const [checkoutTime, setCheckoutTime] = useState<string>('');
  
  // ดึงชื่อพนักงานที่ Login อยู่จริงจากระบบ (Session / LocalStorage)
  const [cashierName, setCashierName] = useState<string>('แม่บุญ cashier');

  useEffect(() => {
    if (params?.blockID) {
      const id = Array.isArray(params.blockID) ? params.blockID[0] : params.blockID;
      setBlockId(id);
      
      // ดึงเลขที่บิลที่บันทึกไว้ตอนเปิดบล็อก (ถ้ามีใน localStorage)
      const savedBillNo = localStorage.getItem(`bill_no_${id}`) || `0${id}-06102026-0055`;
      setBillNo(savedBillNo);

      const savedCustomer = localStorage.getItem(`customer_${id}`) || 'bb bar';
      setCustomerName(savedCustomer);
    }

    // ดึงชื่อ Cashier จาก localStorage ตามที่ระบบ Login บันทึกไว้
    const loggedInStaff = localStorage.getItem('cashier_name') || localStorage.getItem('username') || 'แม่บุญ cashier';
    setCashierName(loggedInStaff);
  }, [params]);

  const [items, setItems] = useState<BillItem[]>([]);
  const [productCatalog, setProductCatalog] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['ทั้งหมด']);
  const [mixerList, setMixerList] = useState<string[]>([]);

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

      const mixers = formattedProducts
        .filter(p => p.category.toLowerCase() === 'mixer')
        .map(p => p.name);
      setMixerList(mixers.length > 0 ? mixers : ['น้ำเปล่า', 'โซดา', 'โค้ก', 'น้ำแข็ง']);

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

  const [pendingAction, setPendingAction] = useState<{ id: string; productId: string; name: string; currentQty: number; delta: number } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; productId: string; name: string; quantity: number } | null>(null);

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
    if (newQty < 1) return;
    if (newQty > selectedProductForAdd.stock) return;
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

      const isWhiskey = selectedProductForAdd.category.toLowerCase() === 'whiskey';
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

  const requestChangeQty = (id: string, productId: string, name: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty < 0) return;

    if (delta > 0) {
      const prod = productCatalog.find(p => p.id === productId);
      if (prod && prod.stock < delta) {
        alert('สินค้าในสต็อกไม่เพียงพอสำหรับการเพิ่มจำนวน');
        return;
      }
    }

    setPendingAction({ id, productId, name, currentQty, delta });
  };

  const confirmChangeQty = async () => {
    if (!pendingAction) return;
    const { id, productId, delta } = pendingAction;
    const targetProduct = productCatalog.find(p => p.id === productId);

    if (!targetProduct) return;

    const stockChange = -delta; 
    const newStockQty = targetProduct.stock + stockChange;

    if (newStockQty < 0) {
      alert('สต็อกสินค้าไม่พอ');
      setPendingAction(null);
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
          .map(item => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
          .filter(item => item.quantity > 0)
      );

      setPendingAction(null);
      fetchSupabaseData();

    } catch (err) {
      console.error('Error updating stock qty:', err);
      alert('เกิดข้อผิดพลาดในการอัปเดตสต็อก');
    }
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const { productId, quantity } = itemToDelete;
    const targetProduct = productCatalog.find(p => p.id === productId);

    if (!targetProduct) return;

    const newStockQty = targetProduct.stock + quantity;

    try {
      const { error } = await supabase
        .from('stocks')
        .update({ current_qty: newStockQty })
        .eq('product_id', productId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== itemToDelete.id));
      setItemToDelete(null);
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

    try {
      if (paymentMethod === 'credit') {
        alert('บันทึกบิลค้างชำระ (เครดิต) เรียบร้อยแล้ว!');
        router.push('/pos');
        return;
      }

      setIsCheckoutModalOpen(false);
      setIsReceiptModalOpen(true);

    } catch (err) {
      console.error('Error checkout:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกการชำระเงิน');
    }
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
              <h1 className="text-2xl font-black text-amber-400">กำลังให้บริการ: Block {blockId || '...'}</h1>
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
              <h2 className="font-bold text-lg text-slate-100">📋 รายการสั่งซื้อในบิล Block {blockId}</h2>
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
                      onClick={() => requestChangeQty(item.id, item.productId, item.name, item.quantity, -1)}
                      className="w-11 h-11 bg-slate-800 hover:bg-slate-700 rounded-xl text-lg font-black flex items-center justify-center cursor-pointer transition text-slate-200 border border-slate-700 shadow"
                    >
                      -
                    </button>
                    <span className="text-xl font-black w-10 text-center text-amber-300">{item.quantity}</span>
                    <button
                      onClick={() => requestChangeQty(item.id, item.productId, item.name, item.quantity, 1)}
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
                      onClick={() => setItemToDelete({ id: item.id, productId: item.productId, name: item.name, quantity: item.quantity })}
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

      {/* Modal: ชำระเงิน / คิดเงิน */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            
            <div className="px-8 py-5 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-amber-400">💳 ชำระเงิน / คิดเงิน (Block {blockId})</h3>
                <p className="text-xs text-slate-400 mt-0.5">เลือกช่องทางการชำระเงินและสรุปบิล</p>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-bold flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300 font-bold">ยอดชำระสุทธิทั้งสิ้น:</span>
                <span className="text-3xl font-black text-amber-400">฿{totalAmount.toLocaleString()}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-2 block">เลือกช่องทางการชำระเงิน:</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    💵 เงินสด
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                      paymentMethod === 'transfer'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    📱 โอนจ่าย
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`py-3.5 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                      paymentMethod === 'credit'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    📝 เครดิต (ค้างชำระ)
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block">รับเงินสดมา (บาท):</label>
                    <input
                      type="number"
                      placeholder="ระบุจำนวนเงินสด..."
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-lg font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[50, 100, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashReceived(amt.toString())}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer"
                      >
                        +{amt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashReceived(totalAmount.toString())}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/40 transition cursor-pointer"
                    >
                      พอดี (฿{totalAmount})
                    </button>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                    <span className="text-slate-400 font-bold">เงินทอน:</span>
                    <span className={`text-2xl font-black ${changeAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ฿{changeAmount >= 0 ? changeAmount.toLocaleString() : 'เงินไม่พอ'}
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                  <label className="text-xs font-bold text-slate-400 block">
                    หมายเหตุ / Note (เช่น กรณีโอนเกินมา 20 บาท):
                  </label>
                  <input
                    type="text"
                    placeholder="กรอกหมายเหตุ หรือปล่อยว่างไว้ก็ได้..."
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {paymentMethod === 'credit' && (
                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 text-amber-300 text-xs font-medium leading-relaxed">
                  📝 โหมดเครดิตค้างชำระ: สต็อกสินค้าถูกตัดเรียบร้อยแล้ว เมื่อกดยืนยัน ระบบจะบันทึกและย้ายบิลนี้ไปไว้ที่หน้าเครดิตค้างชำระ
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const nowStr = new Date().toLocaleString('th-TH', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit', second: '2-digit' 
                  });
                  setCheckoutTime(nowStr);
                  setIsReceiptModalOpen(true);
                }}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-2xl text-xs transition cursor-pointer border border-slate-700 flex items-center space-x-2 shadow"
              >
                <span>🖨️</span>
                <span>พิมพ์ใบแจ้งยอด</span>
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={handleConfirmCheckout}
                  className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-sm transition cursor-pointer shadow-xl"
                >
                  {paymentMethod === 'credit' ? '✓ บันทึกเครดิตค้างชำระ' : '✓ ยืนยันการชำระเงิน'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal: ใบเสร็จรับเงิน (Receipt Modal) */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl flex flex-col shadow-2xl overflow-hidden p-8 space-y-5 font-mono max-h-[90vh] overflow-y-auto">
            
            {/* Header: ชื่อร้าน Entertained bar */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4 space-y-1">
              <h2 className="text-2xl font-black text-slate-900 tracking-wider">Entertained bar</h2>
              <p className="text-xs text-slate-600">ซ.94 หัวหิน ประจวบคีรีขันธ์ 77110</p>
              <p className="text-xs text-slate-600">โทร: 092-952-2625</p>
              <h3 className="text-xs font-bold text-slate-800 mt-2 uppercase tracking-wider">--- ใบแจ้งยอด / ใบเสร็จ ---</h3>
            </div>

            {/* QR Code จากไฟล์ public/Qr.png จริง */}
            <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="bg-blue-900 text-white font-bold text-[10px] px-3 py-1 rounded-t-lg tracking-wider mb-2">
                THAI QR PAYMENT | PromptPay
              </div>
              <div className="w-36 h-36 bg-white p-2 border border-slate-300 rounded-xl flex items-center justify-center shadow-inner">
                <img 
                  src="/Qr.png" 
                  alt="QR PromptPay" 
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-2">สแกน QR เพื่อโอนเข้าบัญชี</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">ชื่อ: น.ส. สรสวรรค์ บุญไสว</p>
              <p className="text-[11px] text-slate-500 font-mono">บัญชี: xxx-x-x2535-x</p>
            </div>

            {/* ข้อมูลบิล & ชื่อพนักงานที่ Login จริง & ชื่อลูกค้าแบบเดี่ยว */}
            <div className="text-xs space-y-1.5 text-slate-700 border-b border-dashed border-slate-300 pb-4">
              <div className="flex justify-between">
                <span>พนักงาน:</span>
                <strong className="text-slate-900">{cashierName}</strong>
              </div>
              <div className="flex justify-between">
                <span>เลขที่บิล:</span>
                <strong className="text-slate-900">{billNo}</strong>
              </div>
              <div className="flex justify-between">
                <span>ชื่อลูกค้า:</span>
                <strong className="text-slate-900">{customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>เวลาเปิดบิล:</span>
                <span>{openTime}</span>
              </div>
              <div className="flex justify-between">
                <span>เวลาพิมพ์:</span>
                <span>{checkoutTime}</span>
              </div>
            </div>

            {/* รายการสินค้า */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-500 border-b pb-1">
                <span>รายการ</span>
                <span>จำนวน / ราคา</span>
              </div>
              {items.map((it) => (
                <div key={it.id} className="flex justify-between items-center">
                  <span className="truncate w-48">{it.name} x{it.quantity}</span>
                  <span className="font-bold">฿{it.price * it.quantity}</span>
                </div>
              ))}
            </div>

            {/* ยอดรวมจำนวน (QTY) และยอดรวมสุทธิ */}
            <div className="border-t border-dashed border-slate-300 pt-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>ยอดรวมจำนวน (QTY):</span>
                <span>{totalQuantity} ชิ้น</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>ยอดรวมสุทธิ:</span>
                <span>฿{totalAmount.toLocaleString()}</span>
              </div>
              {paymentMethod === 'cash' && cashNum > 0 && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>รับเงินสดมา:</span>
                    <span>฿{cashNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-bold">
                    <span>เงินทอน:</span>
                    <span>฿{changeAmount.toLocaleString()}</span>
                  </div>
                </>
              )}
              {paymentMethod === 'transfer' && transferNote && (
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>หมายเหตุโอน:</span>
                  <strong className="text-amber-700">{transferNote}</strong>
                </div>
              )}
            </div>

            {/* ข้อความขอบคุณท้ายใบเสร็จ (ไม่มีดาว ลงท้ายด้วย ค่ะ) */}
            <div className="text-center text-xs text-slate-600 pt-2 border-t border-dashed border-slate-300 space-y-1">
              <p className="font-bold">ขอบคุณที่ใช้บริการค่ะ</p>
              <p className="text-[10px]">Please come again!</p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow"
              >
                🖨️ ปริ้น
              </button>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer shadow"
              >
                ✓ ปิดหน้าต่างนี้
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: เลือกสินค้าจาก Supabase */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[88vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden">
            
            <div className="px-8 py-5 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-amber-400">🛒 เลือกสินค้าจากฐานข้อมูล Supabase (Block {blockId})</h3>
                <p className="text-xs text-slate-400 mt-0.5">ตัดสต็อกจริงทันทีแบบเรียลไทม์ทุก Block พร้อมระบบเช็ก Min และบังคับเลือก Mixer</p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedProductForAdd(null);
                }}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-bold flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex space-x-2 overflow-x-auto w-full pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition cursor-pointer shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-amber-500 text-slate-950 shadow-lg'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="w-full md:w-72 shrink-0">
                  <input
                    type="text"
                    placeholder="🔍 ค้นหาชื่อสินค้า..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-4 pr-2 content-start">
                {filteredCatalog.length === 0 ? (
                  <div className="col-span-3 text-center text-slate-500 py-20 font-semibold">
                    ไม่พบรายการสินค้าที่คุณค้นหา
                  </div>
                ) : (
                  filteredCatalog.map((prod) => {
                    const isOutOfStock = prod.stock <= 0;
                    const isLowStock = prod.stock <= prod.minStock && !isOutOfStock;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleSelectProduct(prod)}
                        className={`p-5 bg-slate-950 border rounded-2xl transition flex flex-col justify-between shadow relative ${
                          isOutOfStock 
                            ? 'opacity-40 border-slate-900 cursor-not-allowed bg-slate-900/40' 
                            : selectedProductForAdd?.id === prod.id 
                              ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-500/5 cursor-pointer' 
                              : 'border-slate-800 hover:border-slate-600 cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-amber-400/80 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                              {prod.category}
                            </span>
                            
                            {isOutOfStock ? (
                              <span className="text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                ❌ สินค้าหมด
                              </span>
                            ) : isLowStock ? (
                              <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 animate-pulse">
                                ⚠️ สต็อกใกล้หมด ({prod.stock})
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">คงเหลือ: {prod.stock}</span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-100 text-lg mt-3">{prod.name}</h4>
                        </div>

                        <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-900">
                          <span className="text-amber-400 font-black text-xl">฿{prod.price}</span>
                          <span className={`text-xs font-bold ${isOutOfStock ? 'text-slate-600' : 'text-slate-400'}`}>
                            {isOutOfStock ? 'ไม่สามารถขายได้' : 'เลือกจำนวน →'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {selectedProductForAdd && (
              <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col space-y-4 animate-fadeIn">
                
                {selectedProductForAdd.category.toLowerCase() === 'whiskey' && (
                  <div className="bg-slate-900 p-4 rounded-2xl border border-amber-500/30">
                    <span className="text-xs font-bold text-amber-400 mb-2 block">
                      🥃 กรุณาเลือก Mixer (ผสมอะไรบ้าง ไม่คิดเงินเพิ่ม):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {mixerList.map((mixerName) => {
                        const isSelected = selectedMixers.includes(mixerName);
                        return (
                          <button
                            key={mixerName}
                            type="button"
                            onClick={() => {
                              setSelectedMixers(prev => 
                                isSelected ? prev.filter(m => m !== mixerName) : [...prev, mixerName]
                              );
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                              isSelected 
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow' 
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}{mixerName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">รายการที่เลือก:</span>
                    <h4 className="text-lg font-black text-amber-300">
                      {selectedProductForAdd.name} 
                      {selectedMixers.length > 0 ? ` + ${selectedMixers.join(' + ')}` : ''} 
                      (฿{selectedProductForAdd.price})
                    </h4>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
                      <span className="text-xs text-slate-400 font-bold mr-2">จำนวน:</span>
                      <button
                        onClick={() => handleQuantityChangeInModal(-1)}
                        className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black text-lg flex items-center justify-center cursor-pointer transition"
                      >
                        -
                      </button>
                      <span className="text-xl font-black w-10 text-center text-amber-400">{addQuantity}</span>
                      <button
                        onClick={() => handleQuantityChangeInModal(1)}
                        className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black text-lg flex items-center justify-center cursor-pointer transition"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={handleConfirmAddProduct}
                      className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-base transition cursor-pointer shadow-xl flex items-center space-x-2"
                    >
                      <span>✓ ยืนยันเพิ่มเข้าบิลและตัดสต็อก (฿{(selectedProductForAdd.price * addQuantity).toLocaleString()})</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal: ยืนยันเปลี่ยนจำนวน */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl text-center">
            <h3 className="text-lg font-black text-amber-400 mb-3">ยืนยันการปรับจำนวนสินค้า</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              ต้องการเปลี่ยนจำนวน <span className="text-amber-300 font-bold">{pendingAction.name}</span> เป็น <span className="text-amber-400 font-bold text-base">{pendingAction.currentQty + pendingAction.delta}</span> ใช่หรือไม่?
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmChangeQty}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-sm transition cursor-pointer shadow-lg"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ยืนยันลบรายการ */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-rose-500/30">
              🗑
            </div>
            <h3 className="text-lg font-black text-rose-400 mb-2">ยืนยันการลบรายการสินค้า</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              คุณต้องการลบ <span className="text-rose-300 font-bold">"{itemToDelete.name}"</span> ออกจากบิลนี้ใช่หรือไม่? <br />
              <span className="text-xs text-amber-400 mt-2 block">(ระบบจะคืนสต็อกจำนวน {itemToDelete.quantity} ชิ้นกลับเข้าคลังทันที)</span>
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDeleteItem}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-sm transition cursor-pointer shadow-lg"
              >
                ลบและคืนสต็อก
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}