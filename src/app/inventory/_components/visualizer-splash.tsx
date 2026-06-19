"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";

export function VisualizerSplash({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const DURATION = 2800;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / DURATION, 1);
      // ease-out quad — quick start, slows near 100%
      const eased = 1 - (1 - t) * (1 - t);
      setProgress(Math.round(eased * 100));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setFading(true);
        setTimeout(() => setVisible(false), 650);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <>
      {/* Splash overlay */}
      {visible && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ease-in ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          style={{
            background:
              "radial-gradient(ellipse at 28% 38%, rgba(200,180,140,0.07) 0%, transparent 55%)," +
              "radial-gradient(ellipse at 72% 62%, rgba(255,255,255,0.025) 0%, transparent 50%)," +
              "#0c0b0a",
          }}
        >
          {/* Brand mark */}
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

          {/* Progress */}
          <div className="w-60">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide text-stone-600">
                Opening visualizer
              </span>
              <span className="text-[11px] tabular-nums text-stone-600">
                {progress}%
              </span>
            </div>

            {/* Track */}
            <div className="h-[1.5px] w-full overflow-hidden rounded-full bg-stone-800">
              {/* Fill */}
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

          {/* Footer */}
          <p className="absolute bottom-8 text-[9px] uppercase tracking-[0.3em] text-stone-800">
            Powered by Trivedi Technologies
          </p>
        </div>
      )}

      {/* Page content — always in DOM, hidden behind splash */}
      <div
        className={`min-h-screen transition-opacity duration-300 ${
          visible && !fading ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {children}
      </div>
    </>
  );
}
