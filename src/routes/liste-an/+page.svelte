<script lang="ts">
  /** Onglet « Liste An »: les offres ouvertes des employeurs de la liste, sans
   *  score. Le serveur trie pour un profil scientifique et renvoie aussi ce
   *  qu'il ecarte, avec la raison: la case « voir les ecartees » permet de
   *  verifier que le filtre ne jette rien d'utile. Tout le reste (categorie,
   *  recherche, tri) se fait cote client. */
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { authReady, user } from '$lib/stores/auth';
  import type { ListeAnJob } from '$lib/types';

  let jobs = $state<ListeAnJob[]>([]);
  let loading = $state(true);
  let error = $state('');

  let q = $state('');
  let category = $state('');
  let companyFilter = $state('');
  let showExcluded = $state(false);

  type SortKey = 'title' | 'company' | 'category' | 'location' | 'date';
  let sortKey = $state<SortKey>('date');
  let sortDir = $state<'asc' | 'desc'>('desc');

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    if (!$authReady || !$user) return;
    loading = true;
    api
      .get<ListeAnJob[]>('/api/liste-an/jobs')
      .then((d) => (jobs = d))
      .catch(() => (error = 'Impossible de charger les offres.'))
      .finally(() => (loading = false));
  });

  const kept = $derived(jobs.filter((j) => !j.excluded));
  const excludedCount = $derived(jobs.length - kept.length);
  // Ce que les filtres voient: les ecartees seulement si on les demande.
  const pool = $derived(showExcluded ? jobs : kept);

  /** Categories avec leur nombre d'offres, dans le pool courant. */
  const categories = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const j of pool) counts.set(j.category, (counts.get(j.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  });

  const companies = $derived(
    [...new Set(pool.filter((j) => !category || j.category === category).map((j) => j.company_name))]
      .sort((a, b) => a.localeCompare(b, 'fr'))
  );

  function compare(a: ListeAnJob, b: ListeAnJob): number {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'title':
        return a.title.localeCompare(b.title, 'fr') * dir;
      case 'company':
        return a.company_name.localeCompare(b.company_name, 'fr') * dir || a.title.localeCompare(b.title, 'fr');
      case 'category':
        return a.category.localeCompare(b.category, 'fr') * dir || a.company_name.localeCompare(b.company_name, 'fr');
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
    return pool
      .filter((j) => {
        if (category && j.category !== category) return false;
        if (companyFilter && j.company_name !== companyFilter) return false;
        if (needle) {
          const hay = `${j.title} ${j.company_name} ${j.location ?? ''} ${j.department ?? ''}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(compare);
  });

  // Une entreprise choisie hors de la categorie courante n'a plus de sens.
  $effect(() => {
    if (companyFilter && !companies.includes(companyFilter)) companyFilter = '';
  });

  function sortBy(key: SortKey) {
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortKey = key;
      sortDir = key === 'date' ? 'desc' : 'asc';
    }
  }
  const arrow = (key: SortKey) => (sortKey !== key ? '' : sortDir === 'asc' ? ' ▲' : ' ▼');

  const hasFilters = $derived(!!q || !!category || !!companyFilter);
  function resetFilters() {
    q = '';
    category = '';
    companyFilter = '';
  }

  const fmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  const date = (iso: string) => fmt.format(new Date(iso));
</script>

<svelte:head><title>Liste An — Ananas</title></svelte:head>

<div class="container page">
  <h1>Liste An</h1>
  <p class="muted">
    Les offres ouvertes des employeurs de la liste, pour un profil scientifique. Les postes
    evidemment hors cible (technicien, informatique, finance, vente, soins…) et les consignes par
    employeur sont filtres — rien n'est perdu, ils restent consultables.
  </p>

  {#if error}
    <p class="alert alert-error">{error}</p>
  {:else if loading}
    <p class="muted">Chargement…</p>
  {:else if !jobs.length}
    <div class="card empty">
      <p>Aucune offre pour l'instant.</p>
      <p class="small muted">Le worker relevera les offres de la liste a sa prochaine passe.</p>
    </div>
  {:else}
    <div class="chips" role="group" aria-label="Categorie">
      <button class:on={!category} onclick={() => (category = '')}>
        Toutes <span class="n">{pool.length}</span>
      </button>
      {#each categories as [name, n]}
        <button class:on={category === name} onclick={() => (category = category === name ? '' : name)}>
          {name} <span class="n">{n}</span>
        </button>
      {/each}
    </div>

    <div class="filters">
      <input type="search" placeholder="Rechercher un titre, une entreprise, un lieu…" bind:value={q} />

      <select bind:value={companyFilter} aria-label="Filtrer par entreprise">
        <option value="">Toutes les entreprises</option>
        {#each companies as c}<option value={c}>{c}</option>{/each}
      </select>

      <label class="check small">
        <input type="checkbox" bind:checked={showExcluded} />
        Voir les ecartees ({excludedCount})
      </label>

      {#if hasFilters}
        <button class="link" onclick={resetFilters}>reinitialiser</button>
      {/if}
    </div>

    <p class="small muted total">
      {rows.length} offre{rows.length > 1 ? 's' : ''}
      {#if rows.length !== pool.length}<span> sur {pool.length}</span>{/if}
    </p>

    {#if !rows.length}
      <p class="muted">Aucune offre ne correspond a ces filtres.</p>
    {:else}
      <div class="table-wrap card">
        <table>
          <thead>
            <tr>
              <th><button onclick={() => sortBy('title')}>Offre{arrow('title')}</button></th>
              <th><button onclick={() => sortBy('company')}>Entreprise{arrow('company')}</button></th>
              <th><button onclick={() => sortBy('category')}>Categorie{arrow('category')}</button></th>
              <th><button onclick={() => sortBy('location')}>Lieu{arrow('location')}</button></th>
              <th><button onclick={() => sortBy('date')}>Vue le{arrow('date')}</button></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as job (job.id)}
              <tr class:excluded={job.excluded}>
                <td class="title">
                  <a href={job.url} target="_blank" rel="noopener">{job.title}</a>
                  {#if job.excluded}
                    <span class="why small">ecartee : {job.excluded}</span>
                  {:else if job.department}
                    <span class="why small muted">{job.department}</span>
                  {/if}
                </td>
                <td class="company">{job.company_name}</td>
                <td><span class="tag">{job.category}</span></td>
                <td>{job.location ?? '—'}</td>
                <td class="date">{date(job.first_seen_at)}</td>
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 1.2rem 0 0.9rem;
  }
  .chips button {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    padding: 0.3rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .chips button:hover { color: var(--text); }
  .chips button.on { background: var(--leaf); border-color: var(--leaf); color: #fff; }
  .chips .n { font-weight: 500; opacity: 0.75; margin-left: 0.15rem; }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.1rem;
  }
  .filters input[type='search'] { flex: 1 1 260px; min-width: 0; }
  .filters select { flex: 0 1 220px; }

  .check { display: flex; align-items: center; gap: 0.45rem; font-weight: 500; margin: 0; }
  .check input { width: auto; flex-shrink: 0; }

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

  .table-wrap {
    padding: 0;
    overflow: auto;
    max-height: calc(100vh - 22rem);
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

  td {
    padding: 0.6rem 0.7rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: #f7f5ef; }

  td.date { white-space: nowrap; color: var(--muted); }

  .title { min-width: 240px; }
  .title a { font-weight: 600; text-decoration: none; }
  .title a:hover { text-decoration: underline; }
  .why { display: block; margin-top: 0.15rem; }

  .company { font-weight: 500; }
  td .tag { white-space: nowrap; }

  tr.excluded td { opacity: 0.55; }
  tr.excluded .why { color: var(--brand-dark); opacity: 1; }

  .empty { padding: 2.2rem; text-align: center; }
  .empty p { margin: 0 0 0.5rem; }

  @media (max-width: 640px) {
    .page { padding: 1.6rem 1rem 2.5rem; }
    .empty { padding: 1.6rem 1.1rem; }
    .filters select { flex: 1 1 100%; }
    .table-wrap { max-height: none; min-height: 0; overflow-x: auto; overflow-y: visible; }
    th { position: static; }
  }
</style>
