import { createHash, timingSafeEqual } from 'crypto';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';
export const ADMIN_SESSION_COOKIE = 'gzh_fav_admin_session';

export function isAdminAuthEnabled() {
  return Boolean(process.env.ADMIN_TOKEN);
}

export function isAdminToken(token: string | null) {
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken || !token) {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(token);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAdminSessionValue() {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) return '';
  return createHash('sha256').update(`gzh-fav-session:${expectedToken}`).digest('hex');
}

export function isAdminSession(value: string | undefined) {
  const expected = createAdminSessionValue();
  if (!expected || !value) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(value);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isAdminRequest(request: {
  headers: Headers;
  cookies: { get(name: string): { value: string } | undefined };
}) {
  return (
    isAdminToken(request.headers.get(ADMIN_TOKEN_HEADER)) ||
    isAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  );
}
