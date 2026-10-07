'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

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
}: AddProductModalProps) {
  // ดึงค่า mode จาก URL โดยตรงแบบเรียลไทม์
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [priceMode, setPriceMode] = useState<'normal' | 'tournament'>('normal');

  useEffect(() => {
    if (modeParam === 'tournament') {
      setPriceMode('tournament');
    } else {
      setPriceMode('normal');
    }
  }, [modeParam]);

  if (!isOpen) return null;

  // ฟังก์ชันเลือกราคาตามโหมดที่อ่านได้จาก URL
  const getProductPrice = (product: Product) => {
    if (priceMode === 'tournament') {
      return product.tournament_price ?? product.price ?? 0;
    }
    return product.normal_price ?? product.price ?? 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-8 py-5 bg-slate-850 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-black text-amber-400">🛒 เลือกสินค้าจากฐานข้อมูล Supabase (Block {blockId})</h3>
              {/* ป้ายแสดงโหมดราคาที่ดึงมาจาก URL จริงๆ */}
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
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: แบ่งเป็น 2 ฝั่ง ซ้าย (รายการสินค้า) / ขวา (สรุปรายการที่เลือก) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* ฝั่งซ้าย: ค้นหา หมวดหมู่ และ Catalog สินค้า */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4 border-r border-slate-800">
            
            {/* Search Input */}
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            
            {/* Categories Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
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

            {/* Product Grid */}
            <div className="grid grid-cols-2 gap-3">
              {filteredCatalog.map(product => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = !isOutOfStock && product.stock <= product.minStock;
                const isSelected = selectedProductForAdd?.id === product.id;
                const currentPrice = getProductPrice(product); // คำนวณราคาตามโหมดที่ได้จาก URL

                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct({ ...product, price: currentPrice })}
                    className={`p-4 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                      isOutOfStock 
                        ? 'bg-slate-950/40 border-slate-900 opacity-50 cursor-not-allowed' 
                        : isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50'
                        : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          {product.category}
                        </span>
                        <span className="text-amber-400 font-black text-base">฿{currentPrice}</span>
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

          {/* ฝั่งขวา: รายละเอียดสินค้าที่เลือก จำนวน และปุ่มยืนยัน */}
          <div className="w-full md:w-[420px] p-6 bg-slate-950 flex flex-col justify-between space-y-6">
            
            {selectedProductForAdd ? (
              <div className="space-y-6 overflow-y-auto pr-1">
                <div>
                  <span className="text-sm text-amber-400 font-bold uppercase tracking-wide">รายการที่เลือก</span>
                  <h4 className="text-2xl font-black text-slate-100 mt-1">{selectedProductForAdd.name}</h4>
                  <div className="flex justify-between items-baseline mt-2">
                    <p className="text-lg font-bold text-amber-500">฿{selectedProductForAdd.price} / หน่วย</p>
                    <p className="text-xl font-extrabold text-amber-300">
                      รวม: ฿{(selectedProductForAdd.price * addQuantity).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Quantity Control */}
                <div className="space-y-3 pt-2">
                  <label className="text-sm font-bold text-slate-200 block">จำนวนที่ต้องการ:</label>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleQuantityChangeInModal(-1)}
                      className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-2xl text-2xl font-black flex items-center justify-center text-slate-100 transition cursor-pointer shadow-md"
                    >
                      -
                    </button>
                    <span className="text-4xl font-black w-16 text-center text-amber-300">{addQuantity}</span>
                    <button
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
                disabled={!selectedProductForAdd}
                onClick={handleConfirmAddProduct}
                className={`w-full py-4 rounded-2xl font-black text-lg transition shadow-xl ${
                  !selectedProductForAdd
                    ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-98'
                }`}
              >
                {selectedProductForAdd 
                  ? `✓ ยืนยันเพิ่มลงบิล (฿${(selectedProductForAdd.price * addQuantity).toLocaleString()})`
                  : '✓ ยืนยันเพิ่มลงบิล'}
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}