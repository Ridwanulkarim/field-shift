// All calls to the backend live here. The browser only talks to /api/...;
// in development Vite forwards that to the Express server (see vite.config.js).

export class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the Field Shift server. Is the backend running?');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // not JSON; handled below
  }
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(e?.code || `HTTP_${res.status}`, e?.message || `The server answered ${res.status}.`, e?.details);
  }
  return body;
}

export const api = {
  meta: () => request('/api/meta'),
  districts: () => request('/api/districts'),
  crops: () => request('/api/crops'),
  climate: (slug) => request(`/api/districts/${encodeURIComponent(slug)}/climate`),
  evaluate: (payload) =>
    request('/api/evaluate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
