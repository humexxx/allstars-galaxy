import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `server-only` is a Next.js marker package that throws at build time when
// imported from the client bundle. In Vitest we are deliberately running
// server modules in a Node environment, so we stub it out globally.
vi.mock("server-only", () => ({}));
