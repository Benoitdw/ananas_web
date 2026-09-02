<script lang="ts">
  /**
   * Correction d'une fiche du repertoire.
   *
   * Un seul ecran pour deux publics: l'administration, et l'utilisateur qui
   * corrige l'entreprise qu'il a proposee. C'est le serveur qui tranche
   * (`can_edit`), pas cette page — deux formulaires auraient fini par diverger,
   * et c'est toujours la version la plus permissive qui aurait fait foi.
   */
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api, ApiError } from '$lib/api';
  import CompanyFields from '$lib/components/CompanyFields.svelte';
  import { sourceLabel } from '$lib/sources';
  import { authReady, user } from '$lib/stores/auth';
  import { facets, loadCompanies } from '$lib/stores/companies';
  import type { CompanyDetail, CompanyFormFields, Facets, SubmitConflict } from '$lib/types';

  const id = $derived(Number(page.params.id));

  let detail = $state<CompanyDetail | null>(null);
  let form = $state<CompanyFormFields | null>(null);
  let tags = $state<string[]>([]);
  let loadError = $state('');
  let error = $state('');
  let conflict = $state<SubmitConflict | null>(null);
  let busy = $state(false);
  let saved = $state(false);

  /** '1210 BRUXELLES' -> 'BRUXELLES'. La colonne `city` stocke le code postal
   *  en prefixe; le champ Ville ne doit afficher que la commune. Le serveur
   *  recompose et sait de toute facon retirer un prefixe renvoye tel quel. */
  const bareCity = (city: string) => city.replace(/^\d{4,5}\s+/, '');

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    if (!$facets.tags.length) {
      api.get<Facets>('/api/companies/facets').then((f) => facets.set(f)).catch(() => {});
    }
  });

  $effect(() => {
    const wanted = id;
    api
      .get<CompanyDetail>(`/api/companies/${wanted}`)
      .then((d) => {
        if (id !== wanted) return;
        detail = d;
        tags = d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
        form = {
          name: d.name,
          website: d.website,
          careers_url: d.careers_url ?? '',
          type: d.type,
          baseline: d.baseline,
          description: d.description,
          street: d.street,
          postal_code: d.postal_code,
          city: bareCity(d.city),
          country: d.country,
          email: d.email,
          phone: d.phone,
          linkedin: d.linkedin
        };
      })
      .catch((err) => {
        loadError =
          err instanceof ApiError && err.status === 404
            ? 'Cette entreprise n’existe pas.'
            : 'Fiche indisponible.';
      });
  });

  /** Les secteurs BioWin (`core_business`) ne sont pas editables: ils viennent
   *  du repertoire d'origine et servent de vocabulaire commun. Les tags, si. */
  const inheritedTags = $derived(
    (detail?.core_business ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!form) return;
    error = '';
    conflict = null;
    saved = false;
    busy = true;
    try {
      detail = await api.patch<CompanyDetail>(`/api/companies/${id}`, { ...form, tags });
      // La carte porte le nom, la ville et les coordonnees: elle doit suivre.
      loadCompanies().catch(() => {});
      saved = true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) conflict = err.body as SubmitConflict;
      else
        error =
          err instanceof ApiError ? err.message : 'Service indisponible, reessaie dans un instant.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{detail ? `Modifier ${detail.name}` : 'Modifier'} — Ananas</title></svelte:head>

<div class="container page">
  <a class="back small" href="/map?company={id}">← Retour a la fiche</a>

  {#if loadError}
    <p class="alert alert-error">{loadError}</p>
  {:else if !detail || !form}
    <p class="muted">Chargement…</p>
  {:else if !detail.can_edit}
    <h1>Modifier une fiche</h1>
    <p class="alert alert-warn">
      Cette fiche appartient au repertoire partage. Seule l'administration peut la corriger, ou
      l'utilisateur qui l'a proposee.
    </p>
    <a class="btn btn-ghost" href="/map?company={id}">Voir la fiche</a>
  {:else}
    <h1>Modifier « {detail.name} »</h1>
    <p class="muted">
      Cette fiche est visible par tout le monde. La modifier corrige ce que voient les autres
      utilisateurs.
    </p>

    <dl class="meta card">
      <div><dt>Provenance</dt><dd>{sourceLabel(detail.source, detail.submitted_by_email)}</dd></div>
      <div><dt>Identifiant</dt><dd><code>{detail.slug}</code></dd></div>
      <div>
        <dt>Position</dt>
        <dd>{detail.geo_precision || 'non localise'}</dd>
      </div>
      {#if detail.scraper_key}
        <div><dt>Scraper</dt><dd><code>{detail.scraper_key}</code></dd></div>
      {/if}
    </dl>

    <form onsubmit={submit}>
      <CompanyFields bind:form bind:tags facets={$facets} moreOpen={true} />

      {#if inheritedTags.length}
        <section class="card block">
          <h2>Secteurs d'origine</h2>
          <p class="small muted">
            Herites du repertoire, non modifiables ici — ils servent de vocabulaire commun a tous
            les filtres. Ajoute un tag si la classification est a completer.
          </p>
          <div class="tags">
            {#each inheritedTags as tag}<span class="tag">{tag}</span>{/each}
          </div>
        </section>
      {/if}

      {#if conflict}
        <div class="alert alert-warn">
          <p>{conflict.detail}</p>
          <a class="btn btn-sm" href="/map?company={conflict.company_id}">
            Ouvrir « {conflict.company_name} »
          </a>
        </div>
      {/if}

      {#if error}<p class="alert alert-error">{error}</p>{/if}
      {#if saved}
        <p class="alert alert-ok">
          Enregistre. Position : {detail.geo_precision || 'non localise'}
          {#if detail.address}— {detail.address}{/if}
        </p>
      {/if}

      <div class="actions">
        <button class="btn" type="submit" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <a class="btn btn-ghost" href="/map?company={id}">Retour a la fiche</a>
        {#if $user?.is_admin}
          <a class="btn btn-ghost" href="/admin">Administration</a>
        {/if}
      </div>
      <p class="small muted">
        L'adresse n'est relocalisee que si tu la modifies — cela prend alors une seconde ou deux.
      </p>
    </form>
  {/if}
</div>

<style>
  .page { padding: 1.6rem 1.25rem 3rem; max-width: 620px; }

  .back { display: inline-block; margin-bottom: 0.8rem; text-decoration: none; }

  h1 { font-size: 1.6rem; }

  form { margin-top: 1.4rem; }

  .block { padding: 1.4rem; margin-bottom: 1rem; }
  .block h2 { font-size: 1rem; margin-bottom: 0.3rem; }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.6rem;
    padding: 0.9rem 1.1rem;
    margin-top: 1.2rem;
  }
  .meta div { display: flex; gap: 0.4rem; align-items: baseline; }
  .meta dt { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  .meta dd { margin: 0; font-size: 0.88rem; }
  .meta code { font-size: 0.82rem; }

  .tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.7rem; }

  .alert { margin-bottom: 1rem; }
  .alert p { margin: 0 0 0.6rem; }

  .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.6rem; }

  @media (max-width: 640px) {
    .page { padding: 1.2rem 1rem 2.5rem; }
    .block { padding: 1.1rem; }
    .actions .btn { flex: 1 1 auto; }
  }
</style>
