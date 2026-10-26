import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";

/** What an empty chat offers; picking one fills the message box. */
export function Suggestions({
  items,
  onPick,
}: {
  items: readonly string[];
  onPick: (text: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <Text variant="muted">Try something like:</Text>
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** The user's message, with anything they attached above it. */
export function UserBubble({ text, children }: { text: string; children?: ReactNode }): React.ReactElement {
  return (
    <div className="ml-8 flex flex-col items-end gap-1 self-end">
      {children}
      <p className="whitespace-pre-wrap rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">{text}</p>
    </div>
  );
}

export function AssistantBubble({ text }: { text: string }): React.ReactElement {
  return <p className="mr-8 whitespace-pre-wrap text-sm">{text}</p>;
}

export function AssistantError({ message }: { message: string }): React.ReactElement {
  return (
    <Text variant="small" className="text-destructive">
      {message}
    </Text>
  );
}

/** While an answer is on its way: what the assistant is doing, or "Thinking". */
export function AssistantStatus({ label }: { label: string | null }): React.ReactElement {
  return (
    <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner />
      {label ?? "Thinking"}
    </div>
  );
}
