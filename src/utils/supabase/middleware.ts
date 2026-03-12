import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Sanitizes a redirect target from query params.
 * Only allows internal app-relative paths starting with '/'.
 */
function safeRedirectTarget(value: string | null): string {
  if (!value) return '/dashboard'
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/dashboard'
  if (trimmed.includes('://')) return '/dashboard'
  if (trimmed === '/login' || trimmed.startsWith('/login?')) return '/dashboard'
  return trimmed
}

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // fail-closed access behavior for protected shell
  // if user is not signed in and the current path is under /(protected), redirect to /login
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/invite')
  ) {
    // If not visiting a public route like login or auth callback, redirect home which redirects to login
    // Or just explicitly redirect to /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is signed in and visiting login, redirect to sanitized target
  // This preserves invite-return flow: /login?redirect=/invite/[token]
  if (user && request.nextUrl.pathname === '/login') {
    const target = safeRedirectTarget(request.nextUrl.searchParams.get('redirect'))
    const url = request.nextUrl.clone()
    url.pathname = target
    url.search = '' // clear query params after consuming redirect
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
