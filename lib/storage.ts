import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { resolveUploadImageType } from "@/lib/upload-image-type";

export async function uploadImage(
  file: File,
  bucket: string,
  pathPrefix: string
): Promise<string> {
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  // 檔名與內容兩關一起過（見 lib/upload-image-type）：內容不是圖片的檔在這裡就擋掉，
  // 檔名跟內容說法不一致的以內容為準決定副檔名與型別。
  const resolved = resolveUploadImageType(file.name, buffer, file.type);
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  const { ext, contentType } = resolved;
  const path = `${pathPrefix}/${randomUUID()}.${ext}`;
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
