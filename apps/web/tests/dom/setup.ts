import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

if (!("scrollTo" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: vi.fn(),
    writable: true,
  });
}

if (!("scrollIntoView" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    writable: true,
  });
}
