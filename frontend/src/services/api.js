/**
 * Field Shift - Frontend API Client
 * Interfaces with Express REST API (Spec Section 45)
 */

// Determines the API base URL.
// In production/Vercel: uses relative '/api' or VITE_API_BASE.
// In local dev (ports 3000, 3001, 5173): routes to Express on port 5001.
const getApiBase = () => {
  if (import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port && (port === '3000' || port === '3001' || port === '5173')) {
      return `${protocol}//${hostname}:5001/api`;
    }
  }
  return '/api';
};

const API_BASE = getApiBase();

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchCrops() {
  const res = await fetch(`${API_BASE}/crops`);
  if (!res.ok) throw new Error(`Failed to fetch crops: ${res.statusText}`);
  return res.json();
}

export async function fetchFields() {
  const res = await fetch(`${API_BASE}/fields`);
  if (!res.ok) throw new Error(`Failed to fetch fields: ${res.statusText}`);
  return res.json();
}

export async function fetchField(fieldId) {
  const res = await fetch(`${API_BASE}/fields/${fieldId}`);
  if (!res.ok) throw new Error(`Failed to fetch field ${fieldId}: ${res.statusText}`);
  return res.json();
}

export async function evaluateRotation(payload) {
  const res = await fetch(`${API_BASE}/rotations/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Evaluation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function compareRotations(payload) {
  const res = await fetch(`${API_BASE}/rotations/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Comparison failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFieldRotations(fieldId) {
  const res = await fetch(`${API_BASE}/rotations/field/${fieldId}`);
  if (!res.ok) throw new Error(`Failed to fetch rotations for field ${fieldId}: ${res.statusText}`);
  return res.json();
}
