import { NextResponse } from "next/server";

import { checkReservationReminders, releaseExpiredReservations } from "@/app/inventory/_lib/reservation-reminders";
import { notifySlowMovingStock } from "@/app/inventory/_lib/slow-stock-digest";

export const dynamic = "force-dynamic";

// Sends expiry reminders, releases expired reservations and sends the slow-moving
// stock digest. Triggered daily by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET is
// set as an env var, so this doubles as the auth check for anyone else
// hitting the route.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Reminders first: a reservation ending today gets its "expires today" notice, and
  // only ones whose last day has already passed are released.
  const reminders = await checkReservationReminders();
  const { released } = await releaseExpiredReservations();
  const slowStock = await notifySlowMovingStock();
  return NextResponse.json({ ...reminders, released, slowStock });
}
