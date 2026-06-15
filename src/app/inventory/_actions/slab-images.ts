"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/app/inventory/_lib/audit";

export type SlabImageInput = {
  imageUrl: string;
  publicId: string;
  slabId: string;
  sortOrder: number;
};

export type SaveSlabImagesResult = {
  error: string | null;
  savedCount: number;
};

const MAX_IMAGES_PER_SLAB = 8;

export async function saveSlabImages(
  images: SlabImageInput[],
): Promise<SaveSlabImagesResult> {
  if (images.length === 0) return { error: null, savedCount: 0 };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Enforce per-slab image cap before inserting.
    const uniqueSlabIds = [...new Set(images.map((img) => img.slabId))];
    for (const slabId of uniqueSlabIds) {
      const { count } = await supabase
        .from("slab_images")
        .select("id", { count: "exact", head: true })
        .eq("slab_id", slabId);
      const incoming = images.filter((img) => img.slabId === slabId).length;
      if ((count ?? 0) + incoming > MAX_IMAGES_PER_SLAB) {
        return {
          error: `Each slab can have at most ${MAX_IMAGES_PER_SLAB} photos. This slab already has ${count ?? 0}.`,
          savedCount: 0,
        };
      }
    }

    const { data, error } = await supabase
      .from("slab_images")
      .insert(
        images.map((img) => ({
          slab_id: img.slabId,
          image_url: img.imageUrl,
          public_id: img.publicId,
          sort_order: img.sortOrder,
        })),
      )
      .select("id");

    if (error) {
      return { error: `Failed to save photos. ${error.message}`, savedCount: 0 };
    }

    const uniqueSlabIds = [...new Set(images.map((img) => img.slabId))];
    for (const slabId of uniqueSlabIds) {
      const count = images.filter((img) => img.slabId === slabId).length;
      logAudit({
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        action: "slab.image_uploaded",
        targetType: "slab",
        targetId: slabId,
        targetLabel: slabId,
        diff: { imageCount: count },
      }).catch(() => {});
      revalidatePath(`/inventory/slab/${slabId}`);
    }

    return { error: null, savedCount: (data ?? []).length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Please try again.";
    return { error: `Failed to save photos. ${msg}`, savedCount: 0 };
  }
}

export type DeleteSlabImageResult = {
  error: string | null;
};

export async function deleteSlabImage(
  imageId: string,
  publicId: string,
  slabId: string,
): Promise<DeleteSlabImageResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: "Please sign in again before deleting." };
    }

    const { data: slabData } = await supabase
      .from("slabs")
      .select("slab_code")
      .eq("id", slabId)
      .single();

    const { error } = await supabase
      .from("slab_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      return { error: `Failed to delete image. ${error.message}` };
    }

    logAudit({
      userId: user.id,
      userEmail: user.email ?? null,
      action: "slab.image_deleted",
      targetType: "slab",
      targetId: slabId,
      targetLabel: slabData?.slab_code ?? slabId,
      diff: { publicId },
    }).catch(() => {});

    revalidatePath(`/inventory/slab/${slabId}`);
    revalidatePath(`/inventory/edit/${slabId}`);

    cleanupCloudinaryImages([publicId]).catch(() => {});

    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Please try again.";
    return { error: `Failed to delete image. ${msg}` };
  }
}

export async function cleanupCloudinaryImages(
  publicIds: string[],
): Promise<void> {
  if (publicIds.length === 0) return;

  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const cloudName =
    process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();

  if (!apiKey || !apiSecret || !cloudName) {
    console.error(
      "[Cloudinary] Cleanup skipped — CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET not configured. Orphaned public_ids:",
      publicIds,
    );
    return;
  }

  const { createHash } = await import("crypto");

  for (const publicId of publicIds) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHash("sha1")
        .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
        .digest("hex");

      await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            public_id: publicId,
            signature,
            timestamp,
          }),
        },
      );
    } catch (err) {
      console.error(`[Cloudinary] Failed to delete "${publicId}":`, err);
    }
  }
}
