/**
 * Repertoire d'entreprises, favoris et masquage.
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

/** `maxKm` a null = pas de perimetre. C'est un filtre a part entiere, mais
 *  qui n'a de sens qu'avec un domicile localise: sans lui, `distance_km` est
 *  nul partout et la carte ne doit pas se vider. */
export type CompanySort = 'name' | 'distance';

const DEFAULT_FILTERS = {
  q: '',
  type: '',
  tag: '',
  source: '',
  savedOnly: false,
  /** Les entreprises masquees sont chargees mais retirees de la carte. La case
   *  les fait revenir, seul moyen de les demasquer depuis l'interface. */
  includeHidden: false,
  maxKm: null as number | null,
  sort: 'name' as CompanySort
};

export const filters = writable({ ...DEFAULT_FILTERS });

export const EMPTY_FILTERS = { ...DEFAULT_FILTERS };

export async function loadCompanies(): Promise<void> {
  loading.set(true);
  try {
    const [list, f] = await Promise.all([
      api.get<Company[]>('/api/companies?include_hidden=true'),
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
  const rows = $companies.filter((c) => {
    if (c.is_hidden && !$filters.includeHidden) return false;
    if ($filters.savedOnly && !c.is_saved) return false;
    if ($filters.type && c.type !== $filters.type) return false;
    if ($filters.source && c.source !== $filters.source) return false;
    if ($filters.tag && !companyTags(c).includes($filters.tag)) return false;
    // Une entreprise sans distance connue (pas de domicile, ou pas de
    // coordonnees) sort du perimetre: elle n'est pas "a moins de 30 km", on
    // n'en sait rien.
    if ($filters.maxKm !== null && (c.distance_km === null || c.distance_km > $filters.maxKm))
      return false;
    if (!q) return true;
    return `${c.name} ${c.city} ${companyTags(c).join(' ')} ${c.type}`.toLowerCase().includes(q);
  });

  if ($filters.sort === 'distance') {
    // Les non localisees ferment la marche plutot que de passer pour les plus
    // proches — elles restent listees, en gris, dans la sidebar.
    return [...rows].sort(
      (a, b) =>
        Number(a.distance_km === null) - Number(b.distance_km === null) ||
        (a.distance_km ?? 0) - (b.distance_km ?? 0) ||
        a.name.localeCompare(b.name, 'fr')
    );
  }
  return rows;
});

/** Entreprises affichables sur la carte. Les 5 sans coordonnees sont listees
 *  a part dans la sidebar plutot que silencieusement omises. */
export const mappable = derived(filtered, ($f) => $f.filter((c) => c.lat !== null && c.lon !== null));
export const unlocated = derived(filtered, ($f) => $f.filter((c) => c.lat === null || c.lon === null));

/** Bascule le favori en mettant a jour le store immediatement: la carte
 *  reagit sans attendre l'aller-retour reseau. */
export async function toggleSaved(company: Company): Promise<void> {
  const next = !company.is_saved;
  const before = { is_saved: company.is_saved, is_hidden: company.is_hidden };
  companies.update((list) =>
    list.map((c) =>
      // Enregistrer demasque (l'API fait de meme): les deux reglages sont
      // exclusifs, ils ne doivent jamais s'afficher ensemble.
      c.id === company.id ? { ...c, is_saved: next, is_hidden: next ? false : c.is_hidden } : c
    )
  );
  try {
    if (next) await api.put(`/api/me/companies/${company.id}`);
    else await api.del(`/api/me/companies/${company.id}`);
  } catch (err) {
    // Echec: on remet l'etat precedent plutot que de mentir a l'utilisateur.
    // Les deux champs, puisque enregistrer a pu demasquer.
    companies.update((list) => list.map((c) => (c.id === company.id ? { ...c, ...before } : c)));
    throw err;
  }
}

export function savedCount(): number {
  return get(companies).filter((c) => c.is_saved).length;
}

/** Masque ou reaffiche une entreprise. Comme `toggleSaved`, le store est mis a
 *  jour avant l'appel reseau et remis en etat si celui-ci echoue.
 *
 *  Masquer retire aussi le favori — c'est ce que fait l'API, et le store doit
 *  dire la meme chose, sinon l'etoile resterait allumee sur une entreprise
 *  dont on ne recevra plus rien. */
export async function toggleHidden(company: Company): Promise<void> {
  const next = !company.is_hidden;
  const before = { is_hidden: company.is_hidden, is_saved: company.is_saved };
  companies.update((list) =>
    list.map((c) =>
      c.id === company.id ? { ...c, is_hidden: next, is_saved: next ? false : c.is_saved } : c
    )
  );
  try {
    if (next) await api.put(`/api/me/companies/${company.id}/hidden`);
    else await api.del(`/api/me/companies/${company.id}/hidden`);
  } catch (err) {
    companies.update((list) => list.map((c) => (c.id === company.id ? { ...c, ...before } : c)));
    throw err;
  }
}

/** Insere une entreprise fraichement proposee sans recharger toute la liste. */
export function addCompany(company: Company): void {
  companies.update((list) =>
    [...list.filter((c) => c.id !== company.id), company].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr')
    )
  );
}
