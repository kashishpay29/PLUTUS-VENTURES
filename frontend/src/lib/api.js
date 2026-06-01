import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: false,
});

const getCache = new Map();
const inFlightGets = new Map();
const DEFAULT_GET_TTL = 15000;

function stableStringify(value) {
  if (!value || typeof value !== "object") return String(value ?? "");
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${key}:${stableStringify(value[key])}`).join(",")}}`;
}

function userCacheScope() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (user?.id) return `${user.role || "user"}:${user.id}`;
  } catch {}
  return localStorage.getItem("token")?.slice(-16) || "anon";
}

function storageCacheKey(key) {
  return `api-cache:${userCacheScope()}:${key}`;
}

export function readCachedJson(key, maxAgeMs = 300000) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(storageCacheKey(key));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.createdAt || Date.now() - cached.createdAt > maxAgeMs) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCachedJson(key, data) {
  if (!key) return;
  try {
    localStorage.setItem(storageCacheKey(key), JSON.stringify({
      createdAt: Date.now(),
      data,
    }));
  } catch {}
}

export async function getCachedJson(url, options = {}) {
  const {
    ttl = DEFAULT_GET_TTL,
    storageKey,
    force = false,
    ...config
  } = options;
  const cacheKey = `${userCacheScope()}|${url}|${stableStringify(config.params)}`;
  const cached = getCache.get(cacheKey);

  if (!force && cached && Date.now() - cached.createdAt < ttl) {
    return cached.data;
  }
  if (inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey);
  }

  const request = api.get(url, config)
    .then(({ data }) => {
      getCache.set(cacheKey, { createdAt: Date.now(), data });
      writeCachedJson(storageKey, data);
      return data;
    })
    .finally(() => {
      inFlightGets.delete(cacheKey);
    });

  inFlightGets.set(cacheKey, request);
  return request;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const onLogin = window.location.pathname === "/login";
      if (!onLogin) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function formatError(detail) {
  if (detail == null) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  }
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
