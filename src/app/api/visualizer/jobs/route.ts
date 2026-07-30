import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderVisualizerJob } from "@/lib/visualizer-service/client";
import type { VisualizerInferenceMode, VisualizerTextureMode } from "@/lib/visualizer-service/types";

const UPLOADS_BUCKET = "visualizer-uploads";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const roomPhoto = formData.get("roomPhoto");
  const slabImage = formData.get("slabImage");
  const tapX = Number(formData.get("tapX"));
  const tapY = Number(formData.get("tapY"));
  const marbleName = String(formData.get("marbleName") ?? "");
  const mode = (String(formData.get("mode") ?? "continuous")) as VisualizerTextureMode;
  const inferenceModeOverride = formData.get("inferenceModeOverride") as VisualizerInferenceMode | null;

  if (!(roomPhoto instanceof File) || !(slabImage instanceof File)) {
    return NextResponse.json({ error: "roomPhoto and slabImage are required." }, { status: 400 });
  }
  if (!Number.isFinite(tapX) || !Number.isFinite(tapY)) {
    return NextResponse.json({ error: "tapX and tapY are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from("visualizer_jobs")
    .insert({
      user_id: user.id,
      room_photo_path: "",
      product_ref: { marbleName },
      mode: inferenceModeOverride ?? "local",
      status: "processing",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Failed to create job." }, { status: 500 });
  }

  const roomPhotoPath = `${user.id}/${job.id}/room.jpg`;
  const { error: uploadError } = await admin.storage
    .from(UPLOADS_BUCKET)
    .upload(roomPhotoPath, roomPhoto, { contentType: roomPhoto.type || "image/jpeg" });

  if (uploadError) {
    await admin
      .from("visualizer_jobs")
      .update({ status: "failed", error: uploadError.message })
      .eq("id", job.id);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await admin.from("visualizer_jobs").update({ room_photo_path: roomPhotoPath }).eq("id", job.id);

  const result = await renderVisualizerJob({
    roomPhoto,
    slabImage,
    tapX,
    tapY,
    mode,
    inferenceModeOverride: inferenceModeOverride ?? undefined,
  });

  if (!result.ok) {
    await admin
      .from("visualizer_jobs")
      .update({ status: "failed", error: result.error })
      .eq("id", job.id);
    return NextResponse.json(
      { error: result.error, needsManualFloor: result.needsManualFloor },
      { status: result.needsManualFloor ? 422 : 502 },
    );
  }

  const resultPath = `${user.id}/${job.id}/result.jpg`;
  const resultBuffer = Buffer.from(result.dataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const { error: resultUploadError } = await admin.storage
    .from(UPLOADS_BUCKET)
    .upload(resultPath, resultBuffer, { contentType: "image/jpeg" });

  if (resultUploadError) {
    await admin
      .from("visualizer_jobs")
      .update({ status: "failed", error: resultUploadError.message })
      .eq("id", job.id);
    return NextResponse.json({ error: resultUploadError.message }, { status: 500 });
  }

  await admin.from("visualizer_results").insert({
    job_id: job.id,
    result_path: resultPath,
    metadata: result.debug,
  });
  await admin.from("visualizer_jobs").update({ status: "succeeded" }).eq("id", job.id);

  const { data: signed } = await admin.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(resultPath, 60 * 60);

  return NextResponse.json({
    jobId: job.id,
    resultUrl: signed?.signedUrl ?? result.dataUrl,
    debug: result.debug,
  });
}
