import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_TOKEN_HEADER, isAdminAuthEnabled, isAdminToken } from '../../../lib/admin';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      admin: isAdminToken(request.headers.get(ADMIN_TOKEN_HEADER)),
      authEnabled: isAdminAuthEnabled(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
