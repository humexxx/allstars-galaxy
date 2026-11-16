// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateTimeField, toLocalDateTime } from "./date-time-field";

function open(name: RegExp | string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("toLocalDateTime", () => {
  it("writes the moment on the browser's clock, padded", () => {
    expect(toLocalDateTime(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
  });
});

describe("DateTimeField", () => {
  it("shows the day and the time on the trigger", () => {
    render(<DateTimeField value="2026-11-10T14:31" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "10 Nov 2026, 2:31 PM" })).toBeInTheDocument();
  });

  it("puts the clear button inside the control and clears to nothing", () => {
    const onChange = vi.fn();
    render(<DateTimeField value="2026-11-10T14:31" onChange={onChange} clearable clearLabel="Clear the close" />);

    const clear = screen.getByRole("button", { name: "Clear the close" });
    expect(clear.closest('[data-slot="input-group"]')).not.toBeNull();
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("has nothing to clear while empty", () => {
    render(<DateTimeField value="" onChange={vi.fn()} clearable placeholder="Still open" />);

    expect(screen.queryByRole("button", { name: "Clear the date and time" })).toBeNull();
    expect(screen.getByRole("button", { name: "Still open" })).toBeInTheDocument();
  });

  it("stays open on the first day picked, so its time can be set", () => {
    function Held(): React.ReactElement {
      const [value, setValue] = useState("");
      return <DateTimeField value={value} onChange={setValue} clearable min="2026-11-01" />;
    }
    render(<Held />);
    open("Pick a day and time");

    fireEvent.click(screen.getByRole("button", { name: /November 12th, 2026/ }));
    expect(screen.getByRole("textbox", { name: "Hour" })).toBeEnabled();
  });

  it("keeps the time when another day is picked", () => {
    const onChange = vi.fn();
    render(<DateTimeField value="2026-11-10T14:31" onChange={onChange} />);
    open(/10 Nov 2026/);

    fireEvent.click(screen.getByRole("button", { name: /November 12th, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-11-12T14:31");
  });

  it("gives a day picked first the time it is now", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 10, 8, 5), toFake: ["Date"] });
    const onChange = vi.fn();
    render(<DateTimeField value="" onChange={onChange} min="2026-11-01T00:00" />);
    open("Pick a day and time");

    fireEvent.click(screen.getByRole("button", { name: /November 12th, 2026/ }));
    expect(onChange).toHaveBeenCalledWith("2026-11-12T08:05");
    vi.useRealTimers();
  });

  it("has no time to set until a day is picked", () => {
    render(<DateTimeField value="" onChange={vi.fn()} />);
    open("Pick a day and time");

    expect(screen.getByRole("textbox", { name: "Hour" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Minute" })).toBeDisabled();
  });

  it("reads a typed hour on the half of the day already chosen", () => {
    const onChange = vi.fn();
    render(<DateTimeField value="2026-11-10T14:31" onChange={onChange} />);
    open(/10 Nov 2026/);

    fireEvent.change(screen.getByRole("textbox", { name: "Hour" }), { target: { value: "9" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-11-10T21:31");

    fireEvent.change(screen.getByRole("textbox", { name: "Hour" }), { target: { value: "12" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-11-10T12:31");
  });

  it("ignores what is not a time yet", () => {
    const onChange = vi.fn();
    render(<DateTimeField value="2026-11-10T14:31" onChange={onChange} />);
    open(/10 Nov 2026/);

    fireEvent.change(screen.getByRole("textbox", { name: "Hour" }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Minute" }), { target: { value: "75" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps the minute with the arrow keys, wrapping inside the hour", () => {
    const onChange = vi.fn();
    render(<DateTimeField value="2026-11-10T14:59" onChange={onChange} />);
    open(/10 Nov 2026/);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Minute" }), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("2026-11-10T14:00");
  });

  it("switches between morning and afternoon", () => {
    const onChange = vi.fn();
    render(<DateTimeField value="2026-11-10T14:31" onChange={onChange} />);
    open(/10 Nov 2026/);

    fireEvent.click(screen.getByRole("radio", { name: "AM" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-10T02:31");
  });

  it("refuses a day before the earliest one", () => {
    render(<DateTimeField value="" onChange={vi.fn()} min="2026-11-10T14:31" />);
    open("Pick a day and time");

    expect(screen.getByRole("button", { name: /November 9th, 2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /November 10th, 2026/ })).not.toBeDisabled();
  });
});
