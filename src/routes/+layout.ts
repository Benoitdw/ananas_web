// L'app est un SPA: l'API vit sur une autre origine et la session est un
// cookie du navigateur, que le rendu serveur SvelteKit ne porte pas.
export const ssr = false;
export const prerender = false;
