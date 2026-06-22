"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // Hide the centered spinner immediately
    const overlay = document.getElementById("__nav-overlay");
    if (overlay) overlay.style.display = "none";

    // Complete and fade out the top bar
    const bar = document.getElementById("__nav-bar");
    if (!bar) return;
    bar.style.transition = "width 0.1s ease, opacity 0.25s ease 0.1s";
    bar.style.width = "100%";
    const t = setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      }, 250);
    }, 100);
    return () => clearTimeout(t);
  }, [pathname, searchParams]);

  return null;
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavWatcher />
    </Suspense>
  );
}
