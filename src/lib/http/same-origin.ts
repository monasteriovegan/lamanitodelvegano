import type { NextRequest } from 'next/server';

export function requireSameOrigin(request: NextRequest): boolean {
  const origin = String(request.headers.get('origin') || '').trim();
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}
