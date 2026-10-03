'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type User = {
  id: string
  username: string
  display_name: string
  role: string
  is_active: boolean
  created_at: string
}

export default function AdminHub() {
  const [pendingCount, setPendingCount] = useState(0)
  const [activeUsersCount, setActiveUsersCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchSummaryData()
  }, [])

  const fetchSummaryData = async () => {
    try {
      const { data, error } = await supabase.from('users').select('is_active')
      if (error) throw error
      if (data) {
        const pending = data.filter(u => !u.is_active).length
        const active = data.filter(u => u.is_active).length
        setPendingCount(pending)
        setActiveUsersCount(active)
      }
    } catch (err) {
      console.error('Error fetching summary:', err)
    } finally {
      setLoading(false)
    }
  }

  // รายการเมนูหลักทั้ง 6 บล็อก
  const menuCards = [
    {
      id: 'users',
      title: 'จัดการพนักงาน & สิทธิ์',
      desc: 'อนุมัติสิทธิ์, แก้ไข PIN, เปลี่ยน Role, เปิด-ปิดการใช้งาน',
      icon: '👥',
      badge: pendingCount > 0 ? `${pendingCount} รออนุมัติ` : null,
      badgeColor: 'bg-red-500 text-white',
      path: '/dashboard/users', // เดี๋ยวเราจะทำหน้านี้แยกต่อ หรือทำลิงก์เชื่อมไป
      highlight: pendingCount > 0
    },
    {
      id: 'sales',
      title: 'รายงานยอดขาย & ค่าใช้จ่าย',
      desc: 'สรุปยอดขาย รายวัน, รายเดือน, รายปี พร้อมสถิติมิกเซอร์/เหล้า',
      icon: '📊',
      badge: 'พร้อมใช้งาน',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      path: '#',
    },
    {
      id: 'stock',
      title: 'สต็อกสินค้า & ปรับยอด',
      desc: 'จัดการคลังสินค้าภายในบาร์, เช็กสต็อกคงเหลือ และ Adjust สต็อก',
      icon: '📦',
      badge: 'เร็วๆ นี้',
      badgeColor: 'bg-slate-800 text-slate-400',
      path: '#',
    },
    {
      id: 'logs',
      title: 'Audit Log (ประวัติการทำงาน)',
      desc: 'ตรวจสอบทุกการเคลื่อนไหว: Login/Logout, เปิดบิล, แก้ไขราคา',
      icon: '📝',
      badge: 'ระบบบันทึก',
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      path: '#',
    },
    {
      id: 'profit',
      title: 'ต้นทุน & กำไรเชิงลึก',
      desc: 'วิเคราะห์ต้นทุนสินค้าแต่ละตัว หักลบกำไรสุทธิแบบเรียลไทม์',
      icon: '💰',
      badge: 'ข้อมูลเชิงลึก',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      path: '#',
    },
    {
      id: 'pos-monitor',
      title: 'Realtime POS Monitor',
      desc: 'ส่องหน้าจอแคชเชียร์, ดูบิลที่กำลังเปิดอยู่ หรือสถานะโต๊ะทั้งหมด',
      icon: '🖥️',
      badge: 'Realtime',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      path: '#',
    },
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      
      {/* Top Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-amber-500/20 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              fill 
              sizes="40px"
              className="object-contain rounded-full border border-amber-500/50 bg-slate-950 p-0.5"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-amber-400 tracking-wider">ADMIN HUB</h1>
            <p className="text-xs text-slate-400">ระบบควบคุมและบริหารจัดการบาร์</p>
          </div>
        </div>

        <button 
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 transition shadow-sm"
        >
          ออกจากระบบ
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Welcome Banner ย่อ */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 font-bold uppercase tracking-wider">
              Administrator Panel
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-2">ยินดีต้อนรับผู้ดูแลระบบ</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              เลือกเมนูด้านล่างเพื่อจัดการระบบร้าน พนักงาน สต็อก หรือตรวจสอบยอดขายแบบเรียลไทม์
            </p>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex gap-4 text-center shrink-0 w-full sm:w-auto justify-around sm:justify-start">
            <div>
              <div className="text-xs text-slate-400">พนักงานทั้งหมด</div>
              <div className="text-lg font-bold text-white font-mono">{activeUsersCount} คน</div>
            </div>
            <div className="w-px bg-slate-800"></div>
            <div>
              <div className="text-xs text-slate-400">รออนุมัติสิทธิ์</div>
              <div className="text-lg font-bold text-amber-400 font-mono">{pendingCount} คน</div>
            </div>
          </div>
        </div>

        {/* Menu Cards Grid (บล็อกเมนูใหญ่ 6 ช่อง กดง่ายบนมือถือ) */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">
            เมนูการจัดการหลัก (Management Modules)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {menuCards.map((card) => (
              <div
                key={card.id}
                onClick={() => {
                  if (card.id === 'users') {
                    router.push('/dashboard/users') // ไปหน้าจัดการพนักงานที่เราทำไว้
                  } else {
                    alert(`ฟีเจอร์ "${card.title}" กำลังจะเปิดให้ใช้งานในขั้นตอนถัดไปครับ!`)
                  }
                }}
                className={`group relative bg-slate-900/80 hover:bg-slate-900 border rounded-3xl p-6 transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 ${
                  card.highlight 
                    ? 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]' 
                    : 'border-slate-800 hover:border-amber-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl p-3 bg-slate-950 rounded-2xl border border-slate-800 group-hover:border-amber-500/30 transition">
                      {card.icon}
                    </span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-white group-hover:text-amber-400 transition mb-1.5">
                    {card.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400/80 group-hover:text-amber-400">
                  <span>เข้าสู่ระบบจัดการ</span>
                  <span className="transform group-hover:translate-x-1 transition">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}