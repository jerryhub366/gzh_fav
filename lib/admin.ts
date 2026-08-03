import { timingSafeEqual } from 'crypto';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

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
