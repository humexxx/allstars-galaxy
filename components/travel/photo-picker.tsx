"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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
        toast.error(uploadErr.message);
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
      <div className="flex flex-wrap items-center gap-2">
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
          size="sm"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
          Upload
        </Button>
        <Input
          placeholder="…or paste image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleUrlAdd();
            }
          }}
          disabled={disabled || busy}
          className="h-8 max-w-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || busy || !url.trim()}
          onClick={handleUrlAdd}
        >
          Add
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {previewUrl && (
        <div className="relative w-full overflow-hidden rounded-md border">
          <div
            className="aspect-[16/9] w-full"
            style={{
              backgroundImage: `url(${previewUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {onClear && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={cn("absolute right-2 top-2 h-7 w-7")}
              onClick={onClear}
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      <Tabs defaultValue="upload" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="url" className="text-xs">Paste URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-2">
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Choose image
              </>
            )}
          </Button>
          <Text variant="small">JPG, PNG, WebP up to 10 MB.</Text>
        </TabsContent>

        <TabsContent value="url" className="space-y-2">
          <Label htmlFor="photo-url" className="sr-only">Image URL</Label>
          <div className="flex gap-2">
            <Input
              id="photo-url"
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
