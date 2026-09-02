export type User = { id: number; email: string; created_at: string };

export type CompanySource = 'biowin' | 'from_user';

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
  jobs: Job[];
};

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

/** Corps du 409 renvoye quand l'entreprise existe deja. */
export type SubmitConflict = {
  detail: string;
  company_id: number;
  company_name: string;
};
