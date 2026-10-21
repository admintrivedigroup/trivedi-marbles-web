import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Feed for the weekly Make.com scenario that mirrors slab photos into Google
// Drive, one folder per lot. Make sends `Authorization: Bearer ${MAKE_SYNC_SECRET}`.
//
//   GET /api/integrations/lot-images            -> images added in the last 8 days
//   GET /api/integrations/lot-images?days=30    -> custom window
//   GET /api/integrations/lot-images?full=1     -> every image (first backfill)
//
// The window overlaps the weekly schedule by a day on purpose; the scenario
// skips files that already exist in the folder, so overlap never duplicates.

const PAGE_SIZE = 1000;

type ImageRow = {
  id: string;
  image_url: string;
  sort_order: number | null;
  created_at: string;
  slabs: {
    slab_code: string | null;
    marble_lots: {
      id: string;
      lot_number: string | null;
      marble_name: string | null;
    };
  };
};

type LotFolder = {
  lotId: string;
  folderName: string;
  images: { id: string; fileName: string; url: string; createdAt: string }[];
};

// Drive accepts most characters, but slashes make folder names confusing and
// quotes would break the scenario's `name = '...'` Drive search query.
function cleanName(value: string): string {
  return value.replace(/[\\/:*?"'<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function extensionOf(url: string): string {
  const match = /\.([a-z0-9]{3,4})(?:\?|$)/i.exec(url);
  return match ? match[1].toLowerCase() : "jpg";
}

export async function GET(request: Request) {
  const secret = process.env.MAKE_SYNC_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const full = params.get("full") === "1";
  const days = Math.min(Math.max(Number(params.get("days")) || 8, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createAdminClient();
  const rows: ImageRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("slab_images")
      .select(
        `id, image_url, sort_order, created_at,
         slabs!inner(slab_code, deleted_at,
           marble_lots!inner(id, lot_number, marble_name, deleted_at))`,
      )
      .is("slabs.deleted_at", null)
      .is("slabs.marble_lots.deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (!full) query = query.gte("created_at", since);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows.push(...((data ?? []) as unknown as ImageRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const lots = new Map<string, LotFolder>();
  for (const row of rows) {
    if (!row.image_url) continue;
    const lot = row.slabs.marble_lots;
    let folder = lots.get(lot.id);
    if (!folder) {
      const label = [lot.lot_number, lot.marble_name].filter(Boolean).join(" - ");
      folder = { lotId: lot.id, folderName: cleanName(label || lot.id), images: [] };
      lots.set(lot.id, folder);
    }
    const slabCode = cleanName(row.slabs.slab_code ?? "slab");
    folder.images.push({
      id: row.id,
      // Slab code + photo position + short id keeps names unique and stable
      // across runs, which is what the scenario's "already exists" check keys on.
      fileName: `${slabCode}_${(row.sort_order ?? 0) + 1}_${row.id.slice(0, 8)}.${extensionOf(row.image_url)}`,
      url: row.image_url,
      createdAt: row.created_at,
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    since: full ? null : since,
    imageCount: rows.length,
    lots: [...lots.values()],
  });
}
