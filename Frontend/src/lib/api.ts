const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8001";

function getHeaders(contentType: string | null = "application/json") {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  // Try to get token from state or localStorage
  // Since we are outside React, we check localStorage directly
  // Note: your app currently doesn't seem to persist state to localStorage, 
  // but if it did, this is where we'd get it.
  // For now, let's allow passing it or just reading a known key.
  const token = localStorage.getItem("access_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const isFormData = body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: getHeaders(isFormData ? null : "application/json"),
    body: isFormData ? (body as FormData) : JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}
