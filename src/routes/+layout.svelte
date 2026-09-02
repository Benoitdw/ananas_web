<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import Nav from '$lib/components/Nav.svelte';
  import { refreshUser } from '$lib/stores/auth';

  let { children } = $props();

  onMount(refreshUser);
</script>

<Nav />

<main>
  {@render children()}
</main>

<style>
  main {
    min-height: calc(100vh - 57px);
  }
</style>
