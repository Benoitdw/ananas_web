export type User = { id: number; email: string; created_at: string; is_admin: boolean };

export type CompanySource = 'biowin' | 'curated' | 'biopark' | 'from_user';

export type Company = {
  id: number;
  slug: string;
  name: string;
  type: string;
  core_business: string;
  tags: string;
  source: CompanySource;
  city: string;
  lat: number | null;
  lon: number | null;
  geo_precision: string;
  is_saved: boolean;
  has_scraper: boolean;
  open_jobs: number;
  /** Distance a vol d'oiseau depuis le domicile, en km. null quand le domicile
   *  n'est pas renseigne ou que l'entreprise n'a pas de coordonnees — un tiret
   *  a l'affichage, jamais un zero invente. */
  distance_km: number | null;
};

export type Job = {
  id: number;
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  posted_at: string | null;
  first_seen_at: string;
  closed_at: string | null;
  /** 0-100. null si l'utilisateur n'a pas de profil ou si l'offre n'est pas
   *  encore caracterisee — dans les deux cas elle reste visible. */
  match_score: number | null;
  match_reasons: string[];
  summary: string | null;
};

export type JobWithCompany = Job & {
  company_id: number;
  company_name: string;
  company_slug: string;
  /** False quand l'offre vient d'une entreprise pas encore suivie (feed
   *  "toutes les entreprises"). Toujours true en scope 'saved'. */
  company_saved: boolean;
  /** L'utilisateur a explicitement ecarte cette offre. Absente du feed par
   *  defaut — voir includeHidden sur /jobs. */
  is_hidden: boolean;
  /** Distance du siege de l'entreprise au domicile. Approximation assumee: le
   *  lieu de l'offre est un texte libre non geocode. */
  distance_km: number | null;
};

export type CompanyDetail = Company & {
  match_threshold: number | null;
  submitted_by_email: string | null;
  other_tags: string;
  baseline: string;
  description: string;
  street: string;
  postal_code: string;
  country: string;
  address: string;
  website: string;
  email: string;
  phone: string;
  linkedin: string;
  logo: string;
  source_url: string;
  careers_url: string | null;
  scraper_key: string | null;
  last_scraped_at: string | null;
  /** L'administration, ou l'utilisateur qui a propose cette entreprise. */
  can_edit: boolean;
  jobs: Job[];
};

/** Champs modifiables d'une fiche. Envoyes en PATCH: le serveur ne touche
 *  qu'aux cles presentes, recompose l'adresse et ne re-geocode que si elle a
 *  change. */
export type CompanyUpdate = {
  name: string;
  tags: string[];
  website: string;
  careers_url: string;
  type: string;
  baseline: string;
  description: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  linkedin: string;
};

/** Ce que le formulaire manipule: la fiche sans ses tags, qui ont leur propre
 *  composant de saisie. */
export type CompanyFormFields = Omit<CompanyUpdate, 'tags'>;

export type Channel = {
  id: number;
  type: string;
  target: string;
  enabled: boolean;
  created_at: string;
  last_sent_at: string | null;
};

export type ChannelType = { type: string; label: string; configured: boolean };

export type TelegramLink = {
  code: string;
  url: string;
  bot_username: string;
  expires_at: string;
};

export type TelegramLinkStatus = {
  status: 'pending' | 'linked';
  channel: Channel | null;
};

/** `tags` reunit les secteurs BioWin et les tags saisis par les utilisateurs:
 *  un seul vocabulaire, donc un seul filtre. */
/** Forme structuree extraite du CV. Affichee pour que l'utilisateur voie ce
 *  qui a ete compris de son profil, et puisse le corriger. */
export type ProfileData = {
  role_families: string[];
  seniority: string;
  years_experience: number;
  skills: string[];
  domains: string[];
  languages: string[];
  locations: string[];
  contracts: string[];
  remote: string;
  avoid: string[];
  summary: string;
};

/** Correction manuelle du profil structure. Envoyee en PATCH: le serveur ne
 *  touche qu'aux cles presentes, renormalise les termes dans le vocabulaire de
 *  l'extraction, et rescore toutes les offres dans la foulee. */
export type ProfileDataUpdate = Partial<Omit<ProfileData, 'summary'>>;

/** Echelles fermees, partagees avec l'extraction des offres — c'est ce que
 *  `ananas.ai.matching` sait comparer. Toute autre valeur est refusee par le
 *  serveur. */
export const SENIORITY = ['stage', 'junior', 'confirme', 'senior', 'lead', 'direction', 'inconnu'];
export const REMOTE = ['sur_site', 'hybride', 'distanciel', 'inconnu'];

export type CvImport = {
  text: string;
  pages: number;
  filename: string;
  /** 'texte' = couche texte du PDF, 'modele' = scan transcrit par le modele */
  method: 'texte' | 'modele';
};

export type Profile = {
  cv_text: string;
  aspirations: string;
  match_threshold: number;
  notify_only_relevant: boolean;
  status: 'ok' | 'error' | null;
  error: string | null;
  extracted_at: string | null;
  version: number;
  data: ProfileData | null;
  ai_available: boolean;
};

/** Domicile de reference et perimetre de recherche.
 *
 *  `lat`/`lon` sont geocodes par le serveur a l'enregistrement: ils tracent le
 *  cercle sur la carte et servent au calcul des distances. Ils restent nuls
 *  quand l'adresse n'a pas pu etre localisee — l'interface le dit plutot que
 *  de poser un cercle au hasard. */
export type Home = {
  street: string;
  postal_code: string;
  city: string;
  country: string;
  address: string;
  lat: number | null;
  lon: number | null;
  geo_precision: string;
  radius_km: number;
  /** Appliquer le rayon a la notification quotidienne, et pas seulement aux
   *  filtres de l'interface. Faux par defaut: un filtre d'envoi retire des
   *  offres qu'on ne verra jamais, ça se decide explicitement. */
  notify_within_radius: boolean;
  updated_at: string | null;
};

/** Ce que le formulaire envoie en PUT. */
export type HomeInput = Pick<
  Home,
  'street' | 'postal_code' | 'city' | 'country' | 'radius_km' | 'notify_within_radius'
>;

export type Facets = { types: string[]; tags: string[]; core_businesses: string[] };

export type CompanySubmit = {
  name: string;
  tags: string[];
  website: string;
  careers_url: string;
  type: string;
  baseline: string;
  description: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  linkedin: string;
  save: boolean;
};

export type AdminUser = {
  id: number;
  email: string;
  created_at: string;
  is_active: boolean;
  is_admin: boolean;
  saved_companies: number;
  submitted_companies: number;
  channels: number;
  has_profile: boolean;
};

export type AdminStats = {
  users: number;
  companies: number;
  companies_by_source: Record<string, number>;
  user_submissions: number;
  jobs_open: number;
  scrapers: number;
};

/** Corps du 409 renvoye quand l'entreprise existe deja. */
export type SubmitConflict = {
  detail: string;
  company_id: number;
  company_name: string;
};
