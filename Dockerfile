# Production multi-stage Docker build for Papyrus Web (Expo Router + Three.js 3D + Supabase Live)
FROM node:22-bookworm-slim AS build
WORKDIR /workspace

COPY package*.json ./
RUN npm ci

COPY . .

ARG APP_VARIANT="production"
ARG EXPO_PUBLIC_SUPABASE_URL=""
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY=""
ARG EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ARG EXPO_PUBLIC_SENTRY_DSN=""

ENV APP_VARIANT=$APP_VARIANT
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV EXPO_PUBLIC_SENTRY_DSN=$EXPO_PUBLIC_SENTRY_DSN

RUN npx --no-install expo export --platform web

FROM nginx:1.27-alpine AS runtime
LABEL org.opencontainers.image.title="Papyrus Web" \
      org.opencontainers.image.description="AI-Powered Gamified Study & Multiplayer Quiz Platform (Expo Router + Three.js 3D)" \
      org.opencontainers.image.source="https://github.com/Minhwritecode/Quiz-Game-MultyPlatform" \
      org.opencontainers.image.url="https://github.com/Minhwritecode/Quiz-Game-MultyPlatform" \
      org.opencontainers.image.vendor="Minhwritecode"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget --spider --quiet http://127.0.0.1/ || exit 1
