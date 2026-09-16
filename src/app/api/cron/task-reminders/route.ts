import { NextResponse } from "next/server";

import { checkTaskDueReminders } from "@/app/inventory/_lib/task-reminders";

export const dynamic = "force-dynamic";

// Triggered daily by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET is
// set as an env var, so this doubles as the auth check for anyone else
// hitting the route.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await checkTaskDueReminders();
  return NextResponse.json(result);
}
