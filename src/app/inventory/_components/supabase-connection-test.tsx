"use client";

import { useEffect } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

let hasLoggedSupabaseConnectionTest = false;

export function SupabaseConnectionTest() {
  useEffect(() => {
    if (hasLoggedSupabaseConnectionTest) {
      return;
    }

    hasLoggedSupabaseConnectionTest = true;

    void (async () => {
      const supabase = getSupabaseClient();

      if (!supabase) {
        console.error(
          "[Supabase Test] Client was not created because browser env configuration is missing or invalid.",
        );
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[Supabase Test] getSession() failed.", error);
        return;
      }

      console.info("[Supabase Test] getSession() succeeded.", {
        hasSession: Boolean(data.session),
        session: data.session,
      });
    })();
  }, []);

  return null;
}
