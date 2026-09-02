<script lang="ts">
  /**
   * Proposition d'une entreprise absente du repertoire.
   *
   * Seul le nom est obligatoire: exiger une adresse complete decouragerait les
   * contributions, et le geocodage cote serveur sait degrader (ville seule,
   * voire nom seul). L'entreprise est ensuite visible et filtrable par tous.
   *
   * Les champs eux-memes vivent dans CompanyFields, partages avec l'ecran de
   * correction: une fiche doit se corriger comme elle s'ecrit.
   */
  import { goto } from '$app/navigation';
  import { api, ApiError } from '$lib/api';
  import CompanyFields from '$lib/components/CompanyFields.svelte';
  import { authReady, user } from '$lib/stores/auth';
  import { addCompany, facets, loadCompanies } from '$lib/stores/companies';
  import type {
    Company,
    CompanyDetail,
    CompanyFormFields,
    Facets,
    SubmitConflict
  } from '$lib/types';

  let form = $state<CompanyFormFields>({
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
    linkedin: ''
  });
  let tags = $state<string[]>([]);
  let save = $state(true);
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
      const created = await api.post<CompanyDetail>('/api/companies', { ...form, tags, save });
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
    <CompanyFields bind:form bind:tags facets={$facets} />

    <label class="check card block save-check">
      <input type="checkbox" bind:checked={save} />
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

  .block { margin-bottom: 1rem; }

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
    .save-check { padding: 1rem 1.1rem; }
    .actions .btn { flex: 1 1 auto; }
  }
</style>
