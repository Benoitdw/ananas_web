<script lang="ts">
  /** Le pendant web de la notification quotidienne. */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { authReady, user } from '$lib/stores/auth';
  import type { JobWithCompany } from '$lib/types';

  let jobs = $state<JobWithCompany[]>([]);
  let includeClosed = $state(false);
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    const closed = includeClosed;
    if (!$authReady || !$user) return;
    loading = true;
    api
      .get<JobWithCompany[]>(`/api/me/jobs?include_closed=${closed}`)
      .then((d) => (jobs = d))
      .catch(() => (error = 'Impossible de charger les offres.'))
      .finally(() => (loading = false));
  });

  /** Regroupe par entreprise, comme le fait la notification Telegram. */
  const grouped = $derived.by(() => {
    const map = new Map<string, JobWithCompany[]>();
    for (const job of jobs) {
      const list = map.get(job.company_name) ?? [];
      list.push(job);
      map.set(job.company_name, list);
    }
    return [...map.entries()];
  });

  const fmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  const date = (iso: string) => fmt.format(new Date(iso));
</script>

<svelte:head><title>Mes offres — Ananas</title></svelte:head>

<div class="container page">
  <h1>Offres</h1>
  <p class="muted">
    Les offres ouvertes chez les entreprises que tu as enregistrees. C'est le meme contenu que ta
    notification quotidienne.
  </p>

  <label class="check small">
    <input type="checkbox" bind:checked={includeClosed} />
    Inclure les offres qui ont disparu du site
  </label>

  {#if error}
    <p class="alert alert-error">{error}</p>
  {:else if loading}
    <p class="muted">Chargement…</p>
  {:else if !jobs.length}
    <div class="card empty">
      <p>Aucune offre pour l'instant.</p>
      <p class="small muted">
        Enregistre des entreprises sur la carte: le worker relevera leurs offres a sa prochaine
        passe quotidienne.
      </p>
      <a class="btn btn-brand" href="/map">Ouvrir la carte</a>
    </div>
  {:else}
    <p class="small muted total">{jobs.length} offre{jobs.length > 1 ? 's' : ''}</p>

    {#each grouped as [company, companyJobs]}
      <section class="card group">
        <h2>{company} <span class="tag">{companyJobs.length}</span></h2>
        <ul>
          {#each companyJobs as job}
            <li class:closed={job.closed_at}>
              <a href={job.url} target="_blank" rel="noopener">{job.title}</a>
              <span class="meta small muted">
                {#if job.location}{job.location} · {/if}
                vue le {date(job.first_seen_at)}
                {#if job.closed_at}· <em>fermee</em>{/if}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<style>
  .page { padding: 2.2rem 1.25rem 3rem; max-width: 780px; }

  h1 { font-size: 1.6rem; }

  .check { display: flex; align-items: center; gap: 0.45rem; margin: 1.2rem 0; font-weight: 500; }
  .check input { width: auto; }

  .total { margin-bottom: 0.8rem; }

  .group { padding: 1.1rem 1.3rem; margin-bottom: 0.9rem; }
  .group h2 { font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .group ul { margin: 0; padding-left: 1.1rem; }
  .group li { margin-bottom: 0.55rem; overflow-wrap: anywhere; }
  .group li.closed { opacity: 0.55; }

  .meta { display: block; }

  .empty { padding: 2.2rem; text-align: center; }
  .empty p { margin: 0 0 0.5rem; }
  .empty .btn { margin-top: 1rem; }

  @media (max-width: 640px) {
    .page { padding: 1.6rem 1rem 2.5rem; }
    .group { padding: 1rem; }
    .empty { padding: 1.6rem 1.1rem; }
  }
</style>
