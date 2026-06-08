import { getCloudinaryConfig } from "./config";

export type CloudinaryUploadResult = {
  publicId: string;
  secureUrl: string;
};

export async function uploadToCloudinary(
  file: File,
): Promise<CloudinaryUploadResult> {
  const { cloudName, uploadPreset } = getCloudinaryConfig();

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  body.append("folder", "marble-inventory");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body },
  );

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = (json.error as { message?: string } | undefined)?.message;
    throw new Error(msg ?? `Upload failed (HTTP ${res.status})`);
  }

  const json = (await res.json()) as { secure_url: string; public_id: string };
  return { secureUrl: json.secure_url, publicId: json.public_id };
}

export function withCloudinaryTransforms(url: string): string {
  return url.replace(/\/image\/upload\//, "/image/upload/f_webp,q_auto/");
}
