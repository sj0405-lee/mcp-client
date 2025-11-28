import { supabase } from "./supabase";

const BUCKET_NAME = "chat-images";

/**
 * base64 이미지를 Supabase Storage에 업로드하고 public URL 반환
 */
export async function uploadImage(
  base64Data: string,
  mimeType: string,
  sessionId: string
): Promise<string | null> {
  try {
    // base64를 Blob으로 변환
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // 파일 확장자 결정
    const ext = mimeType.split("/")[1] || "png";
    const fileName = `${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Storage에 업로드
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("Failed to upload image:", error);
      return null;
    }

    // Public URL 반환
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}

