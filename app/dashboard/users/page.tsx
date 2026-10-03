'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useRouter } from 'next/navigation'

// ฟังก์ชันช่วยแปลง User Agent ให้อ่านง่ายเป็นชื่ออุปกรณ์
const parseDevice = (ua: string = '') => {
  if (!ua) return { device: 'Unknown Device', icon: '💻' }
  
  let device = 'Desktop PC / NB'
  let icon = '💻'

  if (/iphone/i.test(ua)) {
    device = 'iPhone'
    icon = '📱'
  } else if (/ipad/i.test(ua)) {
    device = 'iPad'
    icon = '📱'
  } else if (/android/i.test(ua)) {
    device = /mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet'
    icon = '📱'
  } else if (/macintosh|mac os x/i.test(ua)) {
    device = 'Mac / MacBook'
    icon = '💻'
  }

  return { device, icon }
}

type User = {
  id: string
  username: string
  display_name: string
  pin: string
  role: string
  is_active: boolean
  created_at: string
  approved_at?: string | null
}

type PosSession = {
  id: string
  user_id: string
  terminal_name: string
  status: string
  login_at: string
  user_agent?: string
  ip_address?: string
  users?: {
    display_name: string
    username: string
    role: string
  }
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [sessions, setSessions] = useState<PosSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'approvals' | 'users' | 'monitor'>('approvals')
  
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPin, setEditPin] = useState('')
  const [editRole, setEditRole] = useState('staff')

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    isDanger?: boolean
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  const router = useRouter()

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 3000)
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  // ฟังก์ชันดึงข้อมูล Session ที่กำลังล็อกอินอยู่
  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*, users(display_name, username, role)')
        .eq('is_online', true)
        .order('login_at', { ascending: false })

      if (error) throw error
      if (data) setSessions(data)
    } catch (err) {
      console.error('Error fetching sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchSessions()

    // เปิดระบบ Realtime ฟังการเปลี่ยนแปลงของตาราง pos_sessions ทันที
    const channel = supabase
      .channel('realtime-user-sessions-channel')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_sessions' 
        },
        (payload) => {
          console.log('Realtime change received:', payload)
          // สั่งดึงข้อมูลใหม่ทันทีที่มีการเปลี่ยนแปลงใดๆ เกิดขึ้นในตารางนี้
          fetchSessions()
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleApprove = async (id: string, displayName: string) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('users')
        .update({ is_active: true, approved_at: now })
        .eq('id', id)

      if (error) throw error
      showToast(`อนุมัติสิทธิ์ให้คุณ "${displayName}" เรียบร้อยแล้ว!`)
      fetchUsers()
    } catch (err) {
      console.error(err)
      showToast('เกิดข้อผิดพลาดในการอนุมัติสิทธิ์', 'error')
    }
  }

  const handleToggleActive = async (user: User) => {
    const nextStatus = !user.is_active
    const actionText = nextStatus ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'

    setConfirmModal({
      isOpen: true,
      title: `ยืนยันการ${actionText}`,
      message: `คุณต้องการ${actionText}บัญชีของ "${user.display_name}" ใช่หรือไม่?`,
      isDanger: !nextStatus,
      onConfirm: async () => {
        try {
          const updatePayload: { is_active: boolean; approved_at?: string } = { is_active: nextStatus }
          if (nextStatus && !user.approved_at) {
            updatePayload.approved_at = new Date().toISOString()
          }

          const { error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', user.id)

          if (error) throw error
          showToast(`${actionText}บัญชีของ "${user.display_name}" เรียบร้อยแล้ว`)
          fetchUsers()
        } catch (err) {
          console.error(err)
          showToast('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ', 'error')
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const handleDeleteUser = (user: User) => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการลบบัญชี',
      message: `คุณต้องการลบบัญชีของ "${user.display_name}" ออกจากระบบอย่างถาวรใช่หรือไม่?`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('users').delete().eq('id', user.id)
          if (error) throw error
          showToast('ลบบัญชีเรียบร้อยแล้ว')
          fetchUsers()
        } catch (err) {
          console.error(err)
          showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error')
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  // ฟังก์ชัน Force Logout (ลบ Session ออกจากตารางและเปลี่ยน token เพื่อดีดผู้ใช้ฝั่ง POS ออกทันที)
  const handleForceLogout = (sessionId: string, terminalName: string, userId?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการบังคับออกจากระบบ',
      message: `คุณต้องการตัดการเชื่อมต่อและเคลียร์ Session ของเครื่อง ${terminalName} ใช่หรือไม่?`,
      isDanger: true,
      onConfirm: async () => {
        try {
          // 1. ถ้ามี userId ส่งมาด้วย ให้ทำการเปลี่ยน session_token ในตาราง users เพื่อดีดผู้ใช้ฝั่ง POS ออก
          if (userId) {
            const newRandomToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
            const { error: userError } = await supabase
              .from('users')
              .update({ session_token: newRandomToken })
              .eq('id', userId)

            if (userError) throw userError
          }

          // 2. ลบข้อมูล Session ออกจากตาราง pos_sessions เพื่อเคลียร์การ์ดหน้า Monitor
          const { error } = await supabase
            .from('user_sessions')
            .delete()
            .eq('id', sessionId)

          if (error) throw error
          
          showToast(`บังคับออกจากระบบ ${terminalName} สำเร็จ`)
        } catch (err) {
          console.error(err)
          showToast('เกิดข้อผิดพลาดในการบังคับออก', 'error')
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
      }
    })
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditDisplayName(user.display_name)
    setEditUsername(user.username)
    setEditPin(user.pin || '')
    setEditRole(user.role)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      const updateData: any = {
        display_name: editDisplayName,
        username: editUsername,
        role: editRole,
      }
      
      if (editPin.trim() !== '') {
        if (editPin.length !== 4) {
          showToast('รหัส PIN ต้องเป็นตัวเลข 4 หลัก', 'error')
          return
        }
        updateData.pin = editPin
      }

      const { error } = await supabase.from('users').update(updateData).eq('id', editingUser.id)
      if (error) throw error

      showToast('บันทึกการแก้ไขข้อมูลสำเร็จ!')
      setEditingUser(null)
      fetchUsers()
    } catch (err) {
      console.error(err)
      showToast('เกิดข้อผิดพลาดในการอัปเดตข้อมูล', 'error')
    }
  }

  const pendingUsers = users.filter(u => !u.is_active)
  const allUsers = users

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      {toast.show && (
        <div className="fixed top-20 right-6 z-50 animate-bounce transition duration-300">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-slate-900 border-amber-500/50 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
              : 'bg-slate-900 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          }`}>
            <span>{toast.type === 'success' ? '✨' : '⚠️'}</span>
            {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-amber-500/20 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>←</span> กลับหน้าหลัก
          </button>
          <div className="h-6 w-px bg-slate-800"></div>
          <div>
            <h1 className="text-base font-bold text-amber-400 tracking-wider">จัดการพนักงาน & สิทธิ์</h1>
            <p className="text-xs text-slate-400">อนุมัติและกำหนดสิทธิ์ผู้ใช้งานในระบบ</p>
          </div>
        </div>

        <button 
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
        >
          ออกจากระบบ
        </button>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'approvals' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            คำขออนุมัติสิทธิ์ 
            {pendingUsers.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-semibold transition border-b-2 whitespace-nowrap ${
              activeTab === 'users' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            รายชื่อพนักงานทั้งหมด ({allUsers.length})
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'monitor' 
                ? 'border-amber-500 text-amber-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Realtime POS Monitor & Session Control
          </button>
        </div>

        {/* Tab 1: คำขออนุมัติสิทธิ์ */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-bold text-amber-300 mb-1">คำขอสิทธิ์เข้าใช้งานใหม่ที่รอการตรวจสอบ</h2>
              <p className="text-xs text-slate-400 mb-6">อนุมัติให้พนักงานหรือแคชเชียร์สามารถใช้รหัส PIN ล็อกอินเข้าสู่ระบบ POS ได้</p>

              {loading ? (
                <div className="text-center py-12 text-slate-500">กำลังโหลดข้อมูล...</div>
              ) : pendingUsers.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-sm">
                  ✨ ไม่มีรายการคำขอสิทธิ์ที่ค้างอยู่ ณ ขณะนี้
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold uppercase">
                            {user.role}
                          </span>
                          <span className="text-xs text-amber-200/70 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">
                            🕒 {formatDateTime(user.created_at)}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{user.display_name}</h3>
                        <p className="text-xs text-slate-400 mb-4 font-mono">Username: @{user.username}</p>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-slate-900">
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="flex-1 py-2 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 font-semibold text-xs rounded-xl transition"
                        >
                          ปฏิเสธ
                        </button>
                        <button
                          onClick={() => handleApprove(user.id, user.display_name)}
                          className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                        >
                          อนุมัติสิทธิ์
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: รายชื่อพนักงานทั้งหมด */}
        {activeTab === 'users' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-amber-300 mb-1">รายชื่อผู้ใช้งานทั้งหมดในระบบ</h2>
            <p className="text-xs text-slate-400 mb-6">จัดการสิทธิ์ แก้ไขข้อมูล หรือเปิด/ปิดการใช้งานพนักงาน แคชเชียร์ และแอดมิน</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">ชื่อที่แสดง</th>
                    <th className="py-3 px-4">USERNAME</th>
                    <th className="py-3 px-4">ตำแหน่ง (ROLE)</th>
                    <th className="py-3 px-4">วันที่ขอสิทธิ์</th>
                    <th className="py-3 px-4">วันที่อนุมัติ</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-950/40 transition">
                      <td className="py-4 px-4 font-semibold text-white">{user.display_name}</td>
                      <td className="py-4 px-4 font-mono text-slate-400">@{user.username}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                          user.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : user.role === 'cashier'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400 font-mono">{formatDateTime(user.created_at)}</td>
                      <td className="py-4 px-4 text-xs text-amber-400 font-mono">{formatDateTime(user.approved_at)}</td>
                      <td className="py-4 px-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ใช้งานปกติ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> ปิดใช้งาน
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(user)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg transition"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-3 py-1.5 border text-xs font-semibold rounded-lg transition ${
                            user.is_active 
                              ? 'bg-amber-950/30 hover:bg-amber-900/50 border-amber-800/40 text-amber-300' 
                              : 'bg-emerald-950/30 hover:bg-emerald-900/50 border-emerald-800/40 text-emerald-300'
                          }`}
                        >
                          {user.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/50 border border-red-800/30 text-red-300 text-xs font-semibold rounded-lg transition"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Realtime POS Monitor & Session Control (ดึงข้อมูลจริงจากตาราง pos_sessions) */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-amber-300 mb-1">Realtime POS Monitor & Session Control</h2>
                  <p className="text-xs text-slate-400">แสดงผลพนักงานที่กำลังเข้าสู่ระบบ POS อยู่ในขณะนี้แบบสดๆ</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Connected
                  </span>
                </div>
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-16 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-sm">
                  💤 ยังไม่มีพนักงานล็อกอินเข้าใช้งานเครื่อง POS ในขณะนี้
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => {
                  // แปลง user_agent ให้เป็นชื่ออุปกรณ์และไอคอนที่อ่านง่าย
                  const deviceInfo = parseDevice(session.user_agent)

                  return (
                    <div key={session.id} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                            <span>{deviceInfo.icon}</span> {deviceInfo.device}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded border border-emerald-500/20 font-bold uppercase">
                            ONLINE
                          </span>
                        </div>

                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                          <h3 className="text-sm font-bold text-white">
                            {session.users?.display_name || 'ไม่พบชื่อผู้ใช้งาน'}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono">
                            Username: @{session.users?.username || '-'} ({session.users?.role || '-'})
                          </p>
                          
                          {/* ส่วนแสดง IP Address และ เวลาที่ Login */}
                          <div className="pt-2 mt-2 border-t border-slate-800/60 text-[11px] space-y-1 font-mono text-slate-300">
                            <div className="flex justify-between">
                              <span className="text-slate-500">IP Address:</span>
                              <span className="text-cyan-400">{session.ip_address || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Login เมื่อ:</span>
                              <span className="text-amber-200/80">{formatDateTime(session.login_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleForceLogout(session.id, deviceInfo.device, session.user_id)}
                        className="w-full py-2 bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 text-xs font-semibold rounded-xl transition shadow-lg"
                      >
                        Force Logout / เคลียร์ Session
                      </button>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-amber-400">แก้ไขข้อมูลพนักงาน</h3>
              <p className="text-xs text-slate-400">กำหนดสิทธิ์ ชื่อ หรือรหัส PIN ใหม่สำหรับพนักงานคนนี้</p>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ชื่อที่แสดง (Display Name)</label>
                <input 
                  type="text" 
                  value={editDisplayName} 
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                <input 
                  type="text" 
                  value={editUsername} 
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ตั้ง PIN ใหม่ (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  placeholder="••••"
                  value={editPin} 
                  onChange={(e) => setEditPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 tracking-widest font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ตำแหน่ง (Role)</label>
                <select 
                  value={editRole} 
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="staff">Staff (พนักงานทั่วไป)</option>
                  <option value="cashier">Cashier (แคชเชียร์)</option>
                  <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl transition shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-amber-400 text-xl font-bold border border-slate-700">
              {confirmModal.isDanger ? '⚠️' : '❓'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">{confirmModal.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-2.5 font-bold text-xs rounded-xl transition ${
                  confirmModal.isDanger 
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                }`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}