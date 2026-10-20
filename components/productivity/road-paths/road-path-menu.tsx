"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { deleteRoadPathAction } from "@/app/actions/road-path";
import { runAction } from "@/lib/actions/run";
import type { RoadPath } from "@/types";

import { RoadPathDialog } from "./road-path-dialog";

type RoadPathMenuProps = {
  roadPath: RoadPath;
  /** `header`: an Edit button beside the menu, for the detail page. */
  variant?: "card" | "header";
  /** Where to go once it is deleted; the list page needs nowhere. */
  afterDeleteHref?: string;
};

export function RoadPathMenu({ roadPath, variant = "card", afterDeleteHref }: RoadPathMenuProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    const { ok } = await runAction(deleteRoadPathAction(roadPath.id), {
      success: "Road path deleted",
      failure: "Failed to delete road path",
    });
    setDeleting(false);
    if (!ok) return;
    setConfirmingDelete(false);
    if (afterDeleteHref) router.push(afterDeleteHref);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {variant === "header" ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant === "header" ? "outline" : "ghost"}
              size={variant === "header" ? "icon" : "icon-sm"}
              aria-label={`Options for ${roadPath.title}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RoadPathDialog roadPath={roadPath} open={editing} onOpenChange={setEditing} />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Delete “{roadPath.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its milestones, progress entries and the record of the days it was done go with it.
              Its tasks stay on the board. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                // Stay open until the delete settles, so the pending state
                // and any failure show in the dialog that asked for it.
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting && <Spinner />}
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
