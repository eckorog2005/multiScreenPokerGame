import { afterEach, expect, test, vi } from 'vitest';
import { clearToken, loadToken, saveToken } from './token-store.ts';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test('stores a Player token per Game Code', () => {
  saveToken('ABCD', 'token-1');
  saveToken('WXYZ', 'token-2');

  expect(loadToken('ABCD')).toBe('token-1');
  expect(loadToken('WXYZ')).toBe('token-2');
  expect(loadToken('QRST')).toBeNull();
});

test('clears the token for one Game Code', () => {
  saveToken('ABCD', 'token-1');
  saveToken('WXYZ', 'token-2');

  clearToken('ABCD');

  expect(loadToken('ABCD')).toBeNull();
  expect(loadToken('WXYZ')).toBe('token-2');
});

test('keeps working when storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });

  expect(() => saveToken('ABCD', 'token-1')).not.toThrow();
  expect(loadToken('ABCD')).toBeNull();
  expect(() => clearToken('ABCD')).not.toThrow();
});

test('keeps working when localStorage itself cannot be accessed', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });

  expect(() => saveToken('ABCD', 'token-1')).not.toThrow();
  expect(loadToken('ABCD')).toBeNull();
});
