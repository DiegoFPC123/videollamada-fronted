const STORAGE_KEY = "videollamada";
export const AUTH_TOKEN_EVENT = "videollamada-auth-changed";

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
};

export const setAuthToken = (token: string | null): void => {
  if (typeof window === "undefined") return;
  if (token && token.trim()) {
    localStorage.setItem(STORAGE_KEY, token.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  // Notifica a la app (mismo tab) que el token cambió.
  window.dispatchEvent(new Event(AUTH_TOKEN_EVENT));
};
