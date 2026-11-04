"use client";

import { useRef, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { VoiceButton } from "./voice-button";

/**
 * The message box: Enter sends, Shift+Enter breaks the line, and dictation
 * writes after whatever was typed before it started.
 */
export function Composer({
  draft,
  onDraftChange,
  onSend,
  busy,
  canSend,
  placeholder,
  label,
  inputRef,
  before,
  above,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  busy: boolean;
  canSend: boolean;
  placeholder: string;
  /** The box's accessible name. */
  label: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** Ahead of the box on its row (Travel's attach button). */
  before?: ReactNode;
  /** Over the row (Travel's attachments). */
  above?: ReactNode;
}): React.ReactElement {
  /** What was typed before dictation started; the transcript goes after it. */
  const voiceBase = useRef("");

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    onSend();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t p-4">
      {above}
      <div className="flex items-end gap-1">
        {before}
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={label}
          rows={2}
          className="min-w-0 flex-1 resize-none"
        />
        <VoiceButton
          disabled={busy}
          onStart={() => {
            voiceBase.current = draft.trim() ? `${draft.trim()} ` : "";
          }}
          onTranscript={(words) => onDraftChange(voiceBase.current + words)}
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={!canSend}>
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
