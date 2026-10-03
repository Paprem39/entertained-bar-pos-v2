import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// 1. POST: สำหรับเข้าสู่ระบบด้วย Username และ PIN
export async function POST(request: Request) {
  try {
    const { username, pin } = await request.json()

    if (!username || !pin) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัส PIN' }, { status: 400 })
    }

    // ค้นหา User จาก username และเช็กว่าเปิดใช้งานอยู่ (is_active = true)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ success: false, message: 'ไม่พบชื่อผู้ใช้งานนี้ หรือบัญชีถูกระงับ' }, { status: 401 })
    }

    // ตรวจสอบ PIN (เทียบกับฟิลด์ pin_hash ในตารางของคุณ)
    if (user.pin_hash !== pin) {
      return NextResponse.json({ success: false, message: 'รหัส PIN ไม่ถูกต้อง' }, { status: 401 })
    }

    // สร้าง Session Token ใหม่เพื่อดีดเครื่องอื่นออก (Single Session)
    const newToken = Math.random().toString(36).substring(2) + Date.now().toString(36)

    const { error: updateError } = await supabase
      .from('users')
      .update({ session_token: newToken })
      .eq('id', user.id)

    if (updateError) throw updateError

    let wasKickedOut = false // สร้างตัวแปรเช็คสถานะ

    // ** เงื่อนไขสำคัญ: บันทึกเฉพาะผู้ใช้ที่ไม่ใช่ admin ลงตาราง user_sessions เท่านั้น **
    if (user.role !== 'admin') {

      // เช็คก่อนว่ามี Session เก่าค้างอยู่ไหม (ก่อนจะลบ)
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', user.id)
        .single()

        if (existingSession) {
          wasKickedOut = true // ถ้ามีแปลว่ามีเครื่องเก่าเปิดค้างอยู่และกำลังจะถูกเตะ
        }

      // ดึงค่า User Agent และ IP Address จาก Request Headers ของฝั่ง Server โดยตรง
      const userAgentString = request.headers.get('user-agent') || 'Unknown Device'
      
      const forwardedFor = request.headers.get('x-forwarded-for')
      const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.headers.get('x-real-ip') || '127.0.0.1')

      // เคลียร์ Session เก่าของ User คนนี้ทิ้งก่อน
      await supabase.from('user_sessions').delete().eq('user_id', user.id)

      // Insert ข้อมูล Session ใหม่เข้าไป
      await supabase.from('user_sessions').insert([
        {
          user_id: user.id,
          is_online: true,
          login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_agent: userAgentString,
          ip_address: ipAddress
        }
      ])
    }

    // บันทึก Cookie ฝั่ง Server
    const cookieStore = await cookies()
    cookieStore.set({
      name: 'bar_session',
      value: JSON.stringify({ id: user.id, token: newToken, role: user.role }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 วัน
    })

    return NextResponse.json({ 
      success: true, 
      wasKickedOut: wasKickedOut, // ส่งค่าบอกฝั่งบ้านว่ามีการเตะเครื่องเก่าไหม
      user: { id: user.id, display_name: user.display_name, role: user.role } 
    })

  } catch (err) {
    console.error('Login API error:', err)
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์' }, { status: 500 })
  }
}

// 2. GET: สำหรับตรวจสอบสถานะ Session ปัจจุบัน
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('bar_session')

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const { id, token } = JSON.parse(sessionCookie.value)

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, session_token, is_active')
      .eq('id', id)
      .single()

    if (error || !user || !user.is_active || user.session_token !== token) {
      return NextResponse.json({ authenticated: false, reason: 'conflict_or_inactive' }, { status: 401 })
    }

    return NextResponse.json({ authenticated: true, user })
  } catch (err) {
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}

// 3. DELETE: สำหรับออกจากระบบ (เคลียร์ข้อมูลใน user_sessions ออกให้อัตโนมัติด้วย)
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('bar_session')
    
    if (sessionCookie) {
      const { id } = JSON.parse(sessionCookie.value)
      // ลบข้อมูล Session ออกจากตาราง user_sessions เมื่อทำการ Logout
      await supabase.from('user_sessions').delete().eq('user_id', id)
    }

    cookieStore.delete('bar_session')
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}