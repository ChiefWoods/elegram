import { vi } from "vitest";

// Vitest runs on Node, but the server imports `RedisClient` from "bun".
// Provide a generic stub so any module that does `new RedisClient(url)` or
// `import { RedisClient } from "bun"` loads cleanly under Node. Tests that
// need to capture/inspect Redis traffic should:
//   - override `../src/lib/redis` to swap the shared client, OR
//   - override the `bun` mock at the top of the test file.
vi.mock("bun", () => {
  class FakeRedisClient {
    constructor(public url: string) {}
    async subscribe(_channel: string, _handler: (message: string) => void): Promise<void> {}
    async send(_command: string, _args: string[]): Promise<unknown> {
      return 0;
    }
  }
  return { RedisClient: FakeRedisClient };
});
