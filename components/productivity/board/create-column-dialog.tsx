"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";
import { createBoardColumnSchema, type CreateBoardColumnData } from "@/schemas/board";
import { toast } from "sonner";

type CreateColumnDialogProps = {
  onCreate: (data: CreateBoardColumnData) => Promise<void>;
  nextOrder: number;
};

export function CreateColumnDialog({ onCreate, nextOrder }: CreateColumnDialogProps): React.ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateBoardColumnData>({
    resolver: zodResolver(createBoardColumnSchema),
    defaultValues: { name: "", order: nextOrder },
  });

  const onSubmit = async (data: CreateBoardColumnData): Promise<void> => {
    try {
      await onCreate({ ...data, order: nextOrder });
      toast.success("Column created");
      setOpen(false);
      reset({ name: "", order: nextOrder + 1 });
    } catch {
      // parent already showed an error toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus />
          Add column
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new column</DialogTitle>
          <DialogDescription>Add a new column to your board.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="column-name">Title</FieldLabel>
            <Input
              id="column-name"
              placeholder="Column title"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isSubmitting ? "Creating…" : "Create column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
