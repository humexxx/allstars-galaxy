// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// East of UTC on purpose: there local midnight is the PREVIOUS UTC day, which
// is the case the cutoff got wrong. Node re-reads TZ when it is assigned.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Madrid";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

vi.mock("@/app/actions/portfolio-snapshots", () => ({
  createManualSnapshotAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The calendar popover is not under test; a text box drives the same onChange.
vi.mock("@/components/ui/date-field", () => ({
  DateField: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (day: string) => void;
  }) => <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { createManualSnapshotAction } from "@/app/actions/portfolio-snapshots";

import { ManualSnapshotDialog } from "./manual-snapshot-dialog";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.mocked(createManualSnapshotAction).mockResolvedValue({
    success: true,
    data: { totalValue: 0, snapshotsCreated: 1 },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function submittedDate(): Promise<Date> {
  fireEvent.click(screen.getByRole("button", { name: "Create snapshot" }));
  await waitFor(() => expect(createManualSnapshotAction).toHaveBeenCalledTimes(1));
  return vi.mocked(createManualSnapshotAction).mock.calls[0][0].date;
}

describe("ManualSnapshotDialog", () => {
  it("snapshots today at the current instant, so this morning's buy is in it", async () => {
    const now = new Date(2026, 9, 16, 11, 0);
    vi.setSystemTime(now);
    render(<ManualSnapshotDialog open onOpenChange={vi.fn()} />);

    const date = await submittedDate();

    // The services keep every transaction with `date <= snapshot`. 00:30 in
    // Madrid is 22:30 UTC the day before — later than local midnight.
    const boughtAt0030 = new Date(2026, 9, 16, 0, 30);
    const approvedAt1000 = new Date(2026, 9, 16, 10, 0);
    expect(boughtAt0030.getTime()).toBeLessThanOrEqual(date.getTime());
    expect(approvedAt1000.getTime()).toBeLessThanOrEqual(date.getTime());
    expect(date.getTime()).toBe(now.getTime());
  });

  it("snapshots a past day at the end of that calendar day", async () => {
    vi.setSystemTime(new Date(2026, 9, 16, 11, 0));
    render(<ManualSnapshotDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Snapshot date"), {
      target: { value: "2026-10-10" },
    });

    const date = await submittedDate();

    expect(date.getTime()).toBe(new Date(2026, 9, 10, 23, 59, 59, 999).getTime());
    expect(new Date(2026, 9, 10, 18, 0).getTime()).toBeLessThanOrEqual(date.getTime());
    // The next day's money is not part of that day's book.
    expect(new Date(2026, 9, 11, 0, 0).getTime()).toBeGreaterThan(date.getTime());
  });
});
