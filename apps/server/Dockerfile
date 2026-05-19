FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

WORKDIR /app/apps/server
# Prisma generate only needs a syntactically valid URL at build time.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/elegram
RUN bun run db:generate

FROM oven/bun:1.3.14 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app

WORKDIR /app/apps/server
EXPOSE 3000
CMD ["sh", "-c", "bun run db:migrate:deploy && bun run start"]
