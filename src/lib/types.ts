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
  posted_at: string | null;
  first_seen_at: string;
  closed_at: string | null;
};

export type JobWithCompany = Job & {
  company_id: number;
  company_name: string;
  company_slug: string;
};

export type CompanyDetail = Company & {
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
