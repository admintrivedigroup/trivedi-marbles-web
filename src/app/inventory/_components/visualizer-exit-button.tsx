"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";

export function ExitButton({ href }: { href: string }) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!exiting) return;

    const DURATION = 1800;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setProgress(Math.round(eased * 100));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => router.push(href), 300);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [exiting, href, router]);

  return (
    <>
      <button
        onClick={() => setExiting(true)}
        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-stone-100"
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </button>

      {exiting && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at 28% 38%, rgba(200,180,140,0.07) 0%, transparent 55%)," +
              "radial-gradient(ellipse at 72% 62%, rgba(255,255,255,0.025) 0%, transparent 50%)," +
              "#0c0b0a",
          }}
        >
          <div className="mb-10 flex flex-col items-center gap-5">
            <div className="relative h-16 w-16 rounded-full bg-white/5 p-2 ring-1 ring-white/10">
              <Image
                src="/images/vijay-trivedi-logo.webp"
                alt="Trivedi Granit Marmo"
                fill
                className="object-contain p-2"
              />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-stone-500">
                Trivedi Technologies
              </p>
              <h1 className="mt-2.5 text-[2rem] font-extralight tracking-[0.06em] text-white">
                Marble Visualizer
              </h1>
            </div>
          </div>

          <div className="w-60">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide text-stone-600">
                Closing visualizer
              </span>
              <span className="text-[11px] tabular-nums text-stone-600">
                {progress}%
              </span>
            </div>
            <div className="h-[1.5px] w-full overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(90deg, #78716c 0%, #d6d3d1 60%, #f5f5f4 100%)",
                  transition: "width 60ms linear",
                }}
              />
            </div>
          </div>

          <p className="absolute bottom-8 text-[9px] uppercase tracking-[0.3em] text-stone-800">
            Powered by Trivedi Technologies
          </p>
        </div>
      )}
    </>
  );
}
