import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ป้องกันเฉพาะหน้า Dashboard, POS และ Staff
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/pos') ||
    path.startsWith('/staff')
  ) {
    const sessionCookie = request.cookies.get('bar_session')

    if (!sessionCookie) {
      // ถ้าไม่มีคุกกี้ ดีดกลับไปหน้า Login
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/pos/:path*', '/staff/:path*'],
}