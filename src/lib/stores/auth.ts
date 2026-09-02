/**
 * Session utilisateur.
 *
 * Le token n'est jamais visible du JS (cookie httpOnly): l'etat de connexion
 * se deduit uniquement de la reponse de /api/auth/me.
 */
import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api';
import type { User } from '$lib/types';

export const user = writable<User | null>(null);
/** false tant que le premier /me n'a pas repondu: evite de faire clignoter
 *  la barre de navigation entre "connexion" et l'email au chargement. */
export const authReady = writable(false);

export async function refreshUser(): Promise<User | null> {
  try {
    const me = await api.get<User>('/api/auth/me');
    user.set(me);
    return me;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) console.error(err);
    user.set(null);
    return null;
  } finally {
    authReady.set(true);
  }
}

export async function login(email: string, password: string): Promise<User> {
  const me = await api.post<User>('/api/auth/login', { email, password });
  user.set(me);
  return me;
}

export async function register(email: string, password: string): Promise<User> {
  const me = await api.post<User>('/api/auth/register', { email, password });
  user.set(me);
  return me;
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
  user.set(null);
}
