<script lang="ts">
  /**
   * Score de correspondance entre une offre et le profil.
   *
   * Le score vient d'un calcul deterministe cote serveur (competences en
   * commun, seniorite, secteur…), pas d'un jugement de modele: il est donc
   * explicable, et les raisons sont affichees au survol.
   */
  type Props = { score: number | null; reasons?: string[]; compact?: boolean };
  let { score, reasons = [], compact = false }: Props = $props();

  const level = $derived(score === null ? 'none' : score >= 75 ? 'high' : score >= 55 ? 'mid' : 'low');
</script>

{#if score !== null}
  <span class="badge {level}" class:compact title={reasons.join('\n')}>
    {score}<span class="pct">%</span>
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: baseline;
    padding: 0.1rem 0.42rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1.5;
    flex-shrink: 0;
    cursor: default;
  }

  .pct { font-size: 0.62rem; font-weight: 600; opacity: 0.75; }

  .high { background: #dff3ec; color: #1d6b5e; }
  .mid { background: #fdf3d8; color: #7a5c05; }
  .low { background: #efece4; color: var(--muted); }

  .compact { padding: 0.05rem 0.35rem; font-size: 0.7rem; }
</style>
