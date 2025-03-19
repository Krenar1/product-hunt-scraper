import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // You can add authentication here if needed
  // For now, we'll just allow all requests to the settings API

  return NextResponse.next()
}

export const config = {
  matcher: "/api/settings/:path*",
}

