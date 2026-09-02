<script lang="ts">
  /**
   * CV et aspirations professionnelles.
   *
   * L'enregistrement declenche l'extraction (~5 s) puis le rescoring de toutes
   * les offres. On affiche ensuite ce qui a ete *compris* du CV: c'est la
   * seule facon pour l'utilisateur de constater qu'un metier vise ou une
   * competence a ete mal lue, et de corriger son texte.
   */
  import { api, ApiError } from '$lib/api';
  import type { Profile } from '$lib/types';

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
    <textarea
      id="cv"
      bind:value={cv}
      rows="9"
      maxlength="40000"
      placeholder="Colle ici le texte de ton CV : experiences, competences, langues, localisation…"
    ></textarea>
    <p class="small muted hint">
      Du texte brut suffit. Plus il est detaille, plus les scores sont justes.
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
    <h3>Ce qui a ete compris de ton profil</h3>
    <p class="small muted">
      C'est ce qui sert au calcul des scores. Si quelque chose est faux, precise-le dans les
      champs ci-dessus.
    </p>

    <dl>
      {#each understood as [key, values]}
        <dt>{LABELS[key]}</dt>
        <dd>
          {#each values as value}<span class="tag">{value}</span>{/each}
        </dd>
      {/each}
    </dl>
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

  .hint { margin: 0.35rem 0 0; }

  .alert { margin: 0.9rem 0 0; }

  code { background: #f0ede4; padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.85em; }

  .understood {
    margin-top: 1.4rem;
    padding-top: 1.2rem;
    border-top: 1px solid var(--border);
  }
  .understood h3 { font-size: 0.95rem; margin-bottom: 0.3rem; }

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
