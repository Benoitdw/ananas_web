<script lang="ts">
  /**
   * Ecran principal: sidebar de filtres + carte + fiche entreprise.
   * Le filtrage se fait cote client sur les 81 lignes deja chargees, ce qui
   * rend la recherche instantanee.
   */
  import { onMount } from 'svelte';
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
  import { authReady } from '$lib/stores/auth';
  import type { Company } from '$lib/types';

  let selectedId = $state<number | null>(null);
  let mapRef = $state<Map | null>(null);
  let error = $state('');

  const selected = $derived($filtered.find((c) => c.id === selectedId) ?? null);

  // On (re)charge apres la resolution de la session: la reponse porte
  // `is_saved`, qui depend de l'utilisateur connecte.
  let loadedFor = $state(false);
  $effect(() => {
    if ($authReady && !loadedFor) {
      loadedFor = true;
      loadCompanies().catch(() => (error = 'Impossible de charger les entreprises.'));
    }
  });

  function select(id: number) {
    selectedId = id;
    const company = $filtered.find((c) => c.id === id);
    if (company) mapRef?.focus(company);
  }

  async function onToggle(company: Company) {
    try {
      await toggleSaved(company);
    } catch {
      error = 'Connecte-toi pour enregistrer une entreprise.';
    }
  }

  function reset() {
    $filters = { q: '', type: '', core_business: '', savedOnly: false };
  }
</script>

<svelte:head><title>Carte des entreprises — Ananas</title></svelte:head>

<div class="layout">
  <aside class="sidebar">
    <div class="filters">
      <input type="search" placeholder="Rechercher…" bind:value={$filters.q} />

      <select bind:value={$filters.type}>
        <option value="">Tous les types</option>
        {#each $facets.types as type}<option value={type}>{type}</option>{/each}
      </select>

      <select bind:value={$filters.core_business}>
        <option value="">Tous les secteurs</option>
        {#each $facets.core_businesses as sector}<option value={sector}>{sector}</option>{/each}
      </select>

      <label class="check">
        <input type="checkbox" bind:checked={$filters.savedOnly} />
        Seulement mes entreprises enregistrees
      </label>

      <div class="count small muted">
        {#if $loading}
          Chargement…
        {:else}
          {$filtered.length} entreprise{$filtered.length > 1 ? 's' : ''}
          {#if $unlocated.length}
            · {$unlocated.length} sans position
          {/if}
          <button class="link" onclick={reset}>reinitialiser</button>
        {/if}
      </div>
    </div>

    {#if error}
      <p class="alert alert-error small">{error}</p>
    {/if}

    <ul class="list">
      {#each $filtered as company (company.id)}
        <li>
          <button
            class="row"
            class:active={company.id === selectedId}
            class:unlocated={company.lat === null}
            onclick={() => select(company.id)}
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
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: 310px 1fr;
    height: calc(100vh - 56px);
  }

  .layout:has(.detail) { grid-template-columns: 310px 1fr 340px; }

  .sidebar {
    border-right: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .filters {
    padding: 0.9rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 500;
    font-size: 0.87rem;
    margin: 0;
  }
  .check input { width: auto; }

  .count { display: flex; align-items: center; gap: 0.4rem; }

  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--leaf-dark);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    margin-left: auto;
  }

  .list { list-style: none; margin: 0; padding: 0.35rem; overflow-y: auto; flex: 1; }

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
  }

  .map-area { min-width: 0; }

  .detail { border-left: 1px solid var(--border); min-height: 0; background: var(--surface); }

  @media (max-width: 900px) {
    .layout, .layout:has(.detail) { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .sidebar { max-height: 40vh; }
    .detail { position: fixed; inset: 56px 0 0 auto; width: min(360px, 100%); z-index: 15; }
  }
</style>
