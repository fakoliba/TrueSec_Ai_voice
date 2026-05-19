/**
 * Client session helpers (JWT in localStorage today).
 * HIPAA note: prefer httpOnly Secure cookies set by the API in production.
 */

const ACCESS_TOKEN_KEY = "token";
const RESET_TOKEN_KEY = "password_reset_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** One-time password reset token — sessionStorage avoids URL/history leakage. */
export function setPasswordResetToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESET_TOKEN_KEY, token);
}

export function getPasswordResetToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(RESET_TOKEN_KEY);
}

export function clearPasswordResetToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RESET_TOKEN_KEY);
}

export function clearSession(): void {
  clearAccessToken();
  clearPasswordResetToken();
}
