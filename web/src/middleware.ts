import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const response = NextResponse.next();

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

  if (slug) {
    // Set cookie so the client-side can read it
    response.cookies.set('tenant-slug', slug, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // needs to be readable by JS
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
  ],
};
