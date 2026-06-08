interface ImportMetaEnv extends Record<string, string | undefined> {
  readonly VITE_CLOUDINARY_CLOUD_NAME: string | undefined;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET: string | undefined;
  readonly NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: string | undefined;
  readonly NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
