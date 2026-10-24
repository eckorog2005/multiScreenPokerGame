// Storage can be missing or throw (private mode, blocked site data); the Player then just can't resume.

const key = (code: string) => `poker:token:${code}`;

export function loadToken(code: string): string | null {
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}

export function saveToken(code: string, token: string) {
  try {
    localStorage.setItem(key(code), token);
  } catch {
    return;
  }
}

export function clearToken(code: string) {
  try {
    localStorage.removeItem(key(code));
  } catch {
    return;
  }
}
