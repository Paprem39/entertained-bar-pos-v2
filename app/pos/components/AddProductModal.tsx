'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../supabase';

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

interface DrinkRecipient {
  id: string;
  name: string;
  recipient_type: string;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string;
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredCatalog: Product[];
  selectedProductForAdd: Product | null;
  handleSelectProduct: (product: Product) => void;
  addQuantity: number;
  handleQuantityChangeInModal: (delta: number) => void;
  mixerList: string[];
  selectedMixers: string[];
  setSelectedMixers: (mixers: string[]) => void;
  handleConfirmAddProduct: () => void;
  isStaffDrink: boolean;
  setIsStaffDrink: (val: boolean) => void;
  drinkerName: string;
  setDrinkerName: (name: string) => void;
}

export default function AddProductModal({
  isOpen,
  onClose,
  blockId,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  filteredCatalog,
  selectedProductForAdd,
  handleSelectProduct,
  addQuantity,
  handleQuantityChangeInModal,
  mixerList,
  selectedMixers,
  setSelectedMixers,
  handleConfirmAddProduct,
  isStaffDrink,
  setIsStaffDrink,
  drinkerName,
  setDrinkerName,
}: AddProductModalProps) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [priceMode, setPriceMode] = useState<'normal' | 'tournament'>('normal');

  const [approvedRecipients, setApprovedRecipients] = useState<DrinkRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState<boolean>(false);
  const [recipientInputMode, setRecipientInputMode] = useState<'select' | 'custom'>('select');

  // State สำหรับฟอร์มขอเพิ่มรายชื่อเข้าลิสต์ (ส่งไปให้ Admin Approve)
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);
  const [requestName, setRequestName] = useState<string>('');
  const [requestType, setRequestType] = useState<'staff' | 'owner'>('staff');
  const [requestSending, setRequestSending] = useState<boolean>(false);
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (modeParam === 'tournament') {
      setPriceMode('tournament');
    } else {
      setPriceMode('normal');
    }
  }, [modeParam]);

  useEffect(() => {
    if (!isOpen) {
      setShowRequestForm(false);
      setRequestName('');
      setRequestFeedback(null);
      return;
    }

    const fetchApprovedRecipients = async () => {
      setLoadingRecipients(true);
      try {
        const { data, error } = await supabase
          .from('drink_recipients')
          .select('id, name, recipient_type')
          .eq('status', 'approved')
          .eq('is_active', true)
          .order('recipient_type', { ascending: true })
          .order('name', { ascending: true });

        if (error) throw error;
        setApprovedRecipients(data || []);
        setRecipientInputMode('select');
      } catch (err) {
        console.error('Error fetching drink recipients:', err);
      } finally {
        setLoadingRecipients(false);
      }
    };

    fetchApprovedRecipients();
  }, [isOpen]);

  // ฟังก์ชันส่งคำขอเพิ่มชื่อผู้รับดื่มลง Supabase (status = 'pending')
  const handleSendRecipientRequest = async () => {
    const trimmed = requestName.trim();
    if (!trimmed) return;

    setRequestSending(true);
    setRequestFeedback(null);

    try {
      let userId: string | null = null;
      try {
        const res = await fetch('/api/auth');
        const authData = await res.json();
        if (authData.authenticated && authData.user?.id) {
          userId = authData.user.id;
        }
      } catch {}

      const { error } = await supabase.from('drink_recipients').insert({
        name: trimmed,
        recipient_type: requestType,
        status: 'pending',
        is_active: true,
        requested_by_user_id: userId,
      });

      if (error) throw error;

      setRequestFeedback(`✓ ส่งคำขอเพิ่ม "${trimmed}" แล้ว รอ Admin อนุมัติ`);
      setRequestName('');
      setShowRequestForm(false);
    } catch (err) {
      console.error('Error sending recipient request:', err);
      setRequestFeedback('❌ ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setRequestSending(false);
    }
  };

  if (!isOpen) return null;

  const getProductPrice = (product: Product) => {
    const basePrice = priceMode === 'tournament'
      ? (product.tournament_price ?? product.price ?? 0)
      : (product.normal_price ?? product.price ?? 0);
    return isStaffDrink ? basePrice + 50 : basePrice;
  };

  const currentProductPrice = selectedProductForAdd ? getProductPrice(selectedProductForAdd) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-8 py-5 bg-slate-850 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-black text-amber-400">🛒 เลือกสินค้าจากฐานข้อมูล Supabase (Block {blockId})</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                priceMode === 'tournament' 
                  ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {priceMode === 'tournament' ? '🏆 ราคาวันแข่ง (Tournament)' : '🏷️ ราคาปกติ (Normal)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">ตัดสต็อกจริงทันทีแบบเรียลไทม์ทุก Block พร้อมระบบเช็ก Min และบังคับเลือก Mixer</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* ฝั่งซ้าย: ค้นหา หมวดหมู่ และ Catalog สินค้า */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4 border-r border-slate-800">
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat 
                      ? 'bg-amber-500 text-slate-950 shadow-lg' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {filteredCatalog.map(product => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = !isOutOfStock && product.stock <= product.minStock;
                const isSelected = selectedProductForAdd?.id === product.id;
                const displayPrice = getProductPrice(product);

                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        handleSelectProduct({ ...product, price: displayPrice });
                      }
                    }}
                    className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                      isOutOfStock 
                        ? 'bg-slate-950/40 border-slate-900 opacity-50 cursor-not-allowed' 
                        : isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 cursor-pointer'
                        : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          {product.category}
                        </span>
                        <span className="text-amber-400 font-black text-base">฿{displayPrice}</span>
                      </div>
                      <h4 className="font-bold text-slate-100 text-sm mt-2 line-clamp-1">{product.name}</h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
                      {isOutOfStock ? (
                        <span className="text-rose-500 font-bold">สินค้าหมด</span>
                      ) : isLowStock ? (
                        <span className="text-rose-400 font-bold animate-pulse flex items-center space-x-1">
                          <span>⚠️ สต็อก: {product.stock} (ต่ำกว่า Min: {product.minStock})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">สต็อก: {product.stock}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ฝั่งขวา: รายละเอียดสินค้าที่เลือก */}
          <div className="w-full md:w-[440px] p-6 bg-slate-950 flex flex-col justify-between space-y-6">
            
            {selectedProductForAdd ? (
              <div className="space-y-5 overflow-y-auto pr-1">
                <div>
                  <span className="text-sm text-amber-400 font-bold uppercase tracking-wide">รายการที่เลือก</span>
                  <h4 className="text-2xl font-black text-slate-100 mt-1">{selectedProductForAdd.name}</h4>
                  <div className="flex justify-between items-baseline mt-2">
                    <p className="text-lg font-bold text-amber-500">
                      ฿{currentProductPrice} / หน่วย {isStaffDrink && <span className="text-xs text-orange-400">(รวมดื่ม +50฿)</span>}
                    </p>
                    <p className="text-xl font-extrabold text-amber-300">
                      รวม: ฿{(currentProductPrice * addQuantity).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* ส่วนตั้งค่า ดื่มพนักงาน / ผู้รับดื่ม */}
                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isStaffDrink}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsStaffDrink(checked);
                        if (!checked) {
                          setDrinkerName('');
                          setShowRequestForm(false);
                        }
                      }}
                      className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="text-sm font-bold text-amber-300">🍹 รายการนี้เป็นการดื่มพนักงาน/คนอื่น (+50฿)</span>
                  </label>

                  {isStaffDrink && (
                    <div className="pt-2 space-y-3 border-t border-slate-800/80">
                      {/* ปุ่มสลับโหมด เลือกจากรายชื่อ vs พิมพ์ชื่อคนนอก */}
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientInputMode('select');
                            setDrinkerName('');
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            recipientInputMode === 'select'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          👥 เลือกรายชื่อในร้าน ({approvedRecipients.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientInputMode('custom');
                            setDrinkerName('');
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            recipientInputMode === 'custom'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ✏️ พิมพ์ชื่ออื่น (คนนอก)
                        </button>
                      </div>

                      {recipientInputMode === 'select' ? (
                        <div className="space-y-2.5">
                          {loadingRecipients ? (
                            <p className="text-xs text-slate-400 py-2 text-center">กำลังโหลดรายชื่อ...</p>
                          ) : approvedRecipients.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2 text-center">
                              ยังไม่มีรายชื่อที่ Admin อนุมัติในระบบ
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                              {approvedRecipients.map((person) => {
                                const isChosen = drinkerName === person.name;
                                return (
                                  <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => setDrinkerName(person.name)}
                                    className={`px-3 py-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                                      isChosen
                                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                                        : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-amber-500/50 font-semibold'
                                    }`}
                                  >
                                    <span className="truncate text-xs">{person.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      isChosen
                                        ? 'bg-slate-950/20 text-slate-950'
                                        : person.recipient_type === 'owner'
                                        ? 'bg-orange-500/20 text-orange-300'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}>
                                      {person.recipient_type === 'owner' ? 'Owner' : 'Staff'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* ปุ่มขอเพิ่มรายชื่อเข้าลิสต์ให้ Admin Approve */}
                          <div className="pt-1 border-t border-slate-800/70">
                            {!showRequestForm ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowRequestForm(true);
                                  setRequestFeedback(null);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-dashed border-amber-500/40 text-amber-400 text-xs font-bold transition cursor-pointer"
                              >
                                + ขอเพิ่มรายชื่อพนักงาน/เจ้าของร้าน (ส่งให้ Admin อนุมัติ)
                              </button>
                            ) : (
                              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-amber-400">ส่งคำขอเพิ่มชื่อเข้าลิสต์</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowRequestForm(false)}
                                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={requestName}
                                    onChange={(e) => setRequestName(e.target.value)}
                                    placeholder="ระบุชื่อ..."
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                  />
                                  <select
                                    value={requestType}
                                    onChange={(e) => setRequestType(e.target.value as 'staff' | 'owner')}
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="staff">Staff</option>
                                    <option value="owner">Owner</option>
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  disabled={requestSending || !requestName.trim()}
                                  onClick={handleSendRecipientRequest}
                                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs rounded-lg transition cursor-pointer"
                                >
                                  {requestSending ? 'กำลังส่งคำขอ...' : 'ส่งคำขอให้ Admin Approve'}
                                </button>
                              </div>
                            )}

                            {requestFeedback && (
                              <p className="text-[11px] text-emerald-400 font-semibold mt-1.5 text-center">
                                {requestFeedback}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">พิมพ์ชื่อผู้รับดื่ม (กรณีคนนอก/แขก):</label>
                          <input
                            type="text"
                            value={drinkerName}
                            onChange={(e) => setDrinkerName(e.target.value)}
                            placeholder="ระบุชื่อผู้รับดื่ม..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-medium"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity Control */}
                <div className="space-y-3 pt-1">
                  <label className="text-sm font-bold text-slate-200 block">จำนวนที่ต้องการ:</label>
                  <div className="flex items-center space-x-4">
                    <button
                      type="button"
                      onClick={() => handleQuantityChangeInModal(-1)}
                      className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-2xl text-2xl font-black flex items-center justify-center text-slate-100 transition cursor-pointer shadow-md"
                    >
                      -
                    </button>
                    <span className="text-4xl font-black w-16 text-center text-amber-300">{addQuantity}</span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChangeInModal(1)}
                      className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-2xl text-2xl font-black flex items-center justify-center text-slate-100 transition cursor-pointer shadow-md"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 pt-1">สต็อกคงเหลือในระบบ: <strong className="text-slate-200 text-base">{selectedProductForAdd.stock}</strong></p>
                </div>

                {/* Mixer Selection */}
                {(selectedProductForAdd.category?.toLowerCase().includes('whiskey') || selectedProductForAdd.category?.toLowerCase().includes('เหล้า')) && (
                  <div className="space-y-3 pt-4 border-t border-slate-900">
                    <label className="text-sm font-bold text-amber-400 block">เลือก Mixer (บังคับ/เพิ่มเติม):</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {mixerList.map(mixer => {
                        const isSelected = selectedMixers.includes(mixer);
                        return (
                          <button
                            key={mixer}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMixers(selectedMixers.filter(m => m !== mixer));
                              } else {
                                setSelectedMixers([...selectedMixers, mixer]);
                              }
                            }}
                            className={`p-3 rounded-xl border text-sm font-bold transition flex items-center justify-between cursor-pointer ${
                              isSelected 
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="truncate">{mixer}</span>
                            <span>{isSelected ? '✓' : '+'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-slate-500 text-base font-medium">
                👈 กรุณาคลิกเลือกสินค้าจากรายการด้านซ้าย
              </div>
            )}

            {/* Confirm Add Button */}
            <div className="pt-4 border-t border-slate-900">
              <button
                type="button"
                disabled={!selectedProductForAdd}
                onClick={handleConfirmAddProduct}
                className={`w-full py-4 rounded-2xl font-black text-lg transition shadow-xl ${
                  !selectedProductForAdd
                    ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-98'
                }`}
              >
                {selectedProductForAdd 
                  ? `✓ ยืนยันเพิ่มลงบิล${isStaffDrink && drinkerName ? ` • ${drinkerName}` : ''} (฿${(currentProductPrice * addQuantity).toLocaleString()})`
                  : '✓ ยืนยันเพิ่มลงบิล'}
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}