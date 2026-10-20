// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { useTimeZoneCookie } from "./use-time-zone-cookie";

function Probe() {
  useTimeZoneCookie();
  return null;
}

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function clearTz(): void {
  document.cookie = "tz=; path=/; max-age=0";
}

beforeEach(clearTz);
afterEach(() => {
  clearTz();
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("useTimeZoneCookie", () => {
  it("writes the zone on a first visit and re-renders the page in it", () => {
    render(<Probe />);

    expect(document.cookie).toContain(`tz=${encodeURIComponent(ZONE)}`);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("leaves a cookie that already names the zone alone", () => {
    document.cookie = `tz=${encodeURIComponent(ZONE)}; path=/`;

    render(<Probe />);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("re-renders when the reader is in another zone than the cookie says", () => {
    document.cookie = "tz=Pacific%2FKiritimati; path=/";

    render(<Probe />);

    expect(document.cookie).toContain(`tz=${encodeURIComponent(ZONE)}`);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not refresh when the cookie could not be written", () => {
    // Cookies blocked: writes vanish, reads come back empty.
    vi.spyOn(document, "cookie", "get").mockReturnValue("");
    vi.spyOn(document, "cookie", "set").mockImplementation(() => undefined);

    render(<Probe />);

    expect(refresh).not.toHaveBeenCalled();
  });
});
