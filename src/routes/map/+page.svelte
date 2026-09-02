<script lang="ts">
  /**
   * Ecran principal: filtres + carte + fiche entreprise.
   *
   * Deux dispositions selon la largeur:
   *  - desktop: trois colonnes cote a cote (liste | carte | fiche);
   *  - mobile: une seule vue a la fois. La carte et la liste se partagent
   *    l'ecran via une bascule, les filtres se replient, et la fiche s'ouvre
   *    en plein ecran. Aucun des trois panneaux n'est utilisable a 390px de
   *    large s'il doit partager la place.
   *
   * Le filtrage se fait cote client sur les 81 lignes deja chargees, ce qui
   * rend la recherche instantanee.
   */
  import Map from '$lib/components/Map.svelte';
  import CompanyPanel from '$lib/components/CompanyPanel.svelte';
  import {
    facets,
    filtered,
    filters,
    loadCompanies,
    loading,
    mappable,
    toggleSaved,
    unlocated
  } from '$lib/stores/companies';
  import { authReady, user } from '$lib/stores/auth';
  import { page } from '$app/state';
  import type { Company } from '$lib/types';

  let selectedId = $state<number | null>(null);
  let mapRef = $state<Map | null>(null);
  let error = $state('');

  // Etat propre au mobile; ignore par la mise en page desktop.
  let mobileView = $state<'map' | 'list'>('map');
  let filtersOpen = $state(false);

  const selected = $derived($filtered.find((c) => c.id === selectedId) ?? null);
  const activeFilters = $derived(
    Number(!!$filters.type) +
      Number(!!$filters.tag) +
      Number(!!$filters.source) +
      Number($filters.savedOnly)
  );

  // On (re)charge apres la resolution de la session: la reponse porte
  // `is_saved`, qui depend de l'utilisateur connecte.
  let loadedFor = $state(false);
  $effect(() => {
    if ($authReady && !loadedFor) {
      loadedFor = true;
      loadCompanies().catch(() => (error = 'Impossible de charger les entreprises.'));
    }
  });

  // Lien profond ?company=<id>, utilise par le formulaire quand l'entreprise
  // proposee existe deja: on ouvre la fiche existante au lieu du doublon.
  let deepLinked = $state(false);
  $effect(() => {
    const id = Number(page.url.searchParams.get('company'));
    if (!deepLinked && id && $filtered.some((c) => c.id === id)) {
      deepLinked = true;
      select(id);
    }
  });

  // La carte reste montee quand elle est masquee: MapLibre ne detecte pas un
  // passage par display:none, il faut le lui dire au retour.
  $effect(() => {
    if (mobileView === 'map') requestAnimationFrame(() => mapRef?.resize());
  });

  function select(id: number) {
    selectedId = id;
    const company = $filtered.find((c) => c.id === id);
    if (company) mapRef?.focus(company);
  }

  /** Depuis la liste sur mobile: on bascule sur la carte en meme temps que la
   *  fiche s'ouvre, pour que la fermeture revele le marqueur. */
  function selectFromList(id: number) {
    select(id);
    mobileView = 'map';
  }

  async function onToggle(company: Company) {
    try {
      await toggleSaved(company);
    } catch {
      error = 'Connecte-toi pour enregistrer une entreprise.';
    }
  }

  function reset() {
    $filters = { q: '', type: '', tag: '', source: '', savedOnly: false };
  }
</script>

<svelte:head><title>Carte des entreprises — Ananas</title></svelte:head>

<div class="layout" class:has-detail={!!selected} class:show-list={mobileView === 'list'}>
  <aside class="sidebar">
   <div class="controls">
    <div class="toolbar">
      <input type="search" placeholder="Rechercher…" bind:value={$filters.q} />

      <button
        class="btn btn-ghost btn-sm filters-toggle"
        onclick={() => (filtersOpen = !filtersOpen)}
        aria-expanded={filtersOpen}
      >
        Filtres{activeFilters ? ` (${activeFilters})` : ''}
      </button>
    </div>

    <div class="filters" class:open={filtersOpen}>
      <select bind:value={$filters.type} aria-label="Type d'organisation">
        <option value="">Tous les types</option>
        {#each $facets.types as type}<option value={type}>{type}</option>{/each}
      </select>

      <select bind:value={$filters.tag} aria-label="Tag">
        <option value="">Tous les tags</option>
        {#each $facets.tags as tag}<option value={tag}>{tag}</option>{/each}
      </select>

      <select bind:value={$filters.source} aria-label="Provenance">
        <option value="">Toutes provenances</option>
        <option value="biowin">Repertoire BioWin</option>
        <option value="from_user">Proposees par des utilisateurs</option>
      </select>

      <label class="check">
        <input type="checkbox" bind:checked={$filters.savedOnly} />
        Seulement mes entreprises enregistrees
      </label>
    </div>

    {#if $user}
      <a class="btn btn-ghost btn-sm add" href="/companies/new">+ Proposer une entreprise</a>
    {/if}

    <div class="count small muted">
      {#if $loading}
        Chargement…
      {:else}
        <span>
          {$filtered.length} entreprise{$filtered.length > 1 ? 's' : ''}
          {#if $unlocated.length}· {$unlocated.length} sans position{/if}
        </span>
        <button class="link" onclick={reset}>reinitialiser</button>
      {/if}
    </div>

    {#if error}
      <p class="alert alert-error small">{error}</p>
    {/if}
   </div>

    <ul class="list">
      {#each $filtered as company (company.id)}
        <li>
          <button
            class="row"
            class:active={company.id === selectedId}
            class:unlocated={company.lat === null}
            onclick={() => selectFromList(company.id)}
          >
            <span class="dot" class:saved={company.is_saved}></span>
            <span class="text">
              <strong>{company.name}</strong>
              <span class="small muted">{company.city || 'position inconnue'}</span>
            </span>
            {#if company.open_jobs}
              <span class="badge">{company.open_jobs}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <div class="map-area">
    <Map bind:this={mapRef} companies={$mappable} {selectedId} onselect={select} />
  </div>

  {#if selected}
    <div class="detail">
      <CompanyPanel company={selected} onclose={() => (selectedId = null)} ontoggle={onToggle} />
    </div>
  {/if}

  <!-- Bascule carte/liste: n'existe qu'en dessous de 900px -->
  <div class="switcher" role="group" aria-label="Affichage">
    <button class:on={mobileView === 'map'} onclick={() => (mobileView = 'map')}>Carte</button>
    <button class:on={mobileView === 'list'} onclick={() => (mobileView = 'list')}>
      Liste <span class="n">{$filtered.length}</span>
    </button>
  </div>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: 310px minmax(0, 1fr);
    height: calc(100vh - 56px);
  }

  .layout.has-detail { grid-template-columns: 310px minmax(0, 1fr) 340px; }

  .sidebar {
    border-right: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    gap: 0.5rem;
    padding: 0.9rem 0.9rem 0.55rem;
  }
  .toolbar input { min-width: 0; }

  /* Sur desktop les filtres sont toujours visibles: le bouton n'a pas lieu d'etre */
  .filters-toggle { display: none; white-space: nowrap; }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0 0.9rem 0.55rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 500;
    font-size: 0.87rem;
    margin: 0;
  }
  .check input { width: auto; flex-shrink: 0; }

  .controls {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .add {
    display: block;
    margin: 0 0.9rem 0.7rem;
    text-align: center;
  }

  .count {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 0.9rem 0.7rem;
  }

  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--leaf-dark);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    white-space: nowrap;
  }

  .list { list-style: none; margin: 0; padding: 0.35rem; overflow-y: auto; flex: 1; min-height: 0; }

  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.5rem 0.55rem;
    border: none;
    border-radius: 8px;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: #f4f1ea; }
  .row.active { background: #eaf5f3; }
  .row.unlocated { opacity: 0.6; }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--leaf);
    flex-shrink: 0;
  }
  .dot.saved { background: var(--saved); width: 11px; height: 11px; }

  .text { display: flex; flex-direction: column; min-width: 0; }
  .text strong {
    font-size: 0.89rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    margin-left: auto;
    background: var(--leaf);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .map-area { min-width: 0; }

  .detail {
    border-left: 1px solid var(--border);
    min-height: 0;
    background: var(--surface);
  }

  .switcher { display: none; }

  /* --------------------------------------------------------------- mobile */

  @media (max-width: 900px) {
    /* Une seule vue occupe l'ecran: a cette largeur, deux panneaux cote a cote
       sont illisibles tous les deux. */
    .layout, .layout.has-detail {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      position: relative;
    }

    /* display:contents dissout la sidebar: ses deux blocs deviennent des
       elements de grille a part entiere. Les controles occupent la premiere
       rangee et restent visibles quelle que soit la vue — sans ça, on ne
       pourrait pas filtrer ce que la carte affiche. */
    .sidebar { display: contents; }
    .controls { grid-area: 1 / 1; border-right: none; }

    .list, .map-area { grid-area: 2 / 1; min-height: 0; }
    .list {
      display: none;
      background: var(--surface);
      z-index: 5;
      /* Les dernieres entreprises doivent pouvoir defiler au-dessus du
         commutateur flottant, sinon elles sont inatteignables. */
      padding-bottom: 4.5rem;
    }
    .layout.show-list .list { display: block; }

    .filters { display: none; }
    .filters.open { display: flex; }
    .filters-toggle { display: inline-flex; }

    /* La fiche passe en plein ecran: sur 390px, un panneau lateral de 340px
       ne laisse rien voir de la carte derriere. */
    .detail {
      position: fixed;
      inset: 56px 0 0 0;
      z-index: 25;
      border-left: none;
    }

    .switcher {
      display: flex;
      position: absolute;
      /* Assez haut pour ne pas recouvrir l'attribution OpenStreetMap,
         qui doit rester lisible. */
      bottom: 1.8rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .switcher button {
      border: none;
      background: none;
      padding: 0.5rem 1.05rem;
      font-weight: 600;
      font-size: 0.87rem;
      color: var(--muted);
      cursor: pointer;
      white-space: nowrap;
    }
    .switcher button.on { background: var(--leaf); color: #fff; }
    .switcher .n { opacity: 0.75; font-weight: 500; }

    /* Le commutateur est ancre a la carte, il ne doit pas flotter sur la fiche */
    .layout.has-detail .switcher { display: none; }
  }

  @media (max-width: 360px) {
    .switcher button { padding: 0.5rem 0.85rem; font-size: 0.82rem; }
    /* Le compteur fait deborder le bouton sur les tres petits ecrans */
    .switcher .n { display: none; }
  }
</style>
