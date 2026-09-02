import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true,
    port: 5173,
    // Necessaire pour que le hot reload traverse le bind mount docker
    watch: { usePolling: true }
  }
});
