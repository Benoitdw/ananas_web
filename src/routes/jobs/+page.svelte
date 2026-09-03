<script lang="ts">
  /** Le pendant web de la notification quotidienne, en tableau: une ligne par
   *  offre, l'entreprise en colonne. Tout le filtrage, la recherche et le tri
   *  se font cote client sur les lignes deja chargees — instantane. */
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
  let loading = $state(true);
  let error = $state('');
  // Entreprises/offres dont on vient de basculer l'etat: en attente que le
  // serveur confirme, pour desactiver le bouton plutot que de laisser un
  // double-clic partir en double appel.
  let pending = $state(new Set<number>());

  // --- Etat du tableau: recherche plein texte + filtres par colonne + tri.
  let q = $state('');
  let companyFilter = $state('');
  let locationFilter = $state('');
  type SortKey = 'score' | 'title' | 'company' | 'location' | 'date';
  let sortKey = $state<SortKey>('date');
  let sortDir = $state<'asc' | 'desc'>('desc');

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    const params = new URLSearchParams({
      include_closed: String(includeClosed),
      include_hidden: String(includeHidden),
      relevant_only: String(relevantOnly),
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

  const companies = $derived(
    [...new Set(jobs.map((j) => j.company_name))].sort((a, b) => a.localeCompare(b, 'fr'))
  );
  const locations = $derived(
    [...new Set(jobs.map((j) => j.location).filter((l): l is string => !!l))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    )
  );

  /** Comparateur pour la colonne active. Les valeurs manquantes (score absent,
   *  lieu vide) passent toujours en fin, quel que soit le sens du tri. */
  function compare(a: JobWithCompany, b: JobWithCompany): number {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'score': {
        const x = a.match_score,
          y = b.match_score;
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x - y) * dir;
      }
      case 'title':
        return a.title.localeCompare(b.title, 'fr') * dir;
      case 'company':
        return (
          a.company_name.localeCompare(b.company_name, 'fr') * dir ||
          a.title.localeCompare(b.title, 'fr')
        );
      case 'location': {
        const x = a.location ?? '',
          y = b.location ?? '';
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return x.localeCompare(y, 'fr') * dir;
      }
      case 'date':
        return (a.first_seen_at < b.first_seen_at ? -1 : a.first_seen_at > b.first_seen_at ? 1 : 0) * dir;
    }
  }

  const rows = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return jobs
      .filter((j) => {
        if (companyFilter && j.company_name !== companyFilter) return false;
        if (locationFilter && j.location !== locationFilter) return false;
        if (needle) {
          const hay = `${j.title} ${j.company_name} ${j.location ?? ''}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(compare);
  });

  const hasFilters = $derived(!!q || !!companyFilter || !!locationFilter);

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      // Defaut sensé par colonne: score et date les plus élevés d'abord,
      // texte de A à Z.
      sortDir = key === 'title' || key === 'company' || key === 'location' ? 'asc' : 'desc';
    }
  }

  function resetFilters() {
    q = '';
    companyFilter = '';
    locationFilter = '';
  }

  const arrow = (key: SortKey) => (sortKey !== key ? '' : sortDir === 'asc' ? ' ▲' : ' ▼');

  /** Bascule le suivi d'une entreprise directement depuis le tableau — la
   *  raison d'etre du scope "tout le repertoire" est de decouvrir une offre
   *  puis de suivre l'entreprise qui la propose. */
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
   *  affichees, la masquer la retire simplement de la liste. */
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

  <div class="filters">
    <input type="search" placeholder="Rechercher un titre, une entreprise, un lieu…" bind:value={q} />

    <select bind:value={companyFilter} aria-label="Filtrer par entreprise">
      <option value="">Toutes les entreprises</option>
      {#each companies as c}<option value={c}>{c}</option>{/each}
    </select>

    <select bind:value={locationFilter} aria-label="Filtrer par lieu">
      <option value="">Tous les lieux</option>
      {#each locations as l}<option value={l}>{l}</option>{/each}
    </select>

    {#if hasFilters}
      <button class="link" onclick={resetFilters}>reinitialiser</button>
    {/if}
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
    <p class="small muted total">
      {rows.length} offre{rows.length > 1 ? 's' : ''}
      {#if rows.length !== jobs.length}<span class="muted"> sur {jobs.length}</span>{/if}
    </p>

    {#if !rows.length}
      <p class="muted">Aucune offre ne correspond a ces filtres.</p>
    {:else}
      <div class="table-wrap card">
        <table>
          <thead>
            <tr>
              <th class="num">
                <button onclick={() => sortBy('score')}>Score{arrow('score')}</button>
              </th>
              <th><button onclick={() => sortBy('title')}>Offre{arrow('title')}</button></th>
              <th><button onclick={() => sortBy('company')}>Entreprise{arrow('company')}</button></th>
              <th><button onclick={() => sortBy('location')}>Lieu{arrow('location')}</button></th>
              <th><button onclick={() => sortBy('date')}>Vue le{arrow('date')}</button></th>
              <th class="act"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as job (job.id)}
              <tr class:closed={job.closed_at} class:hidden-job={job.is_hidden}>
                <td class="num">
                  <MatchBadge score={job.match_score} reasons={job.match_reasons} />
                </td>
                <td class="title">
                  <a href={job.url} target="_blank" rel="noopener">{job.title}</a>
                  {#if job.closed_at}<span class="tag state">fermee</span>{/if}
                  {#if job.is_hidden}<span class="tag state">ecartee</span>{/if}
                  {#if job.match_reasons.length}
                    <span class="why small muted">{job.match_reasons.slice(0, 2).join(' · ')}</span>
                  {/if}
                </td>
                <td class="company">
                  <span class="cname">{job.company_name}</span>
                  {#if !job.company_saved}
                    <button
                      class="star"
                      title="Suivre cette entreprise"
                      disabled={pending.has(job.company_id)}
                      onclick={() => toggleFollow(job.company_id, false)}
                    >
                      ☆
                    </button>
                  {:else if scope === 'all'}
                    <button
                      class="star on"
                      title="Ne plus suivre"
                      disabled={pending.has(job.company_id)}
                      onclick={() => toggleFollow(job.company_id, true)}
                    >
                      ★
                    </button>
                  {/if}
                </td>
                <td>{job.location ?? '—'}</td>
                <td class="date">{date(job.first_seen_at)}</td>
                <td class="act">
                  <button
                    class="btn btn-ghost btn-sm dismiss"
                    disabled={pending.has(job.id)}
                    title={job.is_hidden ? 'Reafficher cette offre' : 'Cette offre ne m’interesse pas'}
                    onclick={() => toggleHidden(job)}
                  >
                    {job.is_hidden ? '↺' : '✕'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 2.2rem 1.25rem 3rem; max-width: 1120px; }

  h1 { font-size: 1.6rem; }

  .controls,
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.1rem;
  }
  .controls { margin: 1.2rem 0 0.9rem; }
  .filters { margin-bottom: 1.1rem; gap: 0.6rem; }
  .filters input[type='search'] { flex: 1 1 260px; min-width: 0; }
  .filters select { flex: 0 1 200px; }

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

  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--leaf-dark);
    cursor: pointer;
    text-decoration: underline;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .total { margin-bottom: 0.7rem; }

  /* Zone de defilement propre au tableau: c'est ce qui permet aux en-tetes de
     rester epingles pendant qu'on parcourt 200 lignes (un `overflow-x` seul
     rend `sticky` inoperant, faute de conteneur qui defile verticalement). */
  .table-wrap {
    padding: 0;
    overflow: auto;
    max-height: calc(100vh - 20rem);
    min-height: 16rem;
  }

  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--surface);
    text-align: left;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  th button {
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
    padding: 0.6rem 0.7rem;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }
  th button:hover { color: var(--text); }
  th.num button, th.num { text-align: center; }

  td {
    padding: 0.6rem 0.7rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: #f7f5ef; }

  td.num { text-align: center; white-space: nowrap; }
  td.date { white-space: nowrap; color: var(--muted); }

  .title { min-width: 220px; }
  .title a { font-weight: 600; text-decoration: none; }
  .title a:hover { text-decoration: underline; }
  .why { display: block; margin-top: 0.15rem; opacity: 0.85; }
  .tag.state { margin-left: 0.4rem; vertical-align: middle; }

  .company { white-space: nowrap; }
  .cname { font-weight: 500; }
  .star {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.2rem;
    vertical-align: baseline;
  }
  .star:hover { color: var(--brand-dark); }
  .star.on { color: var(--saved); }
  .star:disabled { opacity: 0.5; cursor: default; }

  td.act { text-align: right; white-space: nowrap; }
  .dismiss { padding: 0.25rem 0.5rem; }

  tr.closed td:not(.act) { opacity: 0.55; }
  tr.hidden-job td:not(.act) { opacity: 0.5; }
  tr.hidden-job .title a { text-decoration-line: line-through; }

  .empty { padding: 2.2rem; text-align: center; }
  .empty p { margin: 0 0 0.5rem; }
  .empty .btn { margin-top: 1rem; }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  @media (max-width: 640px) {
    .page { padding: 1.6rem 1rem 2.5rem; }
    .empty { padding: 1.6rem 1.1rem; }
    .filters select { flex: 1 1 100%; }

    /* Trop peu de hauteur pour une zone de defilement imbriquee: c'est la page
       entiere qui defile, et les en-tetes ne sont plus epingles. */
    .table-wrap { max-height: none; min-height: 0; overflow-x: auto; overflow-y: visible; }
    th { position: static; }
  }
</style>
