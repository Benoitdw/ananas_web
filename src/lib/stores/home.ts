/**
 * Domicile de reference et rayon de recherche.
 *
 * Un store partage plutot qu'un etat par page: le domicile est saisi dans les
 * parametres mais lu par la carte (cercle, distances, tri) et par le tableau
 * des offres. Sans store, changer d'adresse laisserait la carte afficher
 * l'ancien cercle jusqu'au prochain rechargement complet.
 *
 * Le rayon vit ici en deux exemplaires assumes:
 *  - `home.radius_km`, la valeur enregistree cote serveur;
 *  - `radiusFilter`, ce que le curseur de la carte affiche a l'instant.
 * Le second part du premier et n'y retourne pas: bouger le curseur pour
 * regarder « et a 60 km ? » ne doit pas redefinir le domicile de quelqu'un.
 */
import { get, writable } from 'svelte/store';
import { api } from '$lib/api';
import type { Home, HomeInput } from '$lib/types';

export const DEFAULT_RADIUS_KM = 25;

/** null tant que la reponse n'est pas arrivee, ou si personne n'est connecte. */
export const home = writable<Home | null>(null);

/** Vrai seulement quand le cercle et les distances ont un sens. */
export function isLocated(h: Home | null): h is Home & { lat: number; lon: number } {
  return !!h && h.lat !== null && h.lon !== null;
}

let loaded = false;

/** Charge le domicile une fois par session. `force` sert apres un changement
 *  d'utilisateur (connexion, deconnexion). */
export async function loadHome(force = false): Promise<Home | null> {
  if (loaded && !force) return get(home);
  loaded = true;
  try {
    const data = await api.get<Home>('/api/me/home');
    home.set(data);
    return data;
  } catch {
    // Visiteur anonyme: pas de domicile, et surtout pas d'erreur a l'ecran —
    // la carte doit rester utilisable sans compte.
    home.set(null);
    return null;
  }
}

export async function saveHome(input: HomeInput): Promise<Home> {
  const saved = await api.put2<Home>('/api/me/home', input);
  home.set(saved);
  return saved;
}

export async function clearHome(): Promise<void> {
  await api.del('/api/me/home');
  home.set(null);
}

/** Reinitialise le cache: le domicile depend de l'utilisateur connecte. */
export function forgetHome(): void {
  loaded = false;
  home.set(null);
}

/** '12,4 km' — une decimale sous 10 km, arrondi au km au-dela: personne ne
 *  lit « 47,3 km » differemment de « 47 km ». */
export function formatKm(km: number | null): string {
  if (km === null) return '—';
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}
