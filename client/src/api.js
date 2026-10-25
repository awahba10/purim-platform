const BASE = '/api';

// Which season every request is about (and whether that closed season has
// been unlocked for editing). Set by the SeasonProvider.
let seasonHeaders = {};
export function setApiSeason(id, unlocked) {
  seasonHeaders = id
    ? { 'X-Season-Id': String(id), ...(unlocked ? { 'X-Season-Unlock': String(id) } : {}) }
    : {};
}

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...seasonHeaders },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};
