'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // ถ้ารวมอยู่ที่หน้า Login (หน้าแรก '/') ไม่ต้องเช็ก Session
    if (pathname === '/') return

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth')
        if (!res.ok) {
          // ถ้า Token ไม่ตรงกับฐานข้อมูล หรือถูกเตะออก จะเด้งกลับหน้า Login
          router.push('/')
        }
      } catch (err) {
        console.error('Session guard error:', err)
      }
    }

    // เช็กทันทีเมื่อเปลี่ยนหน้า
    checkSession()

    // ตั้งเวลาเช็กซ้ำทุกๆ 8 วินาที เพื่อให้เครื่องเก่ารู้ตัวและเด้งออกทันทีเมื่อมีการล็อกอินซ้ำ
    const interval = setInterval(checkSession, 8000)

    return () => clearInterval(interval)
  }, [pathname, router])

  return <>{children}</>
}