import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg"];

export async function uploadImage(
  file: File,
  bucket: string,
  pathPrefix: string
): Promise<string> {
  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("圖片格式只支援 jpg / png / webp / gif / svg");
  }
  const path = `${pathPrefix}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType =
    file.type ||
    (ext === "jpg"
      ? "image/jpeg"
      : ext === "svg"
        ? "image/svg+xml"
        : `image/${ext}`);
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error("上傳失敗：" + error.message);
  const {
    data: { publicUrl },
  } = admin.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}
