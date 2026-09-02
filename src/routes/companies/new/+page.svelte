<script lang="ts">
  /**
   * Proposition d'une entreprise absente du repertoire.
   *
   * Seul le nom est obligatoire: exiger une adresse complete decouragerait les
   * contributions, et le geocodage cote serveur sait degrader (ville seule,
   * voire nom seul). L'entreprise est ensuite visible et filtrable par tous.
   */
  import { goto } from '$app/navigation';
  import { api, ApiError } from '$lib/api';
  import TagInput from '$lib/components/TagInput.svelte';
  import { authReady, user } from '$lib/stores/auth';
  import { addCompany, facets, loadCompanies } from '$lib/stores/companies';
  import type { Company, CompanyDetail, Facets, SubmitConflict } from '$lib/types';

  let form = $state({
    name: '',
    website: '',
    careers_url: '',
    type: '',
    baseline: '',
    description: '',
    street: '',
    postal_code: '',
    city: '',
    country: 'Belgium',
    email: '',
    phone: '',
    linkedin: '',
    save: true
  });
  let tags = $state<string[]>([]);
  let moreOpen = $state(false);
  let busy = $state(false);
  let error = $state('');
  let conflict = $state<SubmitConflict | null>(null);

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  // Les facettes alimentent l'autocompletion des tags et la liste des types.
  $effect(() => {
    if ($authReady && $user && !$facets.tags.length) {
      api.get<Facets>('/api/companies/facets').then((f) => facets.set(f)).catch(() => {});
    }
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    conflict = null;
    busy = true;
    try {
      const created = await api.post<CompanyDetail>('/api/companies', { ...form, tags });
      // Injecte dans le store si la carte a deja ete chargee, sinon elle la
      // trouvera a son prochain chargement.
      addCompany(created as unknown as Company);
      loadCompanies().catch(() => {});
      goto('/map');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        conflict = err.body as SubmitConflict;
      } else {
        error =
          err instanceof ApiError ? err.message : 'Service indisponible, reessaie dans un instant.';
      }
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Proposer une entreprise — Ananas</title></svelte:head>

<div class="container page">
  <a class="back small" href="/map">← Retour a la carte</a>
  <h1>Proposer une entreprise</h1>
  <p class="muted">
    Elle rejoindra le repertoire et sera visible par tout le monde. Seul le nom est obligatoire —
    l'adresse sert a la placer sur la carte.
  </p>

  <form onsubmit={submit}>
    <section class="card block">
      <div class="field">
        <label for="name">Nom de l'entreprise <span class="req">*</span></label>
        <input id="name" type="text" bind:value={form.name} required minlength="2" />
      </div>

      <div class="field">
        <label for="tags">Tags</label>
        <TagInput bind:value={tags} suggestions={$facets.tags} />
        <p class="small muted hint">
          Ce sont eux qui permettront aux autres de la retrouver dans les filtres. Reutilise les
          tags proposes plutot que d'en inventer des variantes.
        </p>
      </div>

      <div class="row">
        <div class="field">
          <label for="website">Site web</label>
          <input id="website" type="text" bind:value={form.website} placeholder="exemple.com" />
        </div>
        <div class="field">
          <label for="careers">Page carrieres</label>
          <input
            id="careers"
            type="text"
            bind:value={form.careers_url}
            placeholder="exemple.com/jobs"
          />
        </div>
      </div>
      <p class="small muted hint">
        La page carrieres n'est pas encore surveillee automatiquement — il faut un scraper pour
        cette entreprise. Elle est enregistree pour le jour ou il existera.
      </p>
    </section>

    <section class="card block">
      <h2>Adresse</h2>
      <p class="small muted">
        Sans adresse, l'entreprise sera dans la liste mais pas sur la carte. Une ville seule suffit
        pour un placement approximatif.
      </p>

      <div class="field">
        <label for="street">Rue et numero</label>
        <input id="street" type="text" bind:value={form.street} />
      </div>

      <div class="row">
        <div class="field cp">
          <label for="cp">Code postal</label>
          <input id="cp" type="text" bind:value={form.postal_code} />
        </div>
        <div class="field">
          <label for="city">Ville</label>
          <input id="city" type="text" bind:value={form.city} />
        </div>
        <div class="field">
          <label for="country">Pays</label>
          <input id="country" type="text" bind:value={form.country} />
        </div>
      </div>
    </section>

    <section class="card block">
      <button type="button" class="disclose" onclick={() => (moreOpen = !moreOpen)}>
        {moreOpen ? '▾' : '▸'} Informations complementaires (facultatif)
      </button>

      {#if moreOpen}
        <div class="more">
          <div class="field">
            <label for="type">Type d'organisation</label>
            <input id="type" type="text" bind:value={form.type} list="types" />
            <datalist id="types">
              {#each $facets.types as t}<option value={t}></option>{/each}
            </datalist>
          </div>

          <div class="field">
            <label for="baseline">En une phrase</label>
            <input id="baseline" type="text" bind:value={form.baseline} maxlength="500" />
          </div>

          <div class="field">
            <label for="description">Description</label>
            <textarea id="description" bind:value={form.description} rows="4" maxlength="4000"
            ></textarea>
          </div>

          <div class="row">
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="text" bind:value={form.email} />
            </div>
            <div class="field">
              <label for="phone">Telephone</label>
              <input id="phone" type="text" bind:value={form.phone} />
            </div>
          </div>

          <div class="field">
            <label for="linkedin">LinkedIn</label>
            <input id="linkedin" type="text" bind:value={form.linkedin} />
          </div>
        </div>
      {/if}
    </section>

    <label class="check card block save-check">
      <input type="checkbox" bind:checked={form.save} />
      <span>
        <strong>Enregistrer dans ma veille</strong>
        <span class="small muted">
          Elle apparaitra en orange sur la carte, et tu seras prevenu de ses nouvelles offres.
        </span>
      </span>
    </label>

    {#if conflict}
      <div class="alert alert-warn">
        <p>{conflict.detail}</p>
        <a class="btn btn-sm" href="/map?company={conflict.company_id}">
          Ouvrir « {conflict.company_name} »
        </a>
      </div>
    {/if}

    {#if error}
      <p class="alert alert-error">{error}</p>
    {/if}

    <div class="actions">
      <button class="btn" type="submit" disabled={busy}>
        {busy ? 'Localisation en cours…' : "Ajouter l'entreprise"}
      </button>
      <a class="btn btn-ghost" href="/map">Annuler</a>
    </div>
    <p class="small muted">
      L'adresse est localisee au moment de l'envoi, cela prend une seconde ou deux.
    </p>
  </form>
</div>

<style>
  .page { padding: 1.6rem 1.25rem 3rem; max-width: 620px; }

  .back { display: inline-block; margin-bottom: 0.8rem; text-decoration: none; }

  h1 { font-size: 1.6rem; }

  form { margin-top: 1.4rem; }

  .block { padding: 1.4rem; margin-bottom: 1rem; }
  .block h2 { font-size: 1rem; }

  .field { margin-bottom: 1rem; min-width: 0; }
  .field:last-child { margin-bottom: 0; }

  .req { color: var(--danger); }

  .row { display: flex; gap: 0.7rem; flex-wrap: wrap; }
  .row .field { flex: 1 1 9rem; }
  .row .field.cp { flex: 0 1 7rem; }

  .hint { margin: 0.35rem 0 0; }

  textarea {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    resize: vertical;
  }

  .disclose {
    border: none;
    background: none;
    padding: 0;
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
  }

  .more { margin-top: 1.1rem; }

  .save-check {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    padding: 1.1rem 1.4rem;
    font-weight: 400;
    cursor: pointer;
  }
  .save-check input { width: auto; margin-top: 0.25rem; flex-shrink: 0; }
  .save-check span { display: flex; flex-direction: column; gap: 0.15rem; }

  .alert { margin-bottom: 1rem; }
  .alert p { margin: 0 0 0.6rem; }

  .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.6rem; }

  @media (max-width: 640px) {
    .page { padding: 1.2rem 1rem 2.5rem; }
    .block { padding: 1.1rem; }
    .save-check { padding: 1rem 1.1rem; }
    .actions .btn { flex: 1 1 auto; }
  }
</style>
