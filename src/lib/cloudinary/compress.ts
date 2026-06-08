const MAX_DIMENSION = 2048;
const OUTPUT_QUALITY = 0.82;
const TARGET_BYTES = 4 * 1024 * 1024; // re-compress at lower quality if still >4 MB

export async function compressImage(file: File): Promise<File> {
  // Skip non-raster types (SVG, GIF, etc.)
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const encode = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            // If still large and quality can be reduced further, retry once
            if (blob.size > TARGET_BYTES && quality > 0.5) {
              encode(quality - 0.2);
              return;
            }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };

      encode(OUTPUT_QUALITY);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fall back to original on error
    };

    img.src = objectUrl;
  });
}
