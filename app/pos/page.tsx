'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function POSPage() {
  const [user, setUser] = useState<any>(null)
  const [kickedModal, setKickedModal] = useState(false) // 1. สร้าง State ควบคุมการแสดง Popup โดนเตะ
  const router = useRouter()

  useEffect(() => {
    // ฟังก์ชันเช็คสถานะ Session
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth')
        const data = await res.json()

        if (data.authenticated) {
          setUser(data.user)
        } else {
          // ถ้าถูกเตะออก เปิด Modal สวยๆ (ไม่ต้องใส่ router.push ตรงนี้ เพื่อให้ Modal ค้างให้ผู้ใช้เห็นก่อน)
          setKickedModal(true)
        }
      } catch (err) {
        console.error('Session check error:', err)
      }
    }

    // 1. เช็คทันทีเมื่อโหลดหน้าเว็บครั้งแรก
    checkSession()

    // 2. ตั้งเวลาเช็คซ้ำทุกๆ 5 วินาที เพื่อคอยสอดส่องว่าโดนเตะหรือยัง
    const interval = setInterval(checkSession, 5000)

    // เคลียร์ interval ทิ้งเมื่อออกจากหน้าเว็บ
    return () => clearInterval(interval)
  }, []) // เอา router ออกจาก dependency ได้ครับ

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      {/* โค้ดหน้าจอ POS เดิมของคุณ */}
      
      {/* --- 2. Custom Popup แจ้งเตือนเมื่อถูกเตะออก --- */}
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