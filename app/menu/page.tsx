'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';

interface CustomerMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export default function MenuPage() {
  const [items, setItems] = useState<CustomerMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['ทั้งหมด']);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerMenu = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [{ data: catData, error: catErr }, { data: prodData, error: prodErr }] =
          await Promise.all([
            supabase.from('categories').select('*'),
            supabase.from('products').select('id, name, normal_price, category_id, is_active'),
          ]);

        if (catErr) throw catErr;
        if (prodErr) throw prodErr;

        const activeCats = (catData || []).filter((c: any) => c.is_active !== false);
        activeCats.sort((a: any, b: any) => Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999));

        const catMap: Record<string, string> = {};
        activeCats.forEach((c: any) => {
          if (c.id && c.name) {
            catMap[String(c.id)] = String(c.name);
          }
        });

        setCategories(['ทั้งหมด', ...activeCats.map((c: any) => String(c.name))]);

        const activeProds = (prodData || [])
          .filter((p: any) => p.is_active !== false)
          .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));

        // คัดเฉพาะฟิลด์ที่ลูกค้าควรเห็น: ชื่อสินค้า, ราคาขายปกติ, หมวดหมู่
        const formatted: CustomerMenuItem[] = activeProds.map((p: any) => ({
          id: String(p.id),
          name: String(p.name || ''),
          price: Number(p.normal_price || 0),
          category: catMap[String(p.category_id)] || 'อื่นๆ',
        }));

        setItems(formatted);
      } catch (err: any) {
        console.error('Error loading customer menu:', err);
        setErrorMsg(err?.message || 'ไม่สามารถโหลดรายการเมนูได้ในขณะนี้');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerMenu();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchCat = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
      const matchSearch = !q || item.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // จัดกลุ่มตามหมวดหมู่เมื่อเลือก "ทั้งหมด" และไม่ได้พิมพ์ค้นหา
  const groupedSections = useMemo(() => {
    if (selectedCategory !== 'ทั้งหมด' || searchQuery.trim() !== '') {
      return null;
    }
    const map = new Map<string, CustomerMenuItem[]>();
    filteredItems.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries());
  }, [filteredItems, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-14">
      {/* Header สไตล์หรูหราสบายตา */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 backdrop-blur-md border-b border-amber-500/20 px-4 pt-5 pb-4">
        <div className="max-w-xl mx-auto space-y-3.5">
          <div className="text-center">
            <p className="text-[10px] font-bold tracking-[0.28em] text-amber-400/80 uppercase">
              DIGITAL MENU
            </p>
            <h1 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 mt-0.5">
              ENTERTAINED BAR
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              รายการเครื่องดื่มและเมนูอาหาร (ราคาปกติ)
            </p>
          </div>

          {/* ช่องค้นหา */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อเมนู..."
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-amber-500/70 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
          />

          {/* แถบเลือกหมวดหมู่ */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* เนื้อหารายการเมนู */}
      <main className="max-w-xl mx-auto px-4 pt-5">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm font-semibold">
            กำลังโหลดรายการเมนู...
          </div>
        ) : errorMsg ? (
          <div className="py-16 text-center bg-slate-900/70 border border-rose-500/30 rounded-2xl p-6 text-rose-300 text-sm">
            {errorMsg}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            ไม่พบรายการเมนูที่ค้นหา
          </div>
        ) : groupedSections ? (
          <div className="space-y-7">
            {groupedSections.map(([catName, catItems]) => (
              <section key={catName} className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-black tracking-wider text-amber-400 uppercase">
                    {catName}
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
                </div>

                <div className="space-y-2">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900/75 border border-slate-800/90 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-4"
                    >
                      <span className="text-sm sm:text-base font-bold text-slate-100 leading-snug">
                        {item.name}
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-amber-400 tabular-nums shrink-0">
                        ฿{item.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/75 border border-slate-800/90 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-bold text-slate-100 truncate">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.category}</p>
                </div>
                <span className="text-base sm:text-lg font-black font-mono text-amber-400 tabular-nums shrink-0">
                  ฿{item.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}