import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // The credentials for the hackathon demo
  const user = process.env.DEMO_USER || 'admin';
  const pwd = process.env.DEMO_PASSWORD || 'trelx2026';

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [providedUser, providedPwd] = atob(authValue).split(':');

    if (providedUser === user && providedPwd === pwd) {
      return NextResponse.next();
    }
  }

  // If auth fails or is missing, return a 401 with the Basic Auth header
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Trelx Demo Area"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/webhook/* (Ultravox incoming webhooks)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/webhook|_next/static|_next/image|favicon.ico).*)',
  ],
};
