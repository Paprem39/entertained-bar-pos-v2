import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// GET: ดึงรายชื่อ User ทั้งหมดและดูว่าใครมี Session ค้างอยู่บ้าง
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('bar_session')

    if (!sessionCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const adminSession = JSON.parse(sessionCookie.value)
    if (adminSession.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    // ดึงข้อมูลผู้ใช้ทั้งหมด
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, is_active, session_token, updated_at')

    if (error) throw error

    return NextResponse.json({ success: true, users })
  } catch (err) {
    console.error('Get sessions error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}

// POST: สำหรับกดเตะ (Force Logout) รายบุคคล หรือทั้งหมด
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('bar_session')

    if (!sessionCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const adminSession = JSON.parse(sessionCookie.value)
    if (adminSession.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { userId, action } = await request.json()

    if (action === 'logout_all') {
      // ล้าง session_token ของทุกคนยกเว้น Admin ตัวเอง (หรือล้างทั้งหมดก็ได้)
      const { error } = await supabase
        .from('users')
        .update({ session_token: null })
        .neq('id', adminSession.id) // เก็บของตัวเองไว้ หรือจะล้างหมดก็ได้ตามชอบ

      if (error) throw error
      return NextResponse.json({ success: true, message: 'เคลียร์ Session ทุกเครื่องเรียบร้อยแล้ว' })
    }

    if (userId) {
      // เคลียร์เฉพาะ User ที่เลือก
      const { error } = await supabase
        .from('users')
        .update({ session_token: null })
        .eq('id', userId)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'เตะออกจากระบบสำเร็จ' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Force logout error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}