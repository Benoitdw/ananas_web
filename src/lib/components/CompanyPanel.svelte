<script lang="ts">
  /** Fiche d'une entreprise: contacts, secteurs, offres, bouton d'enregistrement. */
  import { api } from '$lib/api';
  import type { Company, CompanyDetail } from '$lib/types';
  import { user } from '$lib/stores/auth';
  import { companyTags } from '$lib/stores/companies';

  type Props = {
    company: Company;
    onclose: () => void;
    ontoggle: (c: Company) => void;
  };
  let { company, onclose, ontoggle }: Props = $props();

  let detail = $state<CompanyDetail | null>(null);
  let error = $state('');

  // Recharge la fiche complete a chaque changement de selection
  $effect(() => {
    const id = company.id;
    detail = null;
    error = '';
    api
      .get<CompanyDetail>(`/api/companies/${id}`)
      .then((d) => {
        if (company.id === id) detail = d;
      })
      .catch(() => (error = 'Fiche indisponible.'));
  });

  // Tags BioWin et tags utilisateur affiches ensemble: un seul vocabulaire.
  const tags = $derived(companyTags(detail ?? company));

  const fromUser = $derived((detail ?? company).source === 'from_user');

  /** Le POC signalait honnetement les positions approximatives; on garde ça. */
  const geoWarning = $derived.by(() => {
    switch (company.geo_precision) {
      case 'ville':
        return 'Position approximative: seule la commune a pu etre localisee.';
      case 'approx. (nom)':
        return 'Position deduite du nom de l’organisation, aucune adresse publiee.';
      case 'non localise':
        return 'Aucune adresse publiee: cette entreprise n’apparait pas sur la carte.';
      default:
        return '';
    }
  });
</script>

<aside class="panel card">
  <header>
    <div>
      <h2>{company.name}</h2>
      <p class="small muted">
        {[company.type, company.city].filter(Boolean).join(' · ')}
      </p>
    </div>
    <button class="close" onclick={onclose} aria-label="Fermer la fiche">×</button>
  </header>

  {#if geoWarning}
    <p class="alert alert-warn small">{geoWarning}</p>
  {/if}

  {#if $user}
    <button
      class="btn save {company.is_saved ? 'btn-saved' : ''}"
      onclick={() => ontoggle(company)}
    >
      {company.is_saved ? '★ Enregistree — retirer' : '☆ Enregistrer cette entreprise'}
    </button>
  {:else}
    <p class="alert alert-ok small">
      <a href="/register">Cree un compte</a> pour enregistrer cette entreprise et suivre ses offres.
    </p>
  {/if}

  {#if error}
    <p class="alert alert-error small">{error}</p>
  {:else if !detail}
    <p class="small muted">Chargement…</p>
  {:else}
    {#if detail.baseline}
      <p class="baseline">{detail.baseline}</p>
    {/if}

    {#if tags.length}
      <div class="tags">
        {#each tags as tag}<span class="tag">{tag}</span>{/each}
      </div>
    {/if}

    <dl>
      {#if detail.address}
        <dt>Adresse</dt>
        <dd>{detail.address}</dd>
      {/if}
      {#if detail.website}
        <dt>Site</dt>
        <dd><a href={detail.website} target="_blank" rel="noopener">{detail.website}</a></dd>
      {/if}
      {#if detail.email}
        <dt>Email</dt>
        <dd><a href="mailto:{detail.email}">{detail.email}</a></dd>
      {/if}
      {#if detail.phone}
        <dt>Telephone</dt>
        <dd><a href="tel:{detail.phone}">{detail.phone}</a></dd>
      {/if}
      {#if detail.linkedin}
        <dt>LinkedIn</dt>
        <dd><a href={detail.linkedin} target="_blank" rel="noopener">Profil</a></dd>
      {/if}
    </dl>

    <section class="jobs">
      <h3>Offres {detail.jobs.length ? `(${detail.jobs.length})` : ''}</h3>
      {#if detail.jobs.length}
        <ul>
          {#each detail.jobs as job}
            <li>
              <a href={job.url} target="_blank" rel="noopener">{job.title}</a>
              {#if job.location}<span class="small muted"> — {job.location}</span>{/if}
            </li>
          {/each}
        </ul>
      {:else if detail.scraper_key}
        <p class="small muted">Aucune offre ouverte au dernier passage.</p>
      {:else}
        <p class="small muted">
          Pas encore de scraper pour cette entreprise. Tu peux l'enregistrer quand meme:
          la veille demarrera des qu'un scraper sera branche.
        </p>
      {/if}
    </section>

    {#if detail.description}
      <details>
        <summary class="small">A propos</summary>
        <p class="small muted">{detail.description}</p>
      </details>
    {/if}

    <p class="small muted source">
      {#if fromUser}
        Proposee par {detail.submitted_by_email ?? 'un utilisateur'}
      {:else if detail.source_url}
        <a href={detail.source_url} target="_blank" rel="noopener">Fiche BioWin d'origine</a>
      {/if}
    </p>
  {/if}
</aside>

<style>
  .panel {
    padding: 1.15rem;
    overflow-y: auto;
    height: 100%;
    border-radius: 0;
    border-top: none;
    border-bottom: none;
    border-right: none;
    box-shadow: none;
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.9rem;
  }
  header h2 { font-size: 1.12rem; margin-bottom: 0.15rem; }
  header p { margin: 0; }

  .close {
    margin-left: auto;
    border: none;
    background: none;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
    padding: 0 0.2rem;
    flex-shrink: 0;
  }
  .close:hover { color: var(--text); }

  .save { width: 100%; margin-bottom: 1rem; }

  .alert { margin: 0 0 1rem; }

  .baseline { font-size: 0.93rem; margin: 0 0 0.9rem; }

  .tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 1rem; }
  .tag { max-width: 100%; overflow-wrap: break-word; }

  dl {
    display: grid;
    /* minmax(0,1fr): sans ça une URL longue elargit la grille et fait
       deborder tout le panneau. */
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.3rem 0.8rem;
    margin: 0 0 1.2rem;
    font-size: 0.88rem;
  }
  dt { color: var(--muted); font-weight: 600; }
  dd { margin: 0; overflow-wrap: anywhere; }

  .jobs h3 { font-size: 0.95rem; margin-bottom: 0.5rem; }
  .jobs ul { margin: 0; padding-left: 1.1rem; }
  .jobs li { margin-bottom: 0.35rem; font-size: 0.9rem; overflow-wrap: anywhere; }

  details { margin-top: 1rem; }
  summary { cursor: pointer; color: var(--muted); font-weight: 600; }

  .source { margin-top: 1rem; }

  @media (max-width: 900px) {
    /* Plein ecran: la fiche est la vue principale, pas un panneau lateral.
       Le bouton de fermeture est agrandi pour rester atteignable au pouce. */
    .panel { padding: 1rem 1.1rem 2.5rem; }
    header { position: sticky; top: 0; background: var(--surface); padding-top: 0.2rem; }
    header h2 { font-size: 1.25rem; }
    .close { font-size: 2rem; padding: 0 0.5rem; margin-top: -0.2rem; }
    .save { padding: 0.75rem 1rem; }
  }
</style>
