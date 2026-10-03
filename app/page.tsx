'use client'

import { useState } from 'react'
import { supabase } from './supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  // State สำหรับ Modal สมัครขอสิทธิ์ (Register Request)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [regUsername, setRegUsername] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regPin, setRegPin] = useState('')
  const [regRole, setRegRole] = useState('staff')
  const [regLoading, setRegLoading] = useState(false)

  // State สำหรับ Modal แจ้งเตือนเมื่อตรวจพบการเข้าสู่ระบบค้างไว้ (Single Session Collision)
  const [kickNoticeModal, setKickNoticeModal] = useState(false)
  const [loginRole, setLoginRole] = useState('')

  const router = useRouter()

  const handlePinInput = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num)
    }
  }

  const handleClearPin = () => {
    setPin('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'รหัส PIN ไม่ถูกต้อง หรือบัญชีถูกระงับการใช้งาน')
        setLoading(false)
        return
      }

      setLoginRole(data.user.role)

      // ถ้าตรวจพบว่ามีการเตะเครื่องเก่าออก ให้เปิด Custom Modal แทน alert()
      if (data.wasKickedOut) {
        setKickNoticeModal(true)
        setLoading(false)
      } else {
        redirectUser(data.user.role)
      }

    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ')
      setLoading(false)
    }
  }

  const redirectUser = (role: string) => {
    if (role === 'admin') {
      router.push('/dashboard')
    } else {
      router.push('/pos')
    }
  }

  // ฟังก์ชันส่งคำขอสมัครสิทธิ์
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    setErrorMessage('')

    if (regPin.length !== 4) {
      alert('กรุณากรอกรหัส PIN 4 หลัก')
      setRegLoading(false)
      return
    }

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', regUsername)
        .single()

      if (existingUser) {
        alert('ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น')
        setRegLoading(false)
        return
      }

      const { error } = await supabase
        .from('users')
        .insert([
          {
            username: regUsername,
            display_name: regDisplayName,
            pin_hash: regPin,
            password_hash: 'PENDING_APPROVAL',
            role: regRole,
            is_active: false
          }
        ])

      if (error) throw error

      setSuccessMessage('ส่งคำขอสมัครสิทธิ์สำเร็จ! กรุณารอให้ Admin อนุมัติการเข้าใช้งาน')
      setShowRegisterModal(false)
      setRegUsername('')
      setRegDisplayName('')
      setRegPin('')

    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการส่งคำขอสมัคร')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] flex flex-col items-center justify-center p-4 relative">
      
      <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 w-full max-w-md shadow-[0_0_50px_rgba(217,119,6,0.15)] relative">
        
        {/* โลโก้ร้าน */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 relative mb-3 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]">
            <Image 
              src="/logo.png" 
              alt="Entertained Bar Logo" 
              fill
              sizes="(max-width: 768px) 96px, 96px"
              priority
              className="object-contain rounded-full border-2 border-amber-500/50 p-1 bg-slate-950"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 tracking-wider">
            ENTERTAINED BAR
          </h1>
          <p className="text-slate-400 text-xs tracking-widest mt-1">GOOD DRINKS • GOOD MUSIC • GOOD TIMES</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 text-sm rounded-xl text-center">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-sm rounded-xl text-center">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-amber-200/80 text-xs font-semibold uppercase tracking-wider mb-2">ชื่อผู้ใช้งาน (USERNAME)</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เช่น cashier1, staff1"
              required
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition shadow-inner"
            />
          </div>

          <div>
            <label className="block text-amber-200/80 text-xs font-semibold uppercase tracking-wider mb-2">รหัส PIN 4 หลัก</label>
            <input 
              type="password" 
              maxLength={4}
              value={pin}
              readOnly
              placeholder="••••"
              className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-center tracking-[1em] text-xl focus:outline-none focus:border-amber-500 transition shadow-inner"
            />
          </div>

          {/* แผงปุ่มกด PIN */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinInput(num)}
                className="py-3.5 bg-slate-800/80 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-bold text-lg rounded-xl border border-slate-700/50 transition shadow-md"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearPin}
              className="py-3.5 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 font-semibold rounded-xl transition text-sm shadow-md"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handlePinInput('0')}
              className="py-3.5 bg-slate-800/80 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-bold text-lg rounded-xl border border-slate-700/50 transition shadow-md"
            >
              0
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-extrabold rounded-xl transition text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center"
            >
              {loading ? 'กำลังเข้า...' : 'LOGIN'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="text-amber-400 hover:text-amber-300 text-xs tracking-wide underline transition"
          >
            + ลงทะเบียนขอสิทธิ์ใช้งานพนักงานใหม่ (รอ Admin อนุมัติ)
          </button>
        </div>

      </div>

      {/* --- Modal แจ้งเตือนเมื่อมีการ Login ซ้ำ (แทน alert แบบเดิม) --- */}
      {kickNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-amber-500/20">
              🛡️
            </div>
            <h3 className="text-xl font-bold text-amber-400">ตรวจพบการใช้งานค้างอยู่</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              ตรวจพบการเข้าสู่ระบบค้างไว้จากอุปกรณ์อื่น ระบบได้ทำการเคลียร์ Session เดิมและนำคุณเข้าสู่ระบบแทนเรียบร้อยแล้ว
            </p>
            <button
              onClick={() => redirectUser(loginRole)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              ตกลง (เข้าสู่ระบบ)
            </button>
          </div>
        </div>
      )}

      {/* Modal สำหรับกรอกฟอร์มขอลงทะเบียนสิทธิ์ */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-amber-400 mb-1">ลงทะเบียนขอสิทธิ์เข้าใช้งาน</h2>
            <p className="text-slate-400 text-xs mb-4">ข้อมูลจะถูกส่งไปให้ Admin ทำการอนุมัติก่อนเปิดใช้งานจริง</p>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs mb-1">ชื่อผู้ใช้งาน (Username สำหรับ Login)</label>
                <input 
                  type="text" 
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="เช่น staff_lek"
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs mb-1">ชื่อที่แสดง (Display Name)</label>
                <input 
                  type="text" 
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="เช่น น้องเล็ก"
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs mb-1">ตั้งรหัส PIN 4 หลัก</label>
                <input 
                  type="password" 
                  maxLength={4}
                  value={regPin}
                  onChange={(e) => setRegPin(e.target.value)}
                  placeholder="••••"
                  required
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-center tracking-widest text-lg focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs mb-1">เลือกตำแหน่งสิทธิ์ (Role)</label>
                <select 
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="staff">Staff (พนักงานทั่วไป)</option>
                  <option value="cashier">Cashier (แคชเชียร์)</option>
                  <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition"
                >
                  {regLoading ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}