import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  // Extract subdomain: kebab-du-coin.novacaisse.fr or kebab-du-coin.localhost:3000
  let slug: string | null = null;

  // Production: *.novacaisse.fr
  if (hostname.endsWith('.novacaisse.fr')) {
    slug = hostname.replace('.novacaisse.fr', '');
  }
  // Dev: *.localhost:3000 or *.localhost
  else if (hostname.includes('.localhost')) {
    slug = hostname.split('.localhost')[0];
  }

  // Ignore www, app, api subdomains
  if (slug && ['www', 'app', 'api'].includes(slug)) {
    slug = null;
  }

  // No subdomain → landing page (marketing site)
  // Allow /register, /login, and landing page routes on the root domain
  if (!slug) {
    // Rewrite "/" to "/landing" so the landing page is served without a redirect
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/landing';
      const response = NextResponse.rewrite(url);
      response.cookies.delete('tenant-slug');
      return response;
    }
    const response = NextResponse.next();
    // Landing pages don't need tenant-slug cookie
    response.cookies.delete('tenant-slug');
    return response;
  }

  // With subdomain → tenant app (set cookie for client-side)
  const response = NextResponse.next();
  response.cookies.set('tenant-slug', slug, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // needs to be readable by JS
  });

  // If tenant user tries to access landing-only routes, let them through
  // (they might want /login which is the tenant login)
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
  ],
};
