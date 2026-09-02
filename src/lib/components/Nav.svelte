<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authReady, logout, user } from '$lib/stores/auth';

  const links = [
    { href: '/map', label: 'Carte' },
    { href: '/jobs', label: 'Offres', auth: true },
    { href: '/settings', label: 'Parametres', auth: true }
  ];

  async function onLogout() {
    await logout();
    goto('/');
  }
</script>

<nav>
  <a class="brand" href="/">🍍 <span>Ananas</span></a>

  <div class="links">
    {#each links as link}
      {#if !link.auth || $user}
        <a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
      {/if}
    {/each}
  </div>

  <div class="account">
    {#if !$authReady}
      <!-- rien tant que /me n'a pas repondu, pour eviter le clignotement -->
    {:else if $user}
      <span class="email small muted">{$user.email}</span>
      <button class="btn btn-ghost btn-sm" onclick={onLogout}>Deconnexion</button>
    {:else}
      <a class="btn btn-ghost btn-sm" href="/login">Connexion</a>
      <a class="btn btn-brand btn-sm" href="/register">Creer un compte</a>
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
  }

  .links {
    display: flex;
    gap: 1.1rem;
    margin-right: auto;
  }

  .links a {
    color: var(--muted);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.92rem;
    padding: 0.2rem 0;
    border-bottom: 2px solid transparent;
  }
  .links a:hover { color: var(--text); }
  .links a.active { color: var(--text); border-bottom-color: var(--brand); }

  .account {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  @media (max-width: 640px) {
    .email { display: none; }
    nav { gap: 1rem; }
  }
</style>
