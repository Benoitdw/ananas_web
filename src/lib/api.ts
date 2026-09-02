/**
 * Client HTTP unique vers l'API Ananas (depot separe).
 *
 * `credentials: 'include'` est indispensable: la session vit dans un cookie
 * httpOnly pose par FastAPI, sur une origine differente de celle du front.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export const API_URL = PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : {},
    ...init
  });

  if (!response.ok) {
    // FastAPI renvoie {detail: "..."} ; en validation, detail est une liste.
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = Array.isArray(body.detail) ? body.detail[0]?.msg ?? detail : body.detail ?? detail;
    } catch {
      /* corps vide ou non-JSON: on garde statusText */
    }
    throw new ApiError(response.status, detail);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string) => request<T>(path, { method: 'PUT' }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
