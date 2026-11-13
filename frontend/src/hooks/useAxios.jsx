import axios from "axios";

// How the browser reaches the API:
//  - Local dev:  "/api" -> Vite proxy (vite.config.js) -> http://localhost:4000
//  - Vercel:     "/api" -> Vercel rewrite (vercel.json) -> https://field-shift-qfv8.onrender.com/api
//    Same-origin calls mean the session cookie is first-party (Safari/Chrome block third-party cookies).
//  - Override:   set VITE_API_URL (e.g. https://field-shift-qfv8.onrender.com/api) to call the API directly.
//    That needs the site's origin in the backend's CORS_ORIGIN, and cross-site cookies may be blocked.
const baseURL = (
  import.meta.env.VITE_API_URL || "https://field-shift-qfv8.onrender.com/api"
).replace(/\/+$/, "");

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  // Render's free tier sleeps when idle; a cold start can take 30-60 s.
  timeout: 60000,
});

// Retry idempotent GETs a couple of times when the server is waking up (no response, or 502/503/504).
const RETRIES = 2;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

axiosInstance.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  if (
    !config ||
    (config.method ?? "get").toLowerCase() !== "get" ||
    error.code === "ERR_CANCELED"
  ) {
    return Promise.reject(error);
  }
  const status = error.response?.status;
  const waking = !error.response || [502, 503, 504].includes(status);
  config.__retryCount = config.__retryCount ?? 0;
  if (!waking || config.__retryCount >= RETRIES) return Promise.reject(error);
  config.__retryCount += 1;
  await sleep(3000 * config.__retryCount);
  return axiosInstance(config);
});

// Fire-and-forget request that wakes a sleeping backend before the user's first real action.
export function warmUpApi() {
  axiosInstance.get("/health", { timeout: 90000 }).catch(() => {});
}

const useAxios = () => {
  return axiosInstance;
};

export default useAxios;
