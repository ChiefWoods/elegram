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

  class FakeS3File {
    constructor(private key: string) {}
    presign(_opts: { method: "PUT" | "GET"; expiresIn?: number; type?: string }) {
      return `https://example.test/${this.key}`;
    }
    async delete(): Promise<void> {}
    async exists(): Promise<boolean> {
      return true;
    }
    async stat(): Promise<Record<string, never>> {
      return {};
    }
  }

  class FakeS3Client {
    constructor(_opts: Record<string, unknown>) {}
    file(key: string) {
      return new FakeS3File(key);
    }
  }

  return { RedisClient: FakeRedisClient, S3Client: FakeS3Client };
});
