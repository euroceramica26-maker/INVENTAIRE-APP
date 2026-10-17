import { AdminAuthState } from '../types/inventory';

export const ADMIN_CREDENTIALS = {
  LOGIN: 'ouaradtech',
  PASSWORD: 'Ouaradtech26@'
};

const ADMIN_AUTH_KEY = 'inventaire_admin_session_v5';

export function getStoredAdminAuth(): AdminAuthState {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_KEY);
    if (!raw) {
      return {
        isAdmin: false,
        username: null,
        lastLogin: null
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isAdmin: Boolean(parsed.isAdmin),
      username: parsed.username || null,
      lastLogin: parsed.lastLogin || null
    };
  } catch (e) {
    return {
      isAdmin: false,
      username: null,
      lastLogin: null
    };
  }
}

export function saveStoredAdminAuth(auth: AdminAuthState): void {
  try {
    localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(auth));
  } catch (e) {
    console.error('Erreur sauvegarde session admin:', e);
  }
}

export function clearStoredAdminAuth(): void {
  try {
    localStorage.removeItem(ADMIN_AUTH_KEY);
  } catch (e) {
    // ignore
  }
}

export function verifyAdminCredentials(login: string, password: string): boolean {
  if (!login || !password) return false;
  return (
    login.trim().toLowerCase() === ADMIN_CREDENTIALS.LOGIN.toLowerCase() &&
    password === ADMIN_CREDENTIALS.PASSWORD
  );
}
