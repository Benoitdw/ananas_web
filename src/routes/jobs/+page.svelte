<script lang="ts">
  /** Le pendant web de la notification quotidienne. */
  import { goto } from '$app/navigation';
  import { api, ApiError } from '$lib/api';
  import MatchBadge from '$lib/components/MatchBadge.svelte';
  import { authReady, user } from '$lib/stores/auth';
  import type { JobWithCompany } from '$lib/types';

  let jobs = $state<JobWithCompany[]>([]);
  let scope = $state<'saved' | 'all'>('saved');
  let includeClosed = $state(false);
  let includeHidden = $state(false);
  let relevantOnly = $state(false);
  let sort = $state<'date' | 'score'>('date');
  let loading = $state(true);
  let error = $state('');
  // Entreprises dont on vient de basculer le suivi, offres qu'on vient de
  // masquer/reafficher: en attente que le serveur confirme, pour desactiver
  // le bouton plutot que de laisser un double-clic partir en double appel.
  let pending = $state(new Set<number>());
  // Entreprises repliees. En memoire seulement: une visite fraiche repart
  // tout depliee, ce qui reste le repere le plus previsible.
  let collapsed = $state(new Set<string>());

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    const params = new URLSearchParams({
      include_closed: String(includeClosed),
      include_hidden: String(includeHidden),
      relevant_only: String(relevantOnly),
      sort,
      scope
    });
    if (!$authReady || !$user) return;
    loading = true;
    api
      .get<JobWithCompany[]>(`/api/me/jobs?${params}`)
      .then((d) => {
        jobs = d;
        pending = new Set();
      })
      .catch(() => (error = 'Impossible de charger les offres.'))
      .finally(() => (loading = false));
  });

  /** Regroupe par entreprise, comme le fait la notification Telegram. Les
   *  entreprises suivies d'abord: c'est la veille qui interesse en premier. */
  const grouped = $derived.by(() => {
    const map = new Map<string, JobWithCompany[]>();
    for (const job of jobs) {
      const list = map.get(job.company_name) ?? [];
      list.push(job);
      map.set(job.company_name, list);
    }
    return [...map.entries()].sort(
      ([, a], [, b]) => Number(b[0].company_saved) - Number(a[0].company_saved)
    );
  });

  function toggleCollapsed(company: string) {
    const next = new Set(collapsed);
    if (next.has(company)) next.delete(company);
    else next.add(company);
    collapsed = next;
  }

  /** Bascule le suivi d'une entreprise directement depuis le feed — la raison
   *  d'etre du scope "toutes les entreprises" est justement de decouvrir une
   *  offre puis de suivre l'entreprise qui la propose. */
  async function toggleFollow(companyId: number, saved: boolean) {
    pending = new Set([...pending, companyId]);
    jobs = jobs.map((j) => (j.company_id === companyId ? { ...j, company_saved: !saved } : j));
    try {
      if (saved) await api.del(`/api/me/companies/${companyId}`);
      else await api.put(`/api/me/companies/${companyId}`);
    } catch (err) {
      jobs = jobs.map((j) => (j.company_id === companyId ? { ...j, company_saved: saved } : j));
      error = err instanceof ApiError ? err.message : 'Le suivi n’a pas pu etre mis a jour.';
    } finally {
      pending = new Set([...pending].filter((id) => id !== companyId));
    }
  }

  /** Ecarte ou reaffiche une offre. Quand les offres masquees ne sont pas
   *  affichees, la masquer la retire simplement de la liste — pas besoin
   *  d'un etat "masquee" visible pour ca. */
  async function toggleHidden(job: JobWithCompany) {
    pending = new Set([...pending, job.id]);
    const removed = !includeHidden && !job.is_hidden;
    jobs = removed
      ? jobs.filter((j) => j.id !== job.id)
      : jobs.map((j) => (j.id === job.id ? { ...j, is_hidden: !j.is_hidden } : j));
    try {
      if (job.is_hidden) await api.del(`/api/me/jobs/${job.id}/hidden`);
      else await api.put(`/api/me/jobs/${job.id}/hidden`);
    } catch (err) {
      jobs = removed ? [...jobs, job] : jobs.map((j) => (j.id === job.id ? job : j));
      error = err instanceof ApiError ? err.message : 'L’offre n’a pas pu etre mise a jour.';
    } finally {
      pending = new Set([...pending].filter((id) => id !== job.id));
    }
  }

  const fmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  const date = (iso: string) => fmt.format(new Date(iso));
</script>

<svelte:head><title>Mes offres — Ananas</title></svelte:head>

<div class="container page">
  <h1>Offres</h1>
  <p class="muted">
    {#if scope === 'saved'}
      Les offres ouvertes chez les entreprises que tu as enregistrees. C'est le meme contenu que ta
      notification quotidienne.
    {:else}
      Toutes les offres relevees dans le repertoire, entreprises non suivies comprises. Suis une
      entreprise depuis ici pour recevoir ses prochaines offres par notification.
    {/if}
  </p>

  <div class="controls">
    <div class="segmented" role="group" aria-label="Perimetre">
      <button class:on={scope === 'saved'} onclick={() => (scope = 'saved')}>Mes entreprises</button>
      <button class:on={scope === 'all'} onclick={() => (scope = 'all')}>Tout le repertoire</button>
    </div>

    <div class="segmented" role="group" aria-label="Tri">
      <button class:on={sort === 'date'} onclick={() => (sort = 'date')}>Plus recentes</button>
      <button class:on={sort === 'score'} onclick={() => (sort = 'score')}>Plus pertinentes</button>
    </div>

    <label class="check small">
      <input type="checkbox" bind:checked={relevantOnly} />
      Seulement les pertinentes
    </label>

    <label class="check small">
      <input type="checkbox" bind:checked={includeClosed} />
      Inclure les offres disparues
    </label>

    <label class="check small">
      <input type="checkbox" bind:checked={includeHidden} />
      Inclure les offres ecartees
    </label>
  </div>

  {#if error}
    <p class="alert alert-error">{error}</p>
  {:else if loading}
    <p class="muted">Chargement…</p>
  {:else if !jobs.length}
    <div class="card empty">
      <p>Aucune offre pour l'instant.</p>
      <p class="small muted">
        {#if scope === 'saved'}
          Enregistre des entreprises sur la carte: le worker relevera leurs offres a sa prochaine
          passe quotidienne.
        {:else}
          Aucun scraper n'a encore rien trouve dans le repertoire.
        {/if}
      </p>
      <a class="btn btn-brand" href="/map">Ouvrir la carte</a>
    </div>
  {:else}
    <p class="small muted total">{jobs.length} offre{jobs.length > 1 ? 's' : ''}</p>

    {#each grouped as [company, companyJobs]}
      {@const isCollapsed = collapsed.has(company)}
      <section class="card group">
        <h2>
          <button
            class="disclose"
            aria-expanded={!isCollapsed}
            onclick={() => toggleCollapsed(company)}
          >
            <span class="chevron" class:collapsed={isCollapsed}>▾</span>
            {company} <span class="tag">{companyJobs.length}</span>
          </button>
          {#if !companyJobs[0].company_saved}
            <button
              class="btn btn-sm follow"
              disabled={pending.has(companyJobs[0].company_id)}
              onclick={() => toggleFollow(companyJobs[0].company_id, false)}
            >
              ☆ Suivre
            </button>
          {:else if scope === 'all'}
            <button
              class="btn btn-ghost btn-sm follow"
              disabled={pending.has(companyJobs[0].company_id)}
              onclick={() => toggleFollow(companyJobs[0].company_id, true)}
            >
              ★ Suivie
            </button>
          {/if}
        </h2>
        {#if !isCollapsed}
          <ul>
            {#each companyJobs as job}
              <li class:closed={job.closed_at} class:hidden-job={job.is_hidden}>
                <MatchBadge score={job.match_score} reasons={job.match_reasons} />
                <span class="job">
                  <a href={job.url} target="_blank" rel="noopener">{job.title}</a>
                  <span class="meta small muted">
                    {#if job.location}{job.location} · {/if}
                    vue le {date(job.first_seen_at)}
                    {#if job.closed_at}· <em>fermee</em>{/if}
                    {#if job.is_hidden}· <em>ecartee</em>{/if}
                  </span>
                  {#if job.match_reasons.length}
                    <span class="why small muted">{job.match_reasons.slice(0, 2).join(' · ')}</span>
                  {/if}
                </span>
                <button
                  class="btn btn-ghost btn-sm dismiss"
                  disabled={pending.has(job.id)}
                  title={job.is_hidden ? 'Reafficher cette offre' : 'Cette offre ne m’interesse pas'}
                  onclick={() => toggleHidden(job)}
                >
                  {job.is_hidden ? '↺ Reafficher' : '✕'}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .page { padding: 2.2rem 1.25rem 3rem; max-width: 780px; }

  h1 { font-size: 1.6rem; }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.1rem;
    margin: 1.2rem 0;
  }

  .check { display: flex; align-items: center; gap: 0.45rem; font-weight: 500; margin: 0; }
  .check input { width: auto; flex-shrink: 0; }

  .segmented {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface);
  }
  .segmented button {
    border: none;
    background: none;
    padding: 0.32rem 0.8rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .segmented button.on { background: var(--leaf); color: #fff; }

  .total { margin-bottom: 0.8rem; }

  .group { padding: 1.1rem 1.3rem; margin-bottom: 0.9rem; }
  .group h2 { font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .group h2 .follow { margin-left: auto; font-weight: 600; }

  .disclose {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    font: inherit;
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
    text-align: left;
  }
  .chevron {
    display: inline-block;
    transition: transform 0.15s ease;
    color: var(--muted);
    font-size: 0.85em;
  }
  .chevron.collapsed { transform: rotate(-90deg); }

  .group ul { margin: 0.7rem 0 0; padding: 0; list-style: none; }
  .group li {
    display: flex;
    gap: 0.55rem;
    align-items: baseline;
    margin-bottom: 0.7rem;
    overflow-wrap: anywhere;
  }
  .job { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
  .why { opacity: 0.85; }
  .group li.closed { opacity: 0.55; }
  .group li.hidden-job { opacity: 0.5; }
  .group li.hidden-job .job a { text-decoration-line: line-through; }

  .dismiss {
    margin-left: auto;
    flex-shrink: 0;
    align-self: flex-start;
    white-space: nowrap;
  }

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
