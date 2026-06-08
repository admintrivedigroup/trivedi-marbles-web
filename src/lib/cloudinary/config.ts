// NEXT_PUBLIC_* vars must be accessed with static string literals — Next.js inlines
// them at build time and dynamic bracket access (process.env[variable]) is never replaced.
export function getCloudinaryConfig() {
  const cloudName = (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.VITE_CLOUDINARY_CLOUD_NAME
  )?.trim();

  const uploadPreset = (
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    process.env.VITE_CLOUDINARY_UPLOAD_PRESET
  )?.trim();

  if (!cloudName) {
    console.error(
      "Missing Cloudinary cloud name. Add VITE_CLOUDINARY_CLOUD_NAME to .env.local and restart the dev server.",
    );
    throw new Error(
      "Missing Cloudinary cloud name. Set VITE_CLOUDINARY_CLOUD_NAME in your environment.",
    );
  }

  if (!uploadPreset) {
    console.error(
      "Missing Cloudinary upload preset. Add VITE_CLOUDINARY_UPLOAD_PRESET to .env.local and restart the dev server.",
    );
    throw new Error(
      "Missing Cloudinary upload preset. Set VITE_CLOUDINARY_UPLOAD_PRESET in your environment.",
    );
  }

  return { cloudName, uploadPreset };
}
