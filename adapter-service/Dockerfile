FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production

# Adapter benötigt npm-Abhängigkeiten (z. B. better-sqlite3)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Adapter-Code + geteilte Regionsdaten für Mandant-Mapping
COPY adapter-service ./adapter-service
COPY src/data ./src/data

WORKDIR /app/adapter-service
EXPOSE 8787
CMD ["node", "server.mjs"]
