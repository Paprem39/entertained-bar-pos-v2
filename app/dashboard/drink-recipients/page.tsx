'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { useRouter } from 'next/navigation'

type DrinkRecipient = {
  id: string
  name: string
  recipient_type: 'staff' | 'owner'
  status: 'pending' | 'approved' | 'rejected'
  is_active: boolean
  created_at: string
  approved_at: string | null
}

export default function DrinkRecipientsPage() {
  const router = useRouter()

  const [recipients, setRecipients] = useState<DrinkRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ฟอร์มส่งคำขอเพิ่มชื่อผู้รับดื่ม
  const [newName, setNewName] = useState('')
  const [recipientType, setRecipientType] = useState<'staff' | 'owner'>('staff')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth')
      const data = await res.json()
      if (data.authenticated && data.user?.id) {
        setCurrentUserId(data.user.id)
      }
    } catch (err) {
      console.error('Error fetching session user:', err)
    }
  }

  const fetchRecipients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('drink_recipients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecipients((data as DrinkRecipient[]) || [])
    } catch (err) {
      console.error('Error fetching drink_recipients:', err)
      setMessage({ type: 'error', text: 'โหลดรายชื่อผู้รับดื่มไม่สำเร็จ' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrentUser()
    fetchRecipients()
  }, [])

  // ส่งคำขอเพิ่มชื่อผู้รับดื่ม (status เริ่มต้นเป็น 'pending')
  const handleRequestRecipient = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newName.trim()
    if (!trimmedName) return

    setSubmitting(true)
    setMessage(null)

    try {
      const { error } = await supabase.from('drink_recipients').insert({
        name: trimmedName,
        recipient_type: recipientType,
        status: 'pending',
        is_active: true,
        requested_by_user_id: currentUserId,
      })

      if (error) throw error

      setNewName('')
      setMessage({ type: 'success', text: `ส่งคำขอเพิ่มชื่อ "${trimmedName}" เรียบร้อย รอ Admin อนุมัติ` })
      await fetchRecipients()
    } catch (err) {
      console.error('Error requesting drink recipient:', err)
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการส่งคำขอ' })
    } finally {
      setSubmitting(false)
    }
  }

  // Admin กดอนุมัติ (Approve)
  const handleApprove = async (id: string) => {
    setMessage(null)
    try {
      const { error } = await supabase
        .from('drink_recipients')
        .update({
          status: 'approved',
          is_active: true,
          approved_by_user_id: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: 'อนุมัติรายชื่อเรียบร้อย พร้อมแสดงในหน้าขายสินค้า' })
      await fetchRecipients()
    } catch (err) {
      console.error('Error approving recipient:', err)
      setMessage({ type: 'error', text: 'อนุมัติรายชื่อไม่สำเร็จ' })
    }
  }

  // Admin กดปฏิเสธ (Reject)
  const handleReject = async (id: string) => {
    setMessage(null)
    try {
      const { error } = await supabase
        .from('drink_recipients')
        .update({
          status: 'rejected',
          is_active: false,
          approved_by_user_id: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: 'ปฏิเสธคำขอเรียบร้อย' })
      await fetchRecipients()
    } catch (err) {
      console.error('Error rejecting recipient:', err)
      setMessage({ type: 'error', text: 'ปฏิเสธคำขอไม่สำเร็จ' })
    }
  }

  // เปิด-ปิดสถานะใช้งาน (is_active) สำหรับคนที่ Approved แล้ว
  const handleToggleActive = async (item: DrinkRecipient) => {
    setMessage(null)
    try {
      const { error } = await supabase
        .from('drink_recipients')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)

      if (error) throw error
      await fetchRecipients()
    } catch (err) {
      console.error('Error toggling is_active:', err)
      setMessage({ type: 'error', text: 'อัปเดตสถานะการใช้งานไม่สำเร็จ' })
    }
  }

  const pendingList = recipients.filter((r) => r.status === 'pending')
  const approvedList = recipients.filter((r) => r.status === 'approved')
  const rejectedList = recipients.filter((r) => r.status === 'rejected')

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div>
            <h1 className="text-xl font-black text-amber-400">🍹 จัดการสิทธิ์ผู้รับดื่ม (Drink Recipients)</h1>
            <p className="text-xs text-slate-400 mt-1">
              ขอเพิ่มรายชื่อพนักงาน/เจ้าของร้าน และให้ Admin อนุมัติก่อนแสดงเป็นปุ่มเลือกในหน้าขายสินค้า
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer self-start sm:self-auto"
          >
            ← กลับหน้า Admin Hub
          </button>
        </div>

        {/* Alert Message */}
        {message && (
          <div
            className={`px-4 py-3 rounded-xl text-xs font-bold border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ฟอร์มขอเพิ่มชื่อผู้รับดื่ม */}
        <form
          onSubmit={handleRequestRecipient}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-6">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">ชื่อพนักงาน / เจ้าของร้านที่ต้องการขอสิทธิ์</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="เช่น น้องเปรม, Bee, Alex..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">ประเภท</label>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as 'staff' | 'owner')}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="staff">Staff (พนักงาน)</option>
              <option value="owner">Owner (เจ้าของร้าน)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={submitting || !newName.trim()}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm rounded-xl transition cursor-pointer"
            >
              {submitting ? 'กำลังส่ง...' : '+ ขอเพิ่มรายชื่อ'}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* รายการรออนุมัติ (Pending) */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-amber-400">⏳ คำขอรออนุมัติ ({pendingList.length})</h2>
              </div>

              {pendingList.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">ไม่มีคำขอรออนุมัติ</p>
              ) : (
                <div className="space-y-2.5">
                  {pendingList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{item.name}</div>
                        <span className="text-[11px] text-amber-300/80 uppercase font-semibold">
                          {item.recipient_type === 'owner' ? 'Owner' : 'Staff'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(item.id)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg transition cursor-pointer"
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(item.id)}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* รายชื่อที่อนุมัติแล้ว (Approved) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-emerald-400">✅ รายชื่อที่อนุมัติแล้ว ({approvedList.length})</h2>
              </div>

              {approvedList.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">ยังไม่มีรายชื่อที่อนุมัติ</p>
              ) : (
                <div className="space-y-2.5">
                  {approvedList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{item.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                            {item.recipient_type}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          สถานะปุ่มในหน้าขาย: {item.is_active ? 'แสดงอยู่' : 'ปิดการแสดงผล'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          item.is_active
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {item.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* รายการที่ถูกปฏิเสธ (Rejected) */}
        {rejectedList.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase">รายการที่ถูกปฏิเสธ ({rejectedList.length})</h3>
            <div className="flex flex-wrap gap-2">
              {rejectedList.map((item) => (
                <span
                  key={item.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 line-through"
                >
                  {item.name} ({item.recipient_type})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}