import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name)
          // console.log(`Middleware: Getting cookie ${name}`, cookie?.value)
          return cookie?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // console.log(`Middleware: Setting cookie ${name}`)
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // console.log(`Middleware: Removing cookie ${name}`)
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  // console.log('Middleware: Session check result:', session ? 'Session found' : 'No session')

  // If there's no session and the user is trying to access a protected route
  if (!session && (
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/admin')
  )) {
    // console.log('Middleware: Redirecting to sign-in due to missing session')
    const redirectUrl = new URL('/sign-in', request.url)
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If there's a session and the user is trying to access auth pages
  if (session && (
    request.nextUrl.pathname.startsWith('/sign-in') ||
    request.nextUrl.pathname.startsWith('/sign-up')
  )) {
    // console.log('Middleware: Redirecting to dashboard due to existing session')
    
    // Check user role and redirect accordingly
    const { data: userData } = await supabase
      .from('business_info')
      .select('role')
      .eq('user_id', session.user.id)
      .single()
    
    if (userData?.role === 'super_admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // If the user is trying to access admin pages, check if they're a super_admin
  if (session && request.nextUrl.pathname.startsWith('/admin')) {
    const { data: userData } = await supabase
      .from('business_info')
      .select('role')
      .eq('user_id', session.user.id)
      .single()
    
    if (userData?.role !== 'super_admin') {
      // console.log('Middleware: Redirecting non-super_admin user from admin page')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
