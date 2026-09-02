/**
 * Client HTTP unique vers l'API Ananas (depot separe).
 *
 * `credentials: 'include'` est indispensable: la session vit dans un cookie
 * httpOnly pose par FastAPI, sur une origine differente de celle du front.
 */
// dynamic (pas static): l'image de prod est buildee une fois et publiee sur
// ghcr.io, PUBLIC_API_URL doit donc rester lisible au runtime (adapter-node),
// pas figee au build.
import { env } from '$env/dynamic/public';

export const API_URL = env.PUBLIC_API_URL || 'http://localhost:8000';

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
  // Un FormData porte son propre Content-Type (avec la frontiere multipart):
  // le fixer a la main casserait l'envoi de fichier.
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: init.body && !isForm ? { 'Content-Type': 'application/json' } : {},
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
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form });
  },
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string) => request<T>(path, { method: 'PUT' }),
  /** PUT avec corps — `put` sert aux bascules sans charge utile (favoris). */
  put2: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
