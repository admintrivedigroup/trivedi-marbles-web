import { NextRequest, NextResponse } from "next/server";
import fs   from "fs";
import path from "path";

const SURFACES_DIR = path.join(process.cwd(), "test-images", "surfaces");

const MIME: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const file = request.nextUrl.searchParams.get("file");
  if (!file) return new NextResponse("Missing file param", { status: 400 });

  // Prevent path traversal — resolved path must stay inside SURFACES_DIR
  const resolved = path.resolve(SURFACES_DIR, file);
  if (!resolved.startsWith(SURFACES_DIR + path.sep) && resolved !== SURFACES_DIR) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let blob: Blob;
  try {
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    blob = new Blob([fs.readFileSync(resolved)], { type: contentType });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(blob, {
    headers: {
      "Content-Type":  blob.type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
