<script lang="ts">
  import { user } from '$lib/stores/auth';

  const steps = [
    {
      icon: '🗺️',
      title: 'Explore la carte',
      text: 'Les entreprises du secteur, geolocalisees. Filtre par type, par secteur, par ville.'
    },
    {
      icon: '📌',
      title: 'Enregistre celles qui t’interessent',
      text: 'Un clic sur un marqueur, un clic sur "Enregistrer". C’est ta liste de veille.'
    },
    {
      icon: '🔔',
      title: 'Recois les nouvelles offres',
      text: 'Chaque matin, un message Telegram — uniquement les offres parues depuis la veille. Rien de neuf, aucun message.'
    }
  ];
</script>

<svelte:head><title>Ananas — la veille emploi qui vient a toi</title></svelte:head>

<section class="hero">
  <div class="container hero-inner">
    <span class="pill">🍍 Veille emploi geolocalisee</span>

    <h1>Les entreprises qui t'interessent,<br />sur une carte. Leurs offres, dans ta poche.</h1>

    <p class="lead">
      Arrete de rouvrir quinze pages carrieres chaque semaine. Choisis tes entreprises sur la
      carte, Ananas surveille leurs offres et te previent quand quelque chose bouge.
    </p>

    <div class="cta">
      {#if $user}
        <a class="btn btn-brand" href="/map">Ouvrir la carte</a>
        <a class="btn btn-ghost" href="/settings">Regler mes notifications</a>
      {:else}
        <a class="btn btn-brand" href="/register">Creer un compte</a>
        <a class="btn btn-ghost" href="/map">Voir la carte d'abord</a>
      {/if}
    </div>

    <p class="small muted note">
      81 entreprises du secteur life sciences en Belgique deja referencees.
    </p>
  </div>
</section>

<section class="container steps">
  {#each steps as step}
    <article class="card step">
      <div class="icon" aria-hidden="true">{step.icon}</div>
      <h3>{step.title}</h3>
      <p class="muted">{step.text}</p>
    </article>
  {/each}
</section>

<footer class="container">
  <p class="small muted">
    Ananas — POC. Notifications par bot Telegram; d'autres canaux viendront.
  </p>
</footer>

<style>
  .hero {
    background:
      radial-gradient(1100px 380px at 15% -10%, rgba(242, 183, 5, 0.16), transparent 60%),
      radial-gradient(900px 340px at 88% 0%, rgba(42, 157, 143, 0.14), transparent 62%);
    padding: 4.5rem 0 3.5rem;
    border-bottom: 1px solid var(--border);
  }

  .hero-inner { max-width: 780px; }

  .pill {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 1.25rem;
  }

  h1 {
    font-size: clamp(2rem, 5.2vw, 3.15rem);
    font-weight: 800;
    margin-bottom: 1rem;
  }

  .lead {
    font-size: 1.1rem;
    color: var(--muted);
    max-width: 62ch;
    margin: 0 0 1.9rem;
  }

  .cta { display: flex; flex-wrap: wrap; gap: 0.7rem; }

  .note { margin-top: 1.2rem; }

  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }

  .step { padding: 1.4rem; }
  .step h3 { font-size: 1rem; }
  .step p { margin: 0; font-size: 0.92rem; }

  .icon { font-size: 1.6rem; margin-bottom: 0.6rem; }

  footer { padding-bottom: 2.5rem; }
</style>
