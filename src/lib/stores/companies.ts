/**
 * Repertoire d'entreprises + favoris.
 *
 * La liste complete (81 lignes) tient largement en memoire: on la charge une
 * fois et on filtre cote client. Cela rend la recherche instantanee et evite
 * une requete a chaque frappe.
 */
import { derived, get, writable } from 'svelte/store';
import { api } from '$lib/api';
import type { Company, Facets } from '$lib/types';

export const companies = writable<Company[]>([]);
export const facets = writable<Facets>({ types: [], core_businesses: [] });
export const loading = writable(false);

export const filters = writable({ q: '', type: '', core_business: '', savedOnly: false });

export async function loadCompanies(): Promise<void> {
  loading.set(true);
  try {
    const [list, f] = await Promise.all([
      api.get<Company[]>('/api/companies'),
      api.get<Facets>('/api/companies/facets')
    ]);
    companies.set(list);
    facets.set(f);
  } finally {
    loading.set(false);
  }
}

export const filtered = derived([companies, filters], ([$companies, $filters]) => {
  const q = $filters.q.trim().toLowerCase();
  return $companies.filter((c) => {
    if ($filters.savedOnly && !c.is_saved) return false;
    if ($filters.type && c.type !== $filters.type) return false;
    if ($filters.core_business && !c.core_business.includes($filters.core_business)) return false;
    if (!q) return true;
    return `${c.name} ${c.city} ${c.core_business} ${c.type}`.toLowerCase().includes(q);
  });
});

/** Entreprises affichables sur la carte. Les 5 sans coordonnees sont listees
 *  a part dans la sidebar plutot que silencieusement omises. */
export const mappable = derived(filtered, ($f) => $f.filter((c) => c.lat !== null && c.lon !== null));
export const unlocated = derived(filtered, ($f) => $f.filter((c) => c.lat === null || c.lon === null));

/** Bascule le favori en mettant a jour le store immediatement: la carte
 *  reagit sans attendre l'aller-retour reseau. */
export async function toggleSaved(company: Company): Promise<void> {
  const next = !company.is_saved;
  companies.update((list) =>
    list.map((c) => (c.id === company.id ? { ...c, is_saved: next } : c))
  );
  try {
    if (next) await api.put(`/api/me/companies/${company.id}`);
    else await api.del(`/api/me/companies/${company.id}`);
  } catch (err) {
    // Echec: on remet l'etat precedent plutot que de mentir a l'utilisateur
    companies.update((list) =>
      list.map((c) => (c.id === company.id ? { ...c, is_saved: !next } : c))
    );
    throw err;
  }
}

export function savedCount(): number {
  return get(companies).filter((c) => c.is_saved).length;
}
