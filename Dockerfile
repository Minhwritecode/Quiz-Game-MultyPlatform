# Production web preview for the React Native web client.
FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider --quiet http://127.0.0.1/ || exit 1
