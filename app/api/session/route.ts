import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_TOKEN_HEADER,
  createAdminSessionValue,
  isAdminAuthEnabled,
  isAdminRequest,
  isAdminToken,
} from '../../../lib/admin';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      admin: isAdminRequest(request),
      authEnabled: isAdminAuthEnabled(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminToken(request.headers.get(ADMIN_TOKEN_HEADER))) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 403 });
  }

  const response = NextResponse.json({ admin: true, authEnabled: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionValue(), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ admin: false, authEnabled: isAdminAuthEnabled() });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
