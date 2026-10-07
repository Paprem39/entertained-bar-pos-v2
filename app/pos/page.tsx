'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Minus, Users, Clock, CheckCircle2, X, Tag } from 'lucide-react'
import { supabase } from '../supabase'

// 1. สร้างคอมโพเนนต์ย่อยสำหรับจัดการ Logic ของหน้า POS ทั้งหมด
function POSContent() {
  const [user, setUser] = useState<any>(null)
  const [kickedModal, setKickedModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // State สำหรับเก็บข้อมูล Block ทั้งหมดจาก Supabase
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // อ่านค่า mode จาก URL มาเป็นค่าเริ่มต้นทันที
  const modeParam = searchParams.get('mode')
  const [priceMode, setPriceMode] = useState<'normal' | 'tournament'>(
    modeParam === 'tournament' ? 'tournament' : 'normal'
  )

  // อัปเดต state ตาม URL หากมีการเปลี่ยนแปลงภายนอก
  useEffect(() => {
    if (modeParam === 'tournament') {
      setPriceMode('tournament')
    } else {
      setPriceMode('normal')
    }
  }, [modeParam])

  // ฟังก์ชันเปลี่ยนโหมด พร้อมอัปเดต URL ทันทีโดยไม่รีเฟรชหน้าเว็บ
  const handlePriceModeChange = (mode: 'normal' | 'tournament') => {
    setPriceMode(mode)
    router.replace(`/pos?mode=${mode}`, { scroll: false })
  }

  // State สำหรับควบคุม Custom Modal ต่างๆ
  const [openBillModal, setOpenBillModal] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [posTargetBlockId, setPosTargetBlockId] = useState<number | null>(null)
  const [customerInput, setCustomerInput] = useState('')

  const [addBlockModal, setAddBlockModal] = useState(false)
  const [removeBlockModal, setRemoveBlockModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  // 1. ตรวจสอบ Session และ ดึงข้อมูล Blocks พร้อมคำนวณยอดเงินจากตาราง bills
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth')
        const data = await res.json()

        if (data.authenticated) {
          setUser(data.user)
        } else {
          setKickedModal(true)
        }
      } catch (err) {
        console.error('Session check error:', err)
      }
    }

    checkSession()
    fetchBlocksFromDB()

    const interval = setInterval(checkSession, 5000)
    return () => clearInterval(interval)
  }, [])

  // ฟังก์ชันดึงข้อมูล Block และดึงยอดรวมจากตาราง bills มาแสดงผล
  const fetchBlocksFromDB = async () => {
    try {
      const { data, error } = await supabase
        .from('pos_blocks')
        .select('*')
        .order('id', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        const updatedBlocks = await Promise.all(
          data.map(async (block) => {
            if (block.status === 'occupied' && block.bill_code && block.bill_code !== '-') {
              const { data: billData } = await supabase
                .from('bills')
                .select('id')
                .eq('bill_number', block.bill_code)
                .single()

              if (billData) {
                const { data: itemsData } = await supabase
                  .from('bill_items')
                  .select('unit_price, qty')
                  .eq('bill_id', billData.id)

                if (itemsData && itemsData.length > 0) {
                  const calculatedTotal = itemsData.reduce(
                    (sum, item) => sum + (item.unit_price || 0) * (item.qty || 0),
                    0
                  )
                  return { ...block, total: calculatedTotal }
                }
              }
            }
            return block;
          })
        );

        setBlocks(updatedBlocks)
      } else {
        await initializeDefaultBlocks()
      }
    } catch (err) {
      console.error('Error fetching blocks:', err)
    } finally {
      setLoading(false)
    }
  }

  // สร้างข้อมูลเริ่มต้น 20 บล็อกแรก กรณีตารางยังว่างเปล่า
  const initializeDefaultBlocks = async () => {
    const initialBlocks = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      name: `Block ${index + 1}`,
      status: 'available',
      customer: '',
      bill_code: '',
      total: 0,
      time: ''
    }))

    const { error } = await supabase.from('pos_blocks').upsert(initialBlocks)
    if (!error) {
      setBlocks(initialBlocks)
    }
  }

  // ยืนยันเพิ่ม Block
  const confirmAddBlock = async () => {
    const newId = blocks.length + 1;
    const newBlock = {
      id: newId,
      name: `Block ${newId}`,
      status: 'available',
      customer: '',
      bill_code: '',
      total: 0,
      time: ''
    };

    const { error } = await supabase.from('pos_blocks').insert([newBlock]);
    if (error) {
      console.error('Error adding block:', error);
      setAlertMessage('ไม่สามารถเพิ่ม Block ได้');
    } else {
      setBlocks(prev => [...prev, newBlock]);
    }
    setAddBlockModal(false);
  };

  // ยืนยันลด Block
  const confirmRemoveBlock = async () => {
    if (blocks.length <= 1) {
      setAlertMessage("ต้องมีอย่างน้อย 1 บล็อกครับ");
      setRemoveBlockModal(false);
      return;
    }
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock.status === 'occupied') {
      setAlertMessage(`ไม่สามารถลด ${lastBlock.name} ได้ เนื่องจากมีลูกค้า (${lastBlock.customer}) กำลังใช้งานอยู่`);
      setRemoveBlockModal(false);
      return;
    }

    const { error } = await supabase.from('pos_blocks').delete().eq('id', lastBlock.id);
    if (error) {
      console.error('Error removing block:', error);
      setAlertMessage('ไม่สามารถลด Block ได้');
    } else {
      setBlocks(prev => prev.slice(0, prev.length - 1));
    }
    setRemoveBlockModal(false);
  };

  // คลิกที่ Block เพื่อเปิดบิลหรือเข้าบิล (พ่วงส่ง priceMode ไปด้วยทาง query parameter)
  const handleBlockClick = (blockId: number, status: string) => {
    const targetBlock = blocks.find(b => b.id === blockId);
    
    if (status === 'available') {
      setSelectedBlockId(blockId);
      setCustomerInput('');
      setOpenBillModal(true);
    } else {
      setPosTargetBlockId(blockId);
      setAlertMessage(`กำลังเข้าสู่หน้าขายสินค้าของ ${targetBlock?.name} | โหมดราคา: [${priceMode === 'tournament' ? 'ราคาวันแข่ง' : 'ราคาปกติ'}] | รหัสบิล: [${targetBlock?.bill_code}]`);
    }
  };

  // ยืนยันเปิดบิลด้วยชื่อลูกค้า
  const handleOpenBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlockId || !customerInput.trim()) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const currentDateStr = `${day}${month}${year}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const { data: existingBlocks, error: fetchError } = await supabase
      .from('pos_blocks')
      .select('bill_code');

    let todayBillCount = 0;

    if (!fetchError && existingBlocks) {
      existingBlocks.forEach(b => {
        if (b.bill_code) {
          const parts = b.bill_code.split('-');
          if (parts.length === 3 && parts[1] === currentDateStr) {
            todayBillCount++;
          }
        }
      });
    }

    const nextSeq = todayBillCount + 1;
    const seqStr = String(nextSeq).padStart(2, '0');
    const generatedBillCode = `${seqStr}-${currentDateStr}-${hours}${minutes}`;

    const updatedData = {
      status: 'occupied',
      customer: customerInput.trim(),
      bill_code: generatedBillCode,
      total: 0,
      time: timeStr
    };

    const { error } = await supabase
      .from('pos_blocks')
      .update(updatedData)
      .eq('id', selectedBlockId);

    if (error) {
      console.error('Error opening bill:', error);
      setAlertMessage('ไม่สามารถเปิดบิลได้ กรุณาลองใหม่อีกครั้ง');
    } else {
      setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, ...updatedData } : b));
    }

    setOpenBillModal(false);
    setCustomerInput('');
    setSelectedBlockId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-amber-400 font-medium">
        กำลังโหลดข้อมูลบล็อก POS...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white max-w-7xl mx-auto">
      {/* ส่วนหัวข้อต้อนรับ & ควบคุม Block พร้อมปุ่มสลับโหมดราคา */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-xl gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            ระบบจัดการบล็อกขาย (POS Dashboard)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ยินดีต้อนรับคุณ <span className="text-amber-400 font-semibold">{user?.display_name || 'พนักงาน'}</span> 
            {user?.role && <span className="ml-2 px-2 py-0.5 bg-slate-800 border border-slate-700 text-xs rounded-md text-amber-300">สถานะ: {user.role}</span>}
          </p>
        </div>

        {/* จุดที่เพิ่ม: ปุ่มสลับโหมดราคาปกติ / ราคาวันแข่ง และปุ่มเพิ่ม-ลด Block */}
        <div className="flex flex-wrap items-center gap-3 justify-end w-full md:w-auto">
          
          {/* ส่วนสลับโหมดราคา (Normal vs Tournament) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => handlePriceModeChange('normal')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                priceMode === 'normal'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag size={14} />
              <span>ราคาปกติ (Normal)</span>
            </button>
            <button
              onClick={() => handlePriceModeChange('tournament')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                priceMode === 'tournament'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag size={14} />
              <span>ราคาวันแข่ง (Tournament)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setRemoveBlockModal(true)}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center space-x-1 border border-slate-700 text-sm font-medium cursor-pointer"
            >
              <Minus size={16} />
              <span>ลด Block</span>
            </button>
            <button 
              onClick={() => setAddBlockModal(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center space-x-1 text-sm cursor-pointer"
            >
              <Plus size={18} />
              <span>เพิ่ม Block</span>
            </button>
          </div>

        </div>
      </div>

      {/* Grid แสดงสถานะ Block ทั้งหมด */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {blocks.map((block) => {
          const isOccupied = block.status === 'occupied';
          return (
            <div
              key={block.id}
              onClick={() => handleBlockClick(block.id, block.status)}
              className={`
                relative rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between min-h-[150px]
                ${isOccupied 
                  ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/40 hover:border-amber-500 shadow-lg shadow-amber-500/5' 
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-slate-200">{block.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center space-x-1 ${
                  isOccupied ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {isOccupied ? <><Users size={12} /><span>มีลูกค้า</span></> : <><CheckCircle2 size={12} /><span>ว่าง</span></>}
                </span>

              </div>

              <div className="my-2">
                {isOccupied ? (
                  <div className="space-y-1">
                    <div className="text-amber-300 font-medium text-sm truncate">
                      {block.customer}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-amber-400/90 font-semibold bg-slate-950 px-2 py-0.5 rounded border border-amber-500/20 tracking-wider">
                        {block.bill_code}
                      </span>
                      <span className="flex items-center"><Clock size={12} className="mr-1"/> {block.time}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs py-3 text-center italic">
                    คลิกเพื่อเปิดบิลใหม่
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">ยอดรวม</span>
                <span className={`font-bold font-mono ${isOccupied ? 'text-amber-400 text-base' : 'text-slate-600'}`}>
                  {isOccupied ? `${(block.total || 0).toLocaleString()} ฿` : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Modal เปิดบิล --- */}
      {openBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100">เปิดบิล Block {selectedBlockId}</h3>
              <button onClick={() => setOpenBillModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleOpenBillSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">ระบุชื่อลูกค้าสำหรับเปิดบิลนี้:</label>
                <input
                  type="text"
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  placeholder="กรุณาใส่ชื่อลูกค้า..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-medium"
                  autoFocus
                  required
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenBillModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!customerInput.trim()}
                  className={`flex-1 py-3 font-bold rounded-xl transition shadow-lg ${
                    customerInput.trim() 
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20 cursor-pointer' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  ยืนยันเปิดบิล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal เพิ่ม Block --- */}
      {addBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-amber-500/20">
              <Plus size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-100">ยืนยันการเพิ่ม Block</h3>
            <p className="text-slate-400 text-sm">คุณต้องการเพิ่ม Block ใหม่ (Block {blocks.length + 1}) ใช่หรือไม่?</p>
            <div className="flex space-x-3 pt-2">
              <button onClick={() => setAddBlockModal(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition">ยกเลิก</button>
              <button onClick={confirmAddBlock} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20">ยืนยันเพิ่ม</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal ลด Block --- */}
      {removeBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-red-500/20">
              <Minus size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-100">ยืนยันการลด Block</h3>
            <p className="text-slate-400 text-sm">คุณต้องการลบบล็อกสุดท้ายทิ้งใช่หรือไม่?</p>
            <div className="flex space-x-3 pt-2">
              <button onClick={() => setRemoveBlockModal(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition">ยกเลิก</button>
              <button onClick={confirmRemoveBlock} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-600/20">ยืนยันลด Block</button>
            </div>
          </div>
        </div>
      )}

      {/* --- แจ้งเตือนทั่วไป (ส่ง query param priceMode ไปยังหน้าย่อยเมื่อกดเข้า block) --- */}
      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <h3 className="text-lg font-bold text-amber-400">แจ้งเตือนระบบ</h3>
            <p className="text-slate-300 text-sm">{alertMessage}</p>
            <button
              onClick={() => {
                const targetId = posTargetBlockId;
                setAlertMessage(null);
                setPosTargetBlockId(null);
                if (targetId) router.push(`/pos/${targetId}?mode=${priceMode}`);
              }}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* --- Single Session Modal --- */}
      {kickedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <h3 className="text-xl font-bold text-red-400">เซสชันถูกยกเลิก (Single Session)</h3>
            <p className="text-gray-300 text-sm">บัญชีของคุณถูกนำไปเข้าสู่ระบบจากอุปกรณ์อื่น</p>
            <button onClick={() => router.push('/')} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition">
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// 2. Export หน้าหลักโดยห่อหุ้มด้วย Suspense เพื่อแก้ปัญหา Prerender Error บน Vercel
export default function POSPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px] text-amber-400 font-medium">กำลังโหลด...</div>}>
      <POSContent />
    </Suspense>
  )
}