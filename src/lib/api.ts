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
  /** Corps brut de la reponse. Certains cas portent plus qu'un message: le 409
   *  de proposition d'entreprise renvoie l'entreprise deja existante, pour que
   *  le front propose de l'ouvrir plutot que de creer un doublon. */
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : {},
    ...init
  });

  if (!response.ok) {
    // FastAPI renvoie {detail: ...}: une chaine, une liste (validation) ou un
    // objet (cas metier qui transportent plus qu'un message).
    let detail = response.statusText;
    let raw: unknown;
    try {
      const body = await response.json();
      raw = body.detail;
      if (Array.isArray(raw)) detail = (raw[0] as { msg?: string })?.msg ?? detail;
      else if (typeof raw === 'string') detail = raw;
      else if (raw && typeof raw === 'object')
        detail = (raw as { detail?: string }).detail ?? detail;
    } catch {
      /* corps vide ou non-JSON: on garde statusText */
    }
    throw new ApiError(response.status, detail, raw);
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
