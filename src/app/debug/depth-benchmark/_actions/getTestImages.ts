"use server";

import fs   from "fs";
import path from "path";
import type { TestImage } from "../_lib/types";

function walk(dir: string, rel: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const entry of entries) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...walk(path.join(dir, entry.name), relPath));
    } else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) {
      results.push(relPath);
    }
  }
  return results;
}

function toDisplayName(relPath: string): string {
  const parts    = relPath.split(/[/\\]/);
  const filename = parts[parts.length - 1].replace(/\.[^.]+$/, "");
  const clean    = (s: string) =>
    s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (parts.length === 1) return clean(filename);
  return `${clean(filename)} · ${parts.slice(0, -1).map(clean).join(" / ")}`;
}

export async function getTestImages(): Promise<TestImage[]> {
  const dir = path.join(process.cwd(), "test-images", "surfaces");
  return walk(dir, "").map((p) => ({ path: p, displayName: toDisplayName(p) }));
}
