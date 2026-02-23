const rawApiUrl = import.meta.env.VITE_SERVER_URL || "";
const normalizedApiUrl = rawApiUrl.trim().replace(/\/$/, "");
const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

export const API_BASE_URL =
  normalizedApiUrl || `${appOrigin}/api`;
