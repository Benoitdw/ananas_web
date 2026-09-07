/**
 * Libelles des provenances d'une entreprise.
 *
 * Trois ecrans les affichent — le filtre de la carte, la fiche, la page
 * d'administration. Une seule table, sinon « Repertoire Ananas » finit par
 * s'appeler autrement a un endroit. Ajouter une provenance ici suffit d'ailleurs
 * a la faire apparaitre dans les deux filtres, qui bouclent sur ces tables.
 */
import type { CompanySource } from '$lib/types';

export const SOURCE_LABELS: Record<CompanySource, string> = {
  biowin: 'Repertoire BioWin',
  curated: 'Repertoire Ananas',
  biopark: 'Annuaire BioPark',
  from_user: 'Proposee par un utilisateur'
};

/** Forme courte, pour les endroits ou le libelle complet n'entre pas:
 *  compteurs, filtre du tableau d'administration. */
export const SOURCE_SHORT: Record<CompanySource, string> = {
  biowin: 'BioWin',
  curated: 'Ananas',
  biopark: 'BioPark',
  from_user: 'utilisateurs'
};

export function sourceShort(source: string): string {
  return SOURCE_SHORT[source as CompanySource] ?? source;
}

/** Libelle du lien vers la fiche d'origine, quand `source_url` est renseigne.
 *  Deux annuaires en fournissent une, et ce n'est pas la meme. */
const SOURCE_ORIGIN: Partial<Record<CompanySource, string>> = {
  biowin: "Fiche BioWin d'origine",
  biopark: "Fiche BioPark d'origine"
};

export function sourceOrigin(source: string): string {
  return SOURCE_ORIGIN[source as CompanySource] ?? "Fiche d'origine";
}

export function sourceLabel(source: string, submittedByEmail?: string | null): string {
  const base = SOURCE_LABELS[source as CompanySource] ?? source;
  return source === 'from_user' && submittedByEmail ? `${base} (${submittedByEmail})` : base;
}
