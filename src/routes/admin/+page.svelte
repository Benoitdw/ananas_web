<script lang="ts">
  /**
   * Administration: le repertoire et les comptes.
   *
   * Deux onglets pour deux questions differentes — « cette fiche est-elle
   * juste ? » et « qui utilise l'outil ? ». Les entreprises reutilisent le
   * store de la carte: la liste est deja en memoire, la recherche est donc
   * instantanee et l'edition d'une fiche se reflete des le retour ici.
   *
   * La page ne protege rien par elle-meme: `/api/admin/*` repond 403 a un
   * compte ordinaire, et l'edition d'une fiche est autorisee cote serveur.
   * Ce qui suit ne fait que cacher ce qui serait de toute facon refuse.
   */
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { SOURCE_SHORT, sourceLabel, sourceShort } from '$lib/sources';
  import { authReady, user } from '$lib/stores/auth';
  import { companies, companyTags, loadCompanies } from '$lib/stores/companies';
  import type { AdminStats, AdminUser } from '$lib/types';

  let tab = $state<'companies' | 'users'>('companies');
  let q = $state('');
  let source = $state('');
  let users = $state<AdminUser[]>([]);
  let stats = $state<AdminStats | null>(null);
  let error = $state('');

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    if (!$authReady || !$user?.is_admin) return;
    if (!$companies.length) loadCompanies().catch(() => {});
    Promise.all([api.get<AdminUser[]>('/api/admin/users'), api.get<AdminStats>('/api/admin/stats')])
      .then(([u, s]) => {
        users = u;
        stats = s;
      })
      .catch(() => (error = 'Donnees d’administration indisponibles.'));
  });

  const rows = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return $companies.filter((c) => {
      if (source && c.source !== source) return false;
      if (!needle) return true;
      return `${c.name} ${c.city} ${c.type} ${companyTags(c).join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
  });

  const date = (iso: string) => new Date(iso).toLocaleDateString('fr-BE');
  const s = (n: number) => (n > 1 ? 's' : '');
</script>

<svelte:head><title>Administration — Ananas</title></svelte:head>

<div class="container page">
  {#if !$authReady}
    <p class="muted">Chargement…</p>
  {:else if !$user?.is_admin}
    <h1>Administration</h1>
    <p class="alert alert-warn">
      Cette page est reservee a l'administration. Si tu as propose une entreprise, tu peux la
      corriger depuis sa fiche sur <a href="/map">la carte</a>.
    </p>
  {:else}
    <h1>Administration</h1>

    {#if stats}
      <div class="stats">
        <div class="stat card">
          <strong>{stats.companies}</strong>
          <span class="small muted">entreprises</span>
          <span class="small muted breakdown">
            {Object.entries(stats.companies_by_source)
              .map(([s, n]) => `${n} ${sourceShort(s)}`)
              .join(' · ')}
          </span>
        </div>
        <div class="stat card">
          <strong>{stats.users}</strong>
          <span class="small muted">comptes</span>
          <span class="small muted breakdown">
            {stats.user_submissions} fiche{s(stats.user_submissions)} proposee{s(stats.user_submissions)}
          </span>
        </div>
        <div class="stat card">
          <strong>{stats.jobs_open}</strong>
          <span class="small muted">offres ouvertes</span>
          <span class="small muted breakdown">
            {stats.scrapers} scraper{s(stats.scrapers)} actif{s(stats.scrapers)}
          </span>
        </div>
      </div>
    {/if}

    {#if error}<p class="alert alert-error">{error}</p>{/if}

    <div class="tabs" role="tablist">
      <button
        role="tab"
        aria-selected={tab === 'companies'}
        class:active={tab === 'companies'}
        onclick={() => (tab = 'companies')}
      >
        Entreprises
      </button>
      <button
        role="tab"
        aria-selected={tab === 'users'}
        class:active={tab === 'users'}
        onclick={() => (tab = 'users')}
      >
        Utilisateurs ({users.length})
      </button>
    </div>

    {#if tab === 'companies'}
      <div class="toolbar">
        <input type="search" placeholder="Rechercher une entreprise…" bind:value={q} />
        <select bind:value={source} aria-label="Provenance">
          <option value="">Toutes provenances</option>
          {#each Object.entries(SOURCE_SHORT) as [value, label]}
            <option {value}>{label}</option>
          {/each}
        </select>
        <a class="btn btn-sm" href="/companies/new">Ajouter</a>
      </div>

      <p class="small muted count">{rows.length} sur {$companies.length}</p>

      <div class="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Ville</th>
              <th>Provenance</th>
              <th>Position</th>
              <th class="num">Offres</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as c (c.id)}
              <tr>
                <td>
                  <a href="/map?company={c.id}">{c.name}</a>
                  {#if c.type}<span class="small muted block">{c.type}</span>{/if}
                </td>
                <td>{c.city || '—'}</td>
                <td class="small">{sourceLabel(c.source)}</td>
                <td class="small" class:warn={c.geo_precision !== 'adresse'}>
                  {c.geo_precision || 'non localise'}
                </td>
                <td class="num">{c.has_scraper ? c.open_jobs : '—'}</td>
                <td class="num">
                  <a class="btn btn-ghost btn-sm" href="/companies/{c.id}/edit">Modifier</a>
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="muted empty">Aucune entreprise ne correspond.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="small muted count">
        Lecture seule. Ni CV, ni aspirations, ni identifiant Telegram ne sont exposes ici — ils ne
        servent pas a moderer un repertoire.
      </p>

      <div class="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Inscrit le</th>
              <th class="num">Suivies</th>
              <th class="num">Proposees</th>
              <th>Notifications</th>
              <th>Profil</th>
            </tr>
          </thead>
          <tbody>
            {#each users as u (u.id)}
              <tr>
                <td>
                  {u.email}
                  {#if u.is_admin}<span class="tag">admin</span>{/if}
                  {#if !u.is_active}<span class="tag off">desactive</span>{/if}
                </td>
                <td class="small">{date(u.created_at)}</td>
                <td class="num">{u.saved_companies}</td>
                <td class="num">{u.submitted_companies}</td>
                <td class="small">{u.channels ? 'configurees' : '—'}</td>
                <td class="small">{u.has_profile ? 'analyse' : '—'}</td>
              </tr>
            {:else}
              <tr><td colspan="6" class="muted empty">Aucun compte.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="small muted note">
        Le droit d'administration ne s'accorde pas depuis cette page: il se pose sur le serveur par
        <code>python -m ananas.admin</code>. Une elevation de privilege demande donc un acces
        machine, pas une faille dans un formulaire.
      </p>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 1.6rem 1.25rem 3rem; max-width: 1000px; }

  h1 { font-size: 1.6rem; margin-bottom: 1.1rem; }

  .stats { display: flex; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 1.4rem; }
  .stat {
    flex: 1 1 12rem;
    padding: 0.9rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .stat strong { font-size: 1.5rem; line-height: 1.1; }
  .breakdown { margin-top: 0.2rem; }

  .tabs { display: flex; gap: 1.1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.1rem; }
  .tabs button {
    border: none;
    background: none;
    padding: 0.5rem 0;
    margin-bottom: -1px;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }
  .tabs button:hover { color: var(--text); }
  .tabs button.active { color: var(--text); border-bottom-color: var(--brand); }

  .toolbar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .toolbar input { flex: 1 1 14rem; }
  .toolbar select { flex: 0 1 12rem; }

  .count { margin: 0.6rem 0; }

  /* Les tableaux debordent sur mobile: ils defilent dans leur carte plutot
     que d'etirer la page. */
  .table-wrap { overflow-x: auto; padding: 0; }

  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--border); }
  th {
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    white-space: nowrap;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--bg); }
  td .block { display: block; }
  .num { text-align: right; white-space: nowrap; }
  .warn { color: var(--warn, var(--muted)); }
  .empty { text-align: center; padding: 2rem; }

  .tag.off { opacity: 0.7; }

  .note { margin-top: 1rem; }

  @media (max-width: 640px) {
    .page { padding: 1.2rem 1rem 2.5rem; }
    .stat { flex: 1 1 100%; }
  }
</style>
