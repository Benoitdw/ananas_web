FROM node:22-alpine AS base

WORKDIR /app

# Les dependances d'abord: couche mise en cache tant que le lock ne bouge pas
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile la sortie adapter-node, utilisee par le stage production ---
FROM base AS build

COPY . .
RUN npm run build

# --- production: image legere, sans devDependencies ni source ---
# Cible par defaut du CI (voir .github/workflows/docker-publish.yml, --target production).
# PUBLIC_API_URL est lu au runtime ($env/dynamic/public): pas besoin de le
# fournir au build, seulement au `docker run`/compose.
FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["node", "build"]

# --- dev: stage par defaut (dernier du fichier), celui que docker-compose.yml
# construit sans --target. Code monte en bind mount, --reload cote vite. ---
FROM base AS dev

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
