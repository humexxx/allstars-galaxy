"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { uploadTripPhoto } from "@/lib/travel/photo-upload";

export type PhotoPickResult = {
  url: string;
  storagePath: string | null;
  source: "upload" | "url";
};

type PhotoPickerProps = {
  /**
   * Folder segment after `userId/`. For trip cover at create time pass
   * "covers"; for items belonging to an existing trip pass the trip id.
   */
  folder: string;
  onPick: (result: PhotoPickResult) => void | Promise<void>;
  disabled?: boolean;
  /**
   * Render mode:
   *   - "compact": just an inline strip (used in the banner photos dialog's "add" slot)
   *   - "full":    tabbed UI with URL + upload (used in the cover-photo block
   *               of the trip form)
   */
  variant?: "compact" | "full";
  /** Optional initial URL to display alongside the picker (cover preview). */
  previewUrl?: string | null;
  onClear?: () => void;
};

export function PhotoPicker({
  folder,
  onPick,
  disabled = false,
  variant = "full",
  previewUrl,
  onClear,
}: PhotoPickerProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("Not a valid URL");
      return;
    }
    setBusy(true);
    try {
      await onPick({ url: trimmed, storagePath: null, source: "url" });
      setUrl("");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const uploaded = await uploadTripPhoto(file, folder);
      await onPick({ ...uploaded, source: "upload" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      // The missing-bucket sentence has a fix to read; give it time.
      toast.error(message, /bucket/i.test(message) ? { duration: 10_000 } : undefined);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (variant === "compact") {
    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {/* One control, not three stacked ones. Upload, paste and add are
            three ways to do the same thing, and a narrow side column wrapped
            them onto three lines as though they were three steps. */}
        <InputGroup>
          <InputGroupAddon>
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  disabled={disabled || busy}
                  onClick={() => fileRef.current?.click()}
                  aria-label="Upload an image"
                >
                  {busy ? <Spinner /> : <Upload />}
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Upload an image</TooltipContent>
            </Tooltip>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Image URL"
            placeholder="Paste an image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleUrlAdd();
              }
            }}
            disabled={disabled || busy}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              disabled={disabled || busy || !url.trim()}
              onClick={handleUrlAdd}
            >
              Add
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {previewUrl && (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
          <Image
            src={previewUrl}
            alt="Cover photo preview"
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
            // Covers may be external URLs — see trip-detail.tsx.
            unoptimized
          />
          {onClear && (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={onClear}
              aria-label="Remove cover photo"
            >
              <X />
            </Button>
          )}
        </div>
      )}

      <Tabs defaultValue="upload" className="flex flex-col gap-3">
        {/* The list's own height is set on \`group-data-horizontal/tabs\`, so a
            plain \`h-8\` loses to it; override it on the same selector. */}
        <TabsList className="group-data-horizontal/tabs:h-8">
          <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="url" className="text-xs">Paste URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              <>
                <Upload /> Choose image
              </>
            )}
          </Button>
          <Text variant="small">JPG, PNG, WebP up to 10 MB.</Text>
        </TabsContent>

        <TabsContent value="url" className="flex flex-col gap-2">
          <Label htmlFor="photo-url" className="sr-only">Image URL</Label>
          <div className="flex gap-2">
            <Input
              id="photo-url"
              // Beside a button: \`w-full\` would claim the whole row and push
              // the button out of the dialog.
              className="min-w-0 flex-1"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUrlAdd();
                }
              }}
              disabled={disabled || busy}
            />
            <Button
              type="button"
              disabled={disabled || busy || !url.trim()}
              onClick={handleUrlAdd}
            >
              Add
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
