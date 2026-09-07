<script lang="ts">
  /**
   * CV et aspirations professionnelles.
   *
   * L'enregistrement declenche l'extraction (~5 s) puis le rescoring de toutes
   * les offres. On affiche ensuite ce qui a ete *compris* du CV: c'est la
   * seule facon pour l'utilisateur de constater qu'un metier vise ou une
   * competence a ete mal lue.
   *
   * Et de le corriger directement: chaque chip s'edite, et l'enregistrement
   * rescore. Passer par une reecriture du CV pour faire disparaitre une
   * competence mal lue serait un detour absurde — rien ne garantit d'ailleurs
   * qu'une seconde extraction ferait mieux.
   */
  import { api, ApiError } from '$lib/api';
  import TermInput from '$lib/components/TermInput.svelte';
  import { REMOTE, SENIORITY } from '$lib/types';
  import type { CvImport, Profile, ProfileData, ProfileDataUpdate } from '$lib/types';

  type Props = { profile: Profile; onsaved: (p: Profile) => void };
  let { profile, onsaved }: Props = $props();

  let cv = $state('');
  let aspirations = $state('');
  let busy = $state(false);

  // Resynchronise quand une *autre* version du profil arrive (chargement
  // initial, rechargement). On ne touche pas au texte en cours de saisie
  // apres un simple enregistrement, dont la version change pourtant: d'ou la
  // comparaison au contenu, pas a la version.
  let loadedFrom = $state<string | null>(null);
  $effect(() => {
    const key = `${profile.cv_text}\u0000${profile.aspirations}`;
    if (loadedFrom === null) {
      cv = profile.cv_text;
      aspirations = profile.aspirations;
      loadedFrom = key;
    }
  });
  let error = $state('');
  let justSaved = $state(false);

  // --- import PDF
  let fileInput: HTMLInputElement;
  let importing = $state(false);
  let importError = $state('');
  let imported = $state<CvImport | null>(null);
  let dragging = $state(false);

  const dirty = $derived(cv !== profile.cv_text || aspirations !== profile.aspirations);
  const empty = $derived(!cv.trim() && !aspirations.trim());

  const LABELS: Record<string, string> = {
    role_families: 'Metiers vises',
    seniority: 'Niveau',
    skills: 'Competences',
    domains: 'Secteurs',
    languages: 'Langues',
    locations: 'Lieux',
    remote: 'Teletravail',
    avoid: 'A eviter'
  };

  const understood = $derived.by(() => {
    const d = profile.data;
    if (!d) return [];
    return [
      ['role_families', d.role_families],
      ['seniority', [`${d.seniority}${d.years_experience ? ` · ${d.years_experience} ans` : ''}`]],
      ['skills', d.skills],
      ['domains', d.domains],
      ['languages', d.languages],
      ['locations', d.locations],
      ['remote', [d.remote]],
      ['avoid', d.avoid]
    ].filter(([, v]) => (v as string[]).length && (v as string[])[0]) as [string, string[]][];
  });

  // --- correction manuelle du profil structure

  /** Champs de type liste, dans l'ordre d'affichage. Les scalaires (niveau,
   *  teletravail) ont leur propre controle: ce sont des echelles fermees, pas
   *  du texte libre. */
  const TERM_FIELDS = ['role_families', 'skills', 'domains', 'languages', 'locations', 'avoid'] as const;
  type TermField = (typeof TERM_FIELDS)[number];

  const PLACEHOLDERS: Record<TermField, string> = {
    role_families: 'biologie cellulaire…',
    skills: 'western blot…',
    domains: 'oncologie…',
    languages: 'fr, en, nl…',
    locations: 'Bruxelles, Belgique…',
    avoid: 'stage…'
  };

  const SENIORITY_LABELS: Record<string, string> = {
    stage: 'Stage', junior: 'Junior', confirme: 'Confirme', senior: 'Senior',
    lead: 'Lead', direction: 'Direction', inconnu: 'Inconnu'
  };
  const REMOTE_LABELS: Record<string, string> = {
    sur_site: 'Sur site', hybride: 'Hybride', distanciel: 'Distanciel', inconnu: 'Inconnu'
  };

  let editing = $state(false);
  let draft = $state<ProfileData | null>(null);
  let savingData = $state(false);
  let dataError = $state('');
  let dataSaved = $state(false);

  /** Copie de travail. Sans elle, retirer un chip modifierait immediatement ce
   *  qui sert au calcul des scores, avant meme d'avoir valide. */
  function startEditing() {
    if (!profile.data) return;
    draft = structuredClone($state.snapshot(profile.data));
    editing = true;
    dataError = '';
    dataSaved = false;
  }

  function cancelEditing() {
    editing = false;
    draft = null;
  }

  const sameList = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  /** Seuls les champs reellement modifies partent: le PATCH ne touche pas au
   *  reste, et un envoi complet ecraserait ce qu'on n'affiche pas. */
  const dataChanges = $derived.by<ProfileDataUpdate>(() => {
    const before = profile.data;
    if (!draft || !before) return {};
    const changes: ProfileDataUpdate = {};
    for (const field of TERM_FIELDS) {
      if (!sameList(draft[field], before[field])) changes[field] = draft[field];
    }
    if (draft.seniority !== before.seniority) changes.seniority = draft.seniority;
    if (draft.remote !== before.remote) changes.remote = draft.remote;
    if (draft.years_experience !== before.years_experience)
      changes.years_experience = draft.years_experience;
    return changes;
  });

  const dataDirty = $derived(Object.keys(dataChanges).length > 0);

  async function saveData() {
    if (!dataDirty) {
      cancelEditing();
      return;
    }
    savingData = true;
    dataError = '';
    try {
      onsaved(await api.patch<Profile>('/api/me/profile/data', dataChanges));
      editing = false;
      draft = null;
      dataSaved = true;
    } catch (err) {
      dataError =
        err instanceof ApiError ? err.message : 'Correction impossible, reessaie dans un instant.';
    } finally {
      savingData = false;
    }
  }

  /** Remplit le champ CV a partir d'un PDF, sans lancer l'analyse: une
   *  extraction PDF melange souvent les colonnes, l'utilisateur doit pouvoir
   *  relire avant. */
  async function importPdf(file: File | undefined) {
    if (!file) return;
    importing = true;
    importError = '';
    imported = null;
    try {
      const result = await api.upload<CvImport>('/api/me/profile/cv-file', file);
      cv = result.text;
      imported = result;
    } catch (err) {
      importError =
        err instanceof ApiError ? err.message : "Impossible de lire ce fichier.";
    } finally {
      importing = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    importPdf(event.dataTransfer?.files?.[0]);
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    justSaved = false;
    try {
      const saved = await api.put2<Profile>('/api/me/profile', {
        cv_text: cv,
        aspirations
      });
      onsaved(saved);
      justSaved = true;
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : 'Service indisponible, reessaie dans un instant.';
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={save}>
  {#if !profile.ai_available}
    <p class="alert alert-warn small">
      Aucun modele n'est configure cote serveur (<code>GEMINI_API_KEY</code>). Tu peux enregistrer
      ton profil, mais aucun score ne sera calcule.
    </p>
  {/if}

  <div class="field">
    <label for="cv">Ton CV</label>
    <p class="small muted hint">The extraction is not ready yet. You can try it but we recommand you to ask a LLM to extract your CV in text.</p>
    <div
      class="dropzone"
      class:dragging
      ondragover={(e) => {
        e.preventDefault();
        dragging = true;
      }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
      role="presentation"
    >
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => fileInput.click()}
        disabled={importing}
      >
        {importing ? 'Lecture du PDF…' : 'Importer un PDF'}
      </button>
      <span class="small muted">ou depose ton CV ici</span>
      <input
        bind:this={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onchange={(e) => importPdf(e.currentTarget.files?.[0])}
      />
    </div>

    {#if importError}
      <p class="alert alert-error small">{importError}</p>
    {:else if imported}
      <p class="alert alert-ok small">
        <strong>{imported.filename}</strong> importe ({imported.pages}
        page{imported.pages > 1 ? 's' : ''}).
        {#if imported.method === 'modele'}
          Ce PDF etant un scan, le texte a ete transcrit automatiquement —
          relis-le attentivement.
        {:else}
          Relis le texte ci-dessous : une extraction PDF melange parfois les colonnes.
        {/if}
      </p>
    {/if}

    <textarea
      id="cv"
      bind:value={cv}
      rows="9"
      maxlength="40000"
      placeholder="Colle ici le texte de ton CV : experiences, competences, langues, localisation…"
    ></textarea>
    <p class="small muted hint">
      PDF ou texte colle a la main. Plus c'est detaille, plus les scores sont justes.
    </p>
  </div>

  <div class="field">
    <label for="aspirations">Ce que tu recherches</label>
    <textarea
      id="aspirations"
      bind:value={aspirations}
      rows="4"
      maxlength="4000"
      placeholder="Le poste vise, le secteur, le type de contrat, le teletravail… et ce que tu ne veux surtout pas."
    ></textarea>
    <p class="small muted hint">
      Dis aussi ce que tu veux <strong>eviter</strong> : ces offres seront fortement dequalifiees.
    </p>
  </div>

  <button class="btn" type="submit" disabled={busy || (!dirty && !!profile.data)}>
    {busy ? 'Analyse en cours…' : profile.data ? 'Mettre a jour mon profil' : 'Analyser mon profil'}
  </button>

  {#if busy}
    <p class="small muted">Extraction puis recalcul des scores de toutes les offres…</p>
  {/if}
  {#if error}
    <p class="alert alert-error small">{error}</p>
  {/if}
  {#if profile.status === 'error'}
    <p class="alert alert-error small">
      L'analyse a echoue : {profile.error}
    </p>
  {/if}
  {#if justSaved && profile.status === 'ok'}
    <p class="alert alert-ok small">Profil analyse, scores recalcules.</p>
  {/if}
</form>

{#if profile.data && !empty}
  <section class="understood">
    <header class="head">
      <h3>Ce qui a ete compris de ton profil</h3>
      {#if !editing}
        <button type="button" class="btn btn-ghost btn-sm" onclick={startEditing}>Corriger</button>
      {/if}
    </header>

    <p class="small muted">
      C'est ce qui sert au calcul des scores.
      {#if editing}
        Retire ce qui est faux, ajoute ce qui manque : les scores sont recalcules a
        l'enregistrement.
      {:else}
        Si quelque chose est faux, corrige-le directement ici.
      {/if}
    </p>

    {#if editing && draft}
      <dl class="editing">
        {#each TERM_FIELDS as field}
          <dt>{LABELS[field]}</dt>
          <dd>
            <TermInput
              bind:value={draft[field]}
              label={LABELS[field]}
              placeholder={PLACEHOLDERS[field]}
            />
          </dd>
        {/each}

        <dt>{LABELS.seniority}</dt>
        <dd class="inline">
          <select bind:value={draft.seniority} aria-label="Niveau">
            {#each SENIORITY as level}
              <option value={level}>{SENIORITY_LABELS[level] ?? level}</option>
            {/each}
          </select>
          <label class="years small muted">
            <input type="number" min="0" max="60" bind:value={draft.years_experience} />
            ans d'experience
          </label>
        </dd>

        <dt>{LABELS.remote}</dt>
        <dd>
          <select bind:value={draft.remote} aria-label="Teletravail">
            {#each REMOTE as mode}
              <option value={mode}>{REMOTE_LABELS[mode] ?? mode}</option>
            {/each}
          </select>
        </dd>
      </dl>

      <p class="small muted hint">
        Les termes sont ramenes en minuscules : c'est sous cette forme qu'ils rencontrent ceux
        extraits des offres. Une nouvelle analyse du CV ecrase ces corrections.
      </p>

      <div class="actions">
        <button type="button" class="btn btn-brand" onclick={saveData} disabled={savingData}>
          {savingData ? 'Recalcul des scores…' : 'Enregistrer les corrections'}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          onclick={cancelEditing}
          disabled={savingData}
        >
          Annuler
        </button>
        {#if dataDirty}
          <span class="small muted">
            {Object.keys(dataChanges).length} champ{Object.keys(dataChanges).length > 1 ? 's' : ''}
            modifie{Object.keys(dataChanges).length > 1 ? 's' : ''}
          </span>
        {/if}
      </div>

      {#if dataError}
        <p class="alert alert-error small">{dataError}</p>
      {/if}
    {:else}
      <dl>
        {#each understood as [key, values]}
          <dt>{LABELS[key]}</dt>
          <dd>
            {#each values as value}<span class="tag">{value}</span>{/each}
          </dd>
        {/each}
      </dl>

      {#if dataSaved}
        <p class="alert alert-ok small">Profil corrige, scores recalcules.</p>
      {/if}
    {/if}
  </section>
{/if}

<style>
  textarea {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    resize: vertical;
    font-family: inherit;
  }

  .field { margin-bottom: 1.1rem; }

  .dropzone {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px dashed var(--border);
    border-radius: 8px;
    background: var(--bg);
    transition: border-color 0.15s, background 0.15s;
  }
  .dropzone.dragging { border-color: var(--leaf); background: #eaf5f3; }

  .hint { margin: 0.35rem 0 0; }

  .alert { margin: 0.9rem 0 0; }
  .field .alert { margin: 0 0 0.6rem; }

  code { background: #f0ede4; padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.85em; }

  .understood {
    margin-top: 1.4rem;
    padding-top: 1.2rem;
    border-top: 1px solid var(--border);
  }
  .understood h3 { font-size: 0.95rem; margin-bottom: 0.3rem; }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  /* En edition les lignes portent des champs, pas du texte: aligner sur la
     premiere ligne plutot que sur la ligne de base des chips. */
  dl.editing { align-items: start; gap: 0.6rem 0.9rem; }
  dl.editing dt { padding-top: 0.45rem; }

  .inline { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  .inline select { width: auto; }

  .years { display: flex; align-items: center; gap: 0.35rem; margin: 0; font-weight: 500; }
  .years input { width: 4.2rem; }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  dl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem 0.9rem;
    margin: 1rem 0 0;
    align-items: baseline;
  }
  dt { color: var(--muted); font-weight: 600; font-size: 0.85rem; white-space: nowrap; }
  dd { margin: 0; display: flex; flex-wrap: wrap; gap: 0.28rem; }

  @media (max-width: 520px) {
    dl { grid-template-columns: minmax(0, 1fr); gap: 0.15rem; }
    dt { margin-top: 0.5rem; }
  }
</style>
