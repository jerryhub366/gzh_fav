export const ADMIN_STORAGE_KEY = 'gzh_fav_admin:v1';
const LEGACY_ADMIN_STORAGE_KEY = 'gzh_fav_admin';
const ADMIN_TOKEN_HEADER = 'X-Admin-Token';

interface AdminSession {
  admin: boolean;
  authEnabled: boolean;
  token: string;
}

function tokenFromHash() {
  const match = window.location.hash.match(/^#\/admin\/(.+)$/);
  if (!match) return '';

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

export async function getAdminSession(): Promise<AdminSession> {
  const hashToken = tokenFromHash();
  let storedToken = '';
  try {
    storedToken =
      window.localStorage.getItem(ADMIN_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_ADMIN_STORAGE_KEY) ||
      '';
  } catch {}
  const token = hashToken || storedToken;

  try {
    const response = await fetch('/api/session', {
      method: token ? 'POST' : 'GET',
      headers: token ? { [ADMIN_TOKEN_HEADER]: token } : undefined,
      cache: 'no-store',
    });
    const session = await response.json();
    const admin = response.ok && session.admin === true;

    try {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_ADMIN_STORAGE_KEY);
    } catch {}

    return {
      admin,
      authEnabled: session.authEnabled === true,
      token: '',
    };
  } catch {
    return { admin: false, authEnabled: true, token: '' };
  }
}

export function adminHeaders(token: string) {
  return token ? { [ADMIN_TOKEN_HEADER]: token } : {};
}
