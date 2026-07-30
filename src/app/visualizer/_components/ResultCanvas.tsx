"use client";

import { useEffect, useRef } from "react";

type ResultCanvasProps = {
  imageUrl: string;
};

export default function ResultCanvas({ imageUrl }: ResultCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-md border border-border bg-surface-muted"
    />
  );
}
