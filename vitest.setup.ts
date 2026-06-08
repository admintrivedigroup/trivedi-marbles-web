// Prevent "server-only" guard from throwing in the test environment.
// Tests import pure functions from server libs; no server context is needed.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
