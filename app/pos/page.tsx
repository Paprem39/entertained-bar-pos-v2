'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, Users, Clock, CheckCircle2, X } from 'lucide-react'

export default function POSPage() {
  const [user, setUser] = useState<any>(null)
  const [kickedModal, setKickedModal] = useState(false)
  const router = useRouter()

  // สร้าง Block เริ่มต้น 20 บล็อก
  const [blocks, setBlocks] = useState(() => 
    Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      name: `Block ${index + 1}`,
      status: 'available', // available | occupied
      customer: '',
      billCode: '', // รหัสบิลรูปแบบ ลำดับ-DDMMYYYY-HHMM (เช่น 01-04102026-2215)
      total: 0,
      time: ''
    }))
  )

  // State สำหรับเก็บลำดับบิลประจำวัน และวันที่ล่าสุด เพื่อใช้เช็ครีเซ็ตเมื่อขึ้นวันใหม่
  const [dailyBillSequence, setDailyBillSequence] = useState(1)
  const [lastBillDate, setLastBillDate] = useState('')

  // State สำหรับควบคุม Custom Modal ต่างๆ
  const [openBillModal, setOpenBillModal] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [posTargetBlockId, setPosTargetBlockId] = useState<number | null>(null)
  const [customerInput, setCustomerInput] = useState('')

  const [addBlockModal, setAddBlockModal] = useState(false)
  const [removeBlockModal, setRemoveBlockModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

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
    const interval = setInterval(checkSession, 5000)
    return () => clearInterval(interval)
  }, [])

  // ยืนยันเพิ่ม Block
  const confirmAddBlock = () => {
    const newId = blocks.length + 1;
    setBlocks(prev => [
      ...prev,
      {
        id: newId,
        name: `Block ${newId}`,
        status: 'available',
        customer: '',
        billCode: '',
        total: 0,
        time: ''
      }
    ]);
    setAddBlockModal(false);
  };

  // ยืนยันลด Block
  const confirmRemoveBlock = () => {
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
    setBlocks(prev => prev.slice(0, prev.length - 1));
    setRemoveBlockModal(false);
  };

  // คลิกที่ Block เพื่อเปิดบิลหรือเข้าบิล
  const handleBlockClick = (blockId: number, status: string) => {
    const targetBlock = blocks.find(b => b.id === blockId);
    
    if (status === 'available') {
      setSelectedBlockId(blockId);
      setCustomerInput(''); // เริ่มต้นเป็นค่าว่าง เพื่อบังคับพิมพ์
      setOpenBillModal(true);
    } else {
      setPosTargetBlockId(blockId);
      setAlertMessage(`กำลังเข้าสู่หน้าขายสินค้าของ ${targetBlock?.name} | รหัสบิล: [${targetBlock?.billCode}] | ลูกค้า: ${targetBlock?.customer}`);
    }
  };

  // ยืนยันเปิดบิลด้วยชื่อลูกค้า
  const handleOpenBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlockId || !customerInput.trim()) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const currentDateStr = `${day}${month}${year}`; // รูปแบบ DDMMYYYY สำหรับเช็คเปลี่ยนวัน

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    // ตรวจสอบว่าถ้าเปลี่ยนวันใหม่แล้ว ให้รีเซ็ตลำดับ (Sequence) กลับเป็น 1 ทันที
    let currentSeq = dailyBillSequence;
    if (lastBillDate !== currentDateStr) {
      currentSeq = 1;
      setLastBillDate(currentDateStr);
    }

    const seqStr = String(currentSeq).padStart(2, '0');
    const generatedBillCode = `${seqStr}-${currentDateStr}-${hours}${minutes}`;

    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? {
      ...b,
      status: 'occupied',
      customer: customerInput.trim(),
      billCode: generatedBillCode,
      total: 0,
      time: timeStr
    } : b));

    // เพิ่มลำดับถัดไปสำหรับบิลถัดไปในวันเดียวกัน
    setDailyBillSequence(currentSeq + 1);

    setOpenBillModal(false);
    setCustomerInput('');
    setSelectedBlockId(null);
  };

  return (
    <div className="space-y-6 text-white max-w-7xl mx-auto">
      {/* ส่วนหัวข้อต้อนรับ & ควบคุม Block */}
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

        {/* ปุ่มเพิ่ม/ลด Block */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <button 
            onClick={() => setRemoveBlockModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center space-x-1 border border-slate-700 text-sm font-medium cursor-pointer"
          >
            <Minus size={16} />
            <span>ลด Block</span>
          </button>
          <button 
            onClick={() => setAddBlockModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center space-x-1 text-sm cursor-pointer"
          >
            <Plus size={18} />
            <span>เพิ่ม Block</span>
          </button>
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
                        {block.billCode}
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
                  {isOccupied ? `${block.total.toLocaleString()} ฿` : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- CUSTOM MODAL: ระบุชื่อลูกค้าเปิดบิล (บังคับกรอก) --- */}
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

      {/* --- CUSTOM MODAL: ยืนยันเพิ่ม Block --- */}
      {addBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-amber-500/20">
              <Plus size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-100">ยืนยันการเพิ่ม Block</h3>
            <p className="text-slate-400 text-sm">
              คุณต้องการเพิ่ม Block ใหม่ (Block {blocks.length + 1}) ใช่หรือไม่?
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setAddBlockModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAddBlock}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
              >
                ยืนยันเพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM MODAL: ยืนยันลด Block --- */}
      {removeBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-red-500/20">
              <Minus size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-100">ยืนยันการลด Block</h3>
            <p className="text-slate-400 text-sm">
              คุณต้องการลบบล็อกสุดท้ายทิ้งใช่หรือไม่? (ระบบจะป้องกันไม่ให้ลบบล็อกที่มีลูกค้าเปิดใช้งานอยู่)
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setRemoveBlockModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmRemoveBlock}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-600/20"
              >
                ยืนยันลด Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM MODAL: แจ้งเตือนทั่วไป (Alert) --- */}
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

                // ถ้ามีค่า Block ที่กำลังจะเปิด ให้พุ่งไปที่หน้า POS ของ Block นั้นทันที
                if (targetId) {
                  router.push(`/pos/${targetId}`);
                }
              }}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* --- Popup แจ้งเตือนเมื่อถูกเตะออกจากระบบ (Single Session) --- */}
      {kickedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-red-500/20">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-red-400">เซสชันถูกยกเลิก (Single Session)</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              บัญชีของคุณถูกนำไปเข้าสู่ระบบจากอุปกรณ์หรือแท็บเล็ตเครื่องอื่น ระบบจึงจำเป็นต้องออกจากระบบเพื่อความปลอดภัย
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition duration-200 shadow-lg shadow-red-600/20"
            >
              รับทราบและกลับสู่หน้าเข้าสู่ระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}