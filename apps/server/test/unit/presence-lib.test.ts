import { beforeEach, describe, expect, test } from "bun:test";

import {
  __resetForTests,
  isOnline,
  onPresence,
  onlineUserIds,
  track,
  untrack,
} from "../../src/lib/presence";

beforeEach(() => {
  __resetForTests();
});

describe("presence registry", () => {
  test("tracks and untracks online state with reference counts", () => {
    expect(isOnline("u1")).toBe(false);

    expect(track("u1")).toBe(true);
    expect(isOnline("u1")).toBe(true);

    expect(track("u1")).toBe(false);
    expect(isOnline("u1")).toBe(true);

    expect(untrack("u1")).toBe(false);
    expect(isOnline("u1")).toBe(true);

    expect(untrack("u1")).toBe(true);
    expect(isOnline("u1")).toBe(false);
  });

  test("returns all online user IDs", () => {
    track("u1");
    track("u2");
    track("u2");

    expect(new Set(onlineUserIds())).toEqual(new Set(["u1", "u2"]));
  });

  test("emits only transition events", () => {
    const seen: Array<{ userId: string; online: boolean }> = [];
    const off = onPresence((e) => seen.push(e));

    track("u1");
    track("u1");
    untrack("u1");
    untrack("u1");
    untrack("u1");

    off();

    expect(seen).toEqual([
      { userId: "u1", online: true },
      { userId: "u1", online: false },
    ]);
  });
});
