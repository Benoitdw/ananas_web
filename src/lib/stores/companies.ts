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
export const facets = writable<Facets>({ types: [], tags: [], core_businesses: [] });
export const loading = writable(false);

export const filters = writable({ q: '', type: '', tag: '', source: '', savedOnly: false });

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

/** Tags BioWin et tags utilisateur reunis: un seul vocabulaire cote interface. */
export function companyTags(c: Company): string[] {
  return [...new Set(`${c.core_business},${c.tags}`.split(',').map((t) => t.trim()).filter(Boolean))];
}

export const filtered = derived([companies, filters], ([$companies, $filters]) => {
  const q = $filters.q.trim().toLowerCase();
  return $companies.filter((c) => {
    if ($filters.savedOnly && !c.is_saved) return false;
    if ($filters.type && c.type !== $filters.type) return false;
    if ($filters.source && c.source !== $filters.source) return false;
    if ($filters.tag && !companyTags(c).includes($filters.tag)) return false;
    if (!q) return true;
    return `${c.name} ${c.city} ${companyTags(c).join(' ')} ${c.type}`.toLowerCase().includes(q);
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

/** Insere une entreprise fraichement proposee sans recharger toute la liste. */
export function addCompany(company: Company): void {
  companies.update((list) =>
    [...list.filter((c) => c.id !== company.id), company].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr')
    )
  );
}
