'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';

interface PublicMenuItem {
  id: string;
  name: string;
  normal_price: number;
  tournament_price: number;
  category: string;
  isAvailable: boolean;
}

export default function PublicCustomerMenuPage() {
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['ทั้งหมด']);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priceMode, setPriceMode] = useState<'normal' | 'tournament'>('normal');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        setLoading(true);
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
              stocks ( current_qty )
            `)
            .eq('is_active', true)
            .order('name', { ascending: true }),
        ]);

        const catMap: Record<string, string> = {};
        (catData || []).forEach((c: any) => {
          catMap[c.id] = c.name;
        });
        setCategories(['ทั้งหมด', ...(catData || []).map((c: any) => c.name)]);

        // ส่งออกเฉพาะสถานะพร้อมขาย (true/false) โดยไม่เก็บตัวเลข stock ไว้ใน state ของลูกค้า
        const mapped: PublicMenuItem[] = (prodData || []).map((p: any) => {
          const rawQty =
            Array.isArray(p.stocks) && p.stocks.length > 0
              ? Number(p.stocks[0].current_qty ?? 0)
              : Number(p.stocks?.current_qty ?? 0);

          return {
            id: p.id,
            name: p.name,
            normal_price: Number(p.normal_price || 0),
            tournament_price: Number(p.tournament_price ?? p.normal_price ?? 0),
            category: p.categories?.name || catMap[p.category_id] || 'อื่นๆ',
            isAvailable: rawQty > 0,
          };
        });

        setItems(mapped);
      } catch (err) {
        console.error('Error loading public menu:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchCat = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
      const matchSearch = !q || item.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-10">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-5 sticky top-0 z-20 shadow-lg">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-amber-400 tracking-wide">
                Entertained bar
              </h1>
              <p className="text-xs text-slate-400">รายการเครื่องดื่มและเมนูอาหาร</p>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPriceMode('normal')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  priceMode === 'normal' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                ราคาปกติ
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('tournament')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  priceMode === 'tournament' ? 'bg-orange-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                วันแข่ง
              </button>
            </div>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อเครื่องดื่ม / เมนู..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
          />

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="max-w-3xl mx-auto px-4 pt-5">
        {loading ? (
          <div className="py-16 text-center text-slate-400 font-bold text-sm">
            กำลังโหลดรายการเมนู...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            ไม่พบรายการที่ค้นหา
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const displayPrice =
                priceMode === 'tournament' ? item.tournament_price : item.normal_price;
              return (
                <div
                  key={item.id}
                  className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 ${
                    !item.isAvailable ? 'opacity-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      {item.category}
                    </span>
                    <h2 className="font-bold text-slate-100 text-base mt-1 truncate">
                      {item.name}
                    </h2>
                    {!item.isAvailable && (
                      <span className="inline-block mt-1 text-[11px] font-bold text-rose-400">
                        สินค้าหมดชั่วคราว
                      </span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-amber-400 font-mono">
                      ฿{displayPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}