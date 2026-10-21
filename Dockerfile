# Production web preview for the Flutter client.
FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /workspace
COPY pubspec.* ./
RUN flutter pub get
COPY . .
RUN flutter build web --release --dart-define=APP_ENV=production

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/build/web /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget --spider --quiet http://127.0.0.1/ || exit 1

