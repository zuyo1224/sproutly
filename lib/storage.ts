import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import {
  UNSUPPORTED_IMAGE_ERROR,
  uploadImageContentType,
  uploadImageExtension,
} from "@/lib/upload-image-type";

export async function uploadImage(
  file: File,
  bucket: string,
  pathPrefix: string
): Promise<string> {
  const admin = createAdminClient();
  const ext = uploadImageExtension(file.name);
  if (!ext) {
    throw new Error(UNSUPPORTED_IMAGE_ERROR);
  }
  const path = `${pathPrefix}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = uploadImageContentType(ext, file.type);
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
