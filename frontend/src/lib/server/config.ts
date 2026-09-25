export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const TOKEN_COOKIE = "wayfind_token";
export const DEFAULT_MAX_AGE = 60 * 60;
export const UPSTREAM_TIMEOUT_MS = 90_000;
export const maxBodyBytes = () => Number(process.env.MAX_REQUEST_BYTES) || 25 * 1024 * 1024;
