<script lang="ts">
  /**
   * Saisie de tags avec suggestions issues du vocabulaire existant.
   *
   * Les tags servent aux *autres* utilisateurs a filtrer: leur valeur depend
   * entierement de leur reutilisation. Un champ libre produirait "biotech",
   * "Biotech", "bio-tech" et trois entrees inutiles dans le filtre. D'ou les
   * suggestions mises en avant, et la normalisation (miroir de celle du
   * serveur, qui reste l'autorite).
   */
  type Props = {
    value: string[];
    suggestions: string[];
    max?: number;
  };
  let { value = $bindable([]), suggestions, max = 8 }: Props = $props();

  let draft = $state('');
  let focused = $state(false);

  const full = $derived(value.length >= max);

  /** Miroir de ananas.schemas.normalize_tag: le serveur reste l'autorite,
   *  mais l'utilisateur doit voir tout de suite la forme retenue. */
  function normalize(raw: string): string {
    const cleaned = raw.replace(/\s+/g, ' ').replace(/^[\s,;·-]+|[\s,;·-]+$/g, '');
    if (!cleaned) return '';
    return cleaned
      .split(' ')
      .map((w) => (w === w.toUpperCase() && w.length <= 5 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join(' ')
      .slice(0, 60);
  }

  /** Suggestions non encore choisies qui correspondent a la saisie. */
  const matches = $derived.by(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !value.includes(s))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  });

  /** `verbatim` pour une suggestion: elle porte deja l'orthographe de
   *  reference du repertoire, la normaliser en creerait une variante. */
  function add(raw: string, verbatim = false) {
    const tag = verbatim ? raw : normalize(raw);
    if (!tag || value.includes(tag) || full) return;
    value = [...value, tag];
    draft = '';
  }

  function remove(tag: string) {
    value = value.filter((t) => t !== tag);
  }

  function onKeydown(event: KeyboardEvent) {
    // Virgule et Entree valident; Retour arriere sur un champ vide retire le
    // dernier tag, comme dans les champs de destinataires d'un client mail.
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }
</script>

<div class="tag-input" class:focused>
  <div class="chips">
    {#each value as tag (tag)}
      <span class="chip">
        {tag}
        <button type="button" onclick={() => remove(tag)} aria-label="Retirer le tag {tag}">×</button>
      </span>
    {/each}

    <input
      type="text"
      bind:value={draft}
      onkeydown={onKeydown}
      onfocus={() => (focused = true)}
      onblur={() => setTimeout(() => (focused = false), 150)}
      placeholder={value.length ? '' : 'Biotech, CRO, Medical Devices…'}
      disabled={full}
      aria-label="Ajouter un tag"
    />
  </div>
</div>

{#if full}
  <p class="small muted hint">{max} tags au maximum.</p>
{:else if focused && matches.length}
  <div class="suggestions">
    <p class="small muted">
      {draft.trim() ? 'Tags existants' : 'Reutilise un tag existant, le filtre en sera plus utile'}
    </p>
    <div class="chips">
      {#each matches as suggestion}
        <button type="button" class="chip suggest" onclick={() => add(suggestion, true)}>
          + {suggestion}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tag-input {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    padding: 0.3rem 0.4rem;
  }
  .tag-input.focused { outline: 2px solid var(--leaf); outline-offset: 1px; }

  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: #e6f2f0;
    color: var(--leaf-dark);
    font-size: 0.82rem;
    font-weight: 600;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .chip button {
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.65;
  }
  .chip button:hover { opacity: 1; }

  .tag-input input {
    flex: 1 1 8rem;
    min-width: 8rem;
    width: auto;
    border: none;
    outline: none;
    padding: 0.3rem 0.25rem;
    background: none;
  }

  .suggestions { margin-top: 0.5rem; }
  .suggestions p { margin: 0 0 0.35rem; }

  .suggest {
    border: 1px dashed var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-weight: 500;
  }
  .suggest:hover { background: #e6f2f0; color: var(--leaf-dark); border-style: solid; }

  .hint { margin: 0.35rem 0 0; }
</style>
