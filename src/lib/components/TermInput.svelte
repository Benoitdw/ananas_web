<script lang="ts">
  /**
   * Saisie d'une liste de termes du profil (competences, secteurs, langues…).
   *
   * Distinct de ``TagInput``, qui sert au repertoire d'entreprises: les deux
   * ressemblent a des chips, mais leurs vocabulaires n'ont rien a voir. Un tag
   * d'entreprise est capitalise et partage entre utilisateurs; un terme de
   * profil est en minuscules parce qu'il doit rencontrer son equivalent
   * extrait des offres — c'est cette forme exacte que compare
   * ``ananas.ai.matching``. Fusionner les deux composants ferait de la
   * normalisation un parametre, et de la premiere faute de reglage un profil
   * qui ne matche plus rien.
   */
  type Props = {
    value: string[];
    label: string;
    placeholder?: string;
    max?: number;
  };
  let { value = $bindable([]), label, placeholder = 'Ajouter…', max = 80 }: Props = $props();

  let draft = $state('');

  /** Miroir de ananas.ai.extraction.normalize_terms. Le serveur reste
   *  l'autorite, mais la forme retenue doit etre visible tout de suite: c'est
   *  elle qui sera comparee aux offres. */
  const normalize = (raw: string) => raw.trim().toLowerCase().slice(0, 80);

  function add(raw: string) {
    const term = normalize(raw);
    if (!term || value.includes(term) || value.length >= max) return;
    value = [...value, term];
    draft = '';
  }

  function remove(term: string) {
    value = value.filter((t) => t !== term);
  }

  function onKeydown(event: KeyboardEvent) {
    // Virgule et Entree valident; Retour arriere sur un champ vide retire le
    // dernier terme, comme dans un champ de destinataires.
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }
</script>

<div class="terms">
  {#each value as term (term)}
    <span class="chip">
      {term}
      <button type="button" onclick={() => remove(term)} aria-label="Retirer {term} de {label}">
        ×
      </button>
    </span>
  {/each}

  <input
    type="text"
    bind:value={draft}
    onkeydown={onKeydown}
    onblur={() => add(draft)}
    {placeholder}
    aria-label="Ajouter a {label}"
    disabled={value.length >= max}
  />
</div>

<style>
  .terms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    padding: 0.28rem 0.35rem;
  }
  .terms:focus-within { outline: 2px solid var(--leaf); outline-offset: 1px; }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #e6f2f0;
    color: var(--leaf-dark);
    font-size: 0.8rem;
    font-weight: 600;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .chip button {
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
  }
  .chip button:hover { opacity: 1; }

  input {
    flex: 1 1 7rem;
    min-width: 7rem;
    width: auto;
    border: none;
    outline: none;
    padding: 0.2rem 0.25rem;
    background: none;
    font-size: 0.84rem;
  }
</style>
