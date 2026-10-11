import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { useApp } from "@/store/app-store";

beforeEach(() => {
  useApp.getState().reset();
});

afterEach(() => {
  cleanup();
});

// jsdom lacks these browser APIs used by UI primitives.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver ??= RO;
Element.prototype.scrollIntoView ??= function () {};
Element.prototype.hasPointerCapture ??= function () {
  return false;
};
Element.prototype.releasePointerCapture ??= function () {};
