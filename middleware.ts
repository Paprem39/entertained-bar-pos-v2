import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getHomeByRole(role?: string): string {
  if (role === 'admin') return '/dashboard'
  if (role === 'cashier') return '/pos'
  if (role === 'staff') return '/staff'
  return '/'
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ปล่อยผ่านหน้าเมนูลูกค้า /menu ให้ลูกค้าสแกน QR เปิดดูได้
  if (path.startsWith('/menu')) {
    return NextResponse.next()
  }

  // ป้องกันหน้า Dashboard, POS และ Staff ด้วย cookie bar_session และสิทธิ์ตาม role แบบแยกขาด
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/pos') ||
    path.startsWith('/staff')
  ) {
    const sessionCookie = request.cookies.get('bar_session')

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    let role: string | undefined
    try {
      const parsed = JSON.parse(sessionCookie.value)
      role = parsed?.role
    } catch {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (!role) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (path.startsWith('/dashboard') && role !== 'admin') {
      return NextResponse.redirect(new URL(getHomeByRole(role), request.url))
    }

    if (path.startsWith('/pos') && role !== 'cashier') {
      return NextResponse.redirect(new URL(getHomeByRole(role), request.url))
    }

    if (path.startsWith('/staff') && role !== 'staff') {
      return NextResponse.redirect(new URL(getHomeByRole(role), request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/menu', '/menu/:path*', '/dashboard/:path*', '/pos/:path*', '/staff/:path*'],
}