FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

# Generate Prisma client for server
WORKDIR /app/apps/server
# Prisma generate only needs a syntactically valid URL at build time.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/elegram
RUN bun run db:generate

WORKDIR /app/apps/web
ARG VITE_SERVER_URL=
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
RUN bun run build

FROM nginx:1.30.1-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/apps/web/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
