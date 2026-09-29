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
import { createClient } from "@/lib/supabase";

/**
 * Bucket assumed to exist with these Supabase policies:
 *   - Public read (so /trips/[token] previews and OG crawlers can fetch images)
 *   - Insert restricted to authenticated users into a path under their own uid
 *
 * SQL to create the bucket + policies if missing:
 *   insert into storage.buckets (id, name, public) values ('trip-photos','trip-photos', true);
 *   create policy "trip-photos read"   on storage.objects for select using (bucket_id = 'trip-photos');
 *   create policy "trip-photos write"  on storage.objects for insert with check (bucket_id = 'trip-photos' and (storage.foldername(name))[1] = auth.uid()::text);
 *   create policy "trip-photos update" on storage.objects for update using (bucket_id = 'trip-photos' and owner = auth.uid());
 *   create policy "trip-photos delete" on storage.objects for delete using (bucket_id = 'trip-photos' and owner = auth.uid());
 */
const BUCKET = "trip-photos";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

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
   *   - "compact": just an inline strip (used in the gallery's "add" slot)
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
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        toast.error("Sign in expired, please refresh");
        return;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const key = `${userRes.user.id}/${folder}/${crypto.randomUUID()}.${ext.toLowerCase()}`;
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, file, { cacheControl: "31536000", upsert: false });
      if (uploadErr) {
        // Supabase says "Bucket not found", which reads like a broken app
        // rather than one-time setup nobody has done. Name the fix.
        const missingBucket = /bucket not found/i.test(uploadErr.message);
        toast.error(
          missingBucket
            ? `Storage isn't set up yet — create a public bucket named "${BUCKET}" in Supabase. Until then, add photos with the URL tab.`
            : uploadErr.message,
          missingBucket ? { duration: 10_000 } : undefined
        );
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
      await onPick({ url: data.publicUrl, storagePath: key, source: "upload" });
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
