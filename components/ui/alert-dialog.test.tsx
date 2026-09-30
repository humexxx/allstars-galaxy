// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

function renderDialog(action: React.ReactNode) {
  return render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete plan?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {action}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("AlertDialogAction", () => {
  it("renders the destructive variant without the primary fill", () => {
    renderDialog(<AlertDialogAction variant="destructive">Delete</AlertDialogAction>);

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("text-destructive");
    expect(button.className).not.toContain("bg-primary");
  });

  it("merges a caller className over the variant instead of appending beside it", () => {
    // Slot concatenates without tailwind-merge; the className used to land on
    // the Slot child, so `bg-destructive` sat next to `bg-primary` and lost on
    // CSS order — every "red" confirm rendered blue.
    renderDialog(<AlertDialogAction className="bg-destructive">Delete</AlertDialogAction>);

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("bg-destructive");
    expect(button.className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
  });
});
