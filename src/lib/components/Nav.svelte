<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authReady, logout, user } from '$lib/stores/auth';

  const links = [
    { href: '/map', label: 'Carte' },
    { href: '/jobs', label: 'Offres', auth: true },
    { href: '/settings', label: 'Parametres', auth: true },
    // Cache pour les autres, mais c'est l'API qui protege: /api/admin/*
    // repond 403 a un compte ordinaire.
    { href: '/admin', label: 'Admin', admin: true }
  ] as { href: string; label: string; auth?: boolean; admin?: boolean }[];

  async function onLogout() {
    await logout();
    goto('/');
  }
</script>

<nav>
  <a class="brand" href="/">🍍 <span>Ananas</span></a>

  <div class="links">
    {#each links as link}
      {#if link.admin ? $user?.is_admin : !link.auth || $user}
        <a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
      {/if}
    {/each}
  </div>

  <div class="account">
    {#if !$authReady}
      <!-- rien tant que /me n'a pas repondu, pour eviter le clignotement -->
    {:else if $user}
      <span class="email small muted">{$user.email}</span>
      <button class="btn btn-ghost btn-sm logout" onclick={onLogout} aria-label="Se deconnecter">
        <span class="full">Deconnexion</span>
        <span class="short" aria-hidden="true">⏻</span>
      </button>
    {:else}
      <a class="btn btn-ghost btn-sm" href="/login">Connexion</a>
      <a class="btn btn-brand btn-sm signup" href="/register">
        <span class="full">Creer un compte</span>
        <span class="short" aria-hidden="true">S'inscrire</span>
      </a>
    {/if}
  </div>
</nav>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    height: 56px;
    padding: 0 1.25rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .brand {
    font-weight: 800;
    font-size: 1.05rem;
    text-decoration: none;
    color: var(--text);
    letter-spacing: -0.02em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .links {
    display: flex;
    gap: 1.1rem;
    margin-right: auto;
    min-width: 0;
  }

  .links a {
    color: var(--muted);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.92rem;
    padding: 0.2rem 0;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .links a:hover { color: var(--text); }
  .links a.active { color: var(--text); border-bottom-color: var(--brand); }

  .account {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-shrink: 0;
  }

  /* Deux libelles par bouton: le long sur grand ecran, le court sur mobile.
     Evite un menu burger pour trois liens. */
  .short { display: none; }

  @media (max-width: 720px) {
    nav { gap: 0.9rem; padding: 0 0.85rem; }

    .brand { font-size: 0.98rem; }
    /* Sous 380px le mot "Ananas" ne rentre plus a cote des liens:
       l'ananas seul reste un repere suffisant vers l'accueil. */
    .links { gap: 0.85rem; }
    .links a { font-size: 0.86rem; }

    .email { display: none; }
    .account { gap: 0.4rem; }

    .full { display: none; }
    .short { display: inline; }

    .logout { padding: 0.35rem 0.55rem; font-size: 1rem; line-height: 1; }
  }

  @media (max-width: 380px) {
    .brand span { display: none; }
  }
</style>
