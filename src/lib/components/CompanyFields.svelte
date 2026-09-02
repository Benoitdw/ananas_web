<script lang="ts">
  /**
   * Les champs d'une fiche d'entreprise, partages par la proposition
   * (`/companies/new`) et la correction (`/companies/[id]/edit`).
   *
   * Le composant ne connait ni l'envoi ni les boutons: chaque page garde son
   * verbe (POST ou PATCH), son libelle et sa gestion d'erreur. Il ne partage
   * que ce qui doit rester identique — les libelles, l'ordre et le decoupage
   * des champs — pour qu'une fiche corrigee se remplisse comme elle s'ecrit.
   */
  import TagInput from '$lib/components/TagInput.svelte';
  import type { CompanyFormFields, Facets } from '$lib/types';

  type Props = {
    form: CompanyFormFields;
    tags: string[];
    facets: Facets;
    /** Deplie d'emblee la section facultative — a l'edition, ces champs sont
     *  souvent deja remplis et les cacher donnerait l'impression de les perdre. */
    moreOpen?: boolean;
  };
  // $bindable sans que personne ne s'y lie: c'est l'etat local du depliage,
  // dont la valeur initiale vient de la page.
  let { form = $bindable(), tags = $bindable(), facets, moreOpen = $bindable(false) }: Props =
    $props();
</script>

<section class="card block">
  <div class="field">
    <label for="name">Nom de l'entreprise <span class="req">*</span></label>
    <input id="name" type="text" bind:value={form.name} required minlength="2" />
  </div>

  <div class="field">
    <label for="tags">Tags</label>
    <TagInput bind:value={tags} suggestions={facets.tags} />
    <p class="small muted hint">
      Ce sont eux qui permettront aux autres de la retrouver dans les filtres. Reutilise les tags
      proposes plutot que d'en inventer des variantes.
    </p>
  </div>

  <div class="row">
    <div class="field">
      <label for="website">Site web</label>
      <input id="website" type="text" bind:value={form.website} placeholder="exemple.com" />
    </div>
    <div class="field">
      <label for="careers">Page carrieres</label>
      <input id="careers" type="text" bind:value={form.careers_url} placeholder="exemple.com/jobs" />
    </div>
  </div>
  <p class="small muted hint">
    La page carrieres n'est pas encore surveillee automatiquement — il faut un scraper pour cette
    entreprise. Elle est enregistree pour le jour ou il existera.
  </p>
</section>

<section class="card block">
  <h2>Adresse</h2>
  <p class="small muted">
    Sans adresse, l'entreprise sera dans la liste mais pas sur la carte. Une ville seule suffit pour
    un placement approximatif.
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
          {#each facets.types as t}<option value={t}></option>{/each}
        </datalist>
      </div>

      <div class="field">
        <label for="baseline">En une phrase</label>
        <input id="baseline" type="text" bind:value={form.baseline} maxlength="500" />
      </div>

      <div class="field">
        <label for="description">Description</label>
        <textarea id="description" bind:value={form.description} rows="4" maxlength="4000"></textarea>
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

<style>
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

  @media (max-width: 640px) {
    .block { padding: 1.1rem; }
  }
</style>
