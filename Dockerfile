FROM node:22-alpine

WORKDIR /app

# Les dependances d'abord: couche mise en cache tant que le lock ne bouge pas
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
