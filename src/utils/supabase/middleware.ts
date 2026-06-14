import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This refreshes the session if expired - do not delete or modify!
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isDashboardRoute = path.startsWith('/dashboard')
  const isRootRoute = path === '/'
  const isLoginRoute = path.startsWith('/login')
  const isSuspendedRoute = path === '/suspended'

  // 1. If user is not logged in
  if (!user) {
    if (isDashboardRoute || isRootRoute || isSuspendedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 2. If user is logged in, check profile role for suspension status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role?.toLowerCase()

  if (role === 'suspended') {
    if (!isSuspendedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/suspended'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 3. If user is logged in and active
  if (isSuspendedRoute || isLoginRoute || isRootRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
