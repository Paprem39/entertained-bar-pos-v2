import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ปล่อยผ่านหน้าเมนูลูกค้า /menu ให้ลูกค้าสแกน QR เปิดดูได้
  if (path.startsWith('/menu')) {
    return NextResponse.next()
  }

  // ป้องกันหน้า Dashboard, POS และ Staff ด้วย cookie bar_session
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/pos') ||
    path.startsWith('/staff')
  ) {
    const sessionCookie = request.cookies.get('bar_session')

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/menu', '/menu/:path*', '/dashboard/:path*', '/pos/:path*', '/staff/:path*'],
}