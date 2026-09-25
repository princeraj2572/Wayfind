export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const TOKEN_COOKIE = "wayfind_token";
export const DEFAULT_MAX_AGE = 60 * 60;
export const MAX_COOKIE_AGE = 30 * 24 * 60 * 60;
export const UPSTREAM_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_BODY = 25 * 1024 * 1024;
export const maxBodyBytes = () => {
  const configured = Number(process.env.MAX_REQUEST_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BODY;
};
