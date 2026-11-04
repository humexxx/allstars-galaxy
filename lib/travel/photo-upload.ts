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
export const TRIP_PHOTO_BUCKET = "trip-photos";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type UploadedPhoto = { url: string; storagePath: string };

/**
 * Uploads a picture to the trip-photos bucket from the browser, under
 * `<user id>/<folder>/`, and returns its public address.
 *
 * Throws with the sentence to show: the bucket's own "Bucket not found" reads
 * like a broken app rather than setup nobody has done.
 */
export async function uploadTripPhoto(file: File, folder: string): Promise<UploadedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("File too large (max 10 MB)");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported");

  const supabase = createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Sign in expired, please refresh");

  const ext = file.name.split(".").pop() || "jpg";
  const key = `${userRes.user.id}/${folder}/${crypto.randomUUID()}.${ext.toLowerCase()}`;
  const { error } = await supabase.storage
    .from(TRIP_PHOTO_BUCKET)
    .upload(key, file, { cacheControl: "31536000", upsert: false });
  if (error) {
    throw new Error(
      /bucket not found/i.test(error.message)
        ? `Storage isn't set up yet — create a public bucket named "${TRIP_PHOTO_BUCKET}" in Supabase. Until then, add photos with the URL tab.`
        : error.message
    );
  }
  const { data } = supabase.storage.from(TRIP_PHOTO_BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, storagePath: key };
}
