# Server

## Setup

### Development

1. Set up env file

```sh
cp .env.example .env.development
```

2. Perform Prisma migration

```sh
bun run db:migrate:deploy
```

3. Generate Prisma client

```sh
bun run db:generate
```

4. Start dev Docker container

```sh
bun run docker:dev:up
```

5. Start dev server

```sh
bun run dev
```

### Testing

1. Set up env file

```sh
cp .env.example .env.test
```

2. Perform Prisma migration

```sh
NODE_ENV=test bun run db:migrate:deploy
```

3. Start test Docker container

```sh
bun run docker:test:up
```

4. Run all tests

```sh
bun run test
```
