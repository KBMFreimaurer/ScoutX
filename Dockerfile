# ── Build Stage ──
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_GOOGLE_MAPS_STRICT=true
ARG VITE_ADAPTER_TOKEN
ARG VITE_ADAPTER_TIMEOUT_MS=75000
ARG VITE_LOGTO_ENDPOINT
ARG VITE_LOGTO_APP_ID
ENV VITE_GOOGLE_MAPS_STRICT=${VITE_GOOGLE_MAPS_STRICT}
ENV VITE_ADAPTER_TOKEN=${VITE_ADAPTER_TOKEN}
ENV VITE_ADAPTER_TIMEOUT_MS=${VITE_ADAPTER_TIMEOUT_MS}
ENV VITE_LOGTO_ENDPOINT=${VITE_LOGTO_ENDPOINT}
ENV VITE_LOGTO_APP_ID=${VITE_LOGTO_APP_ID}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production Stage ──
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
