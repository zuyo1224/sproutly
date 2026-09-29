import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";
import { resolveUploadImageType } from "@/lib/upload-image-type";

export async function uploadImage(
  file: File,
  bucket: string,
  pathPrefix: string
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  // 檔名與內容兩關一起過（見 lib/upload-image-type）：內容不是圖片的檔在這裡就擋掉，
  // 檔名跟內容說法不一致的以內容為準決定副檔名與型別。
  const resolved = resolveUploadImageType(file.name, buffer, file.type);
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  const { ext, contentType } = resolved;
  const path = `${pathPrefix}/${randomUUID()}.${ext}`;
  // 設定頁、新增／編輯商品三個呼叫端都把這裡丟出的 e.message 直接顯示給商家，
  // 所以往外丟的一律是中文。storage 回的 error.message 是英文；建連線或送出時直接丟錯
  // （金鑰沒設的「supabaseKey is required.」、斷線）也是英文，兩種都只留伺服器紀錄。
  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  } catch (e) {
    console.error("uploadImage failed:", e instanceof Error ? e.message : e);
    throw new Error("圖片上傳失敗，請稍後再試");
  }
}
