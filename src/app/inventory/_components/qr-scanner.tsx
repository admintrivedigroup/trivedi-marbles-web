"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";

type QrScannerProps = {
  onClose: () => void;
};

type Html5QrcodeScanner = {
  start: (
    constraint: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: undefined,
  ) => Promise<void>;
  stop: () => Promise<void>;
};

async function safeStop(scanner: Html5QrcodeScanner | null, isRunning: React.MutableRefObject<boolean>) {
  if (!scanner || !isRunning.current) return;
  isRunning.current = false;
  try {
    await scanner.stop();
  } catch {
    // ignore "not running" errors
  }
}

export function QrScanner({ onClose }: QrScannerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const scannerId = useRef(`qr-reader-${Math.random().toString(36).slice(2, 8)}`);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isRunningRef = useRef(false);
  const doneRef = useRef(false);

  const navigateToPath = useCallback((text: string) => {
    const lotMatch = text.match(/\/inventory\/lot\/([^/?#]+)/);
    if (lotMatch) return `/inventory/lot/${lotMatch[1]}`;
    const slabMatch = text.match(/\/inventory\/slab\/([^/?#]+)/);
    if (slabMatch) return `/inventory/slab/${slabMatch[1]}`;
    return `/inventory/slab/${text}`;
  }, []);

  const handleScan = useCallback(
    async (text: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      await safeStop(scannerRef.current, isRunningRef);
      const path = navigateToPath(text);
      onClose();
      router.push(path);
    },
    [navigateToPath, onClose, router],
  );

  const handleClose = useCallback(async () => {
    doneRef.current = true;
    await safeStop(scannerRef.current, isRunningRef);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const id = scannerId.current;
    let unmounted = false;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (unmounted) return;

      const scanner = new Html5Qrcode(id) as Html5QrcodeScanner;
      scannerRef.current = scanner;

      if (!window.isSecureContext) {
        if (!unmounted) {
          setError("Camera requires a secure connection (HTTPS). Ask your admin to start the server with: npm run dev:lan:https");
        }
        return;
      }

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleScan,
          undefined,
        );
        if (!unmounted) isRunningRef.current = true;
      } catch (err) {
        if (!unmounted) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
            setError("Camera permission denied. Please allow camera access in your browser settings and try again.");
          } else {
            setError("Could not start camera. Please check camera permissions and try again.");
          }
        }
      }
    })();

    return () => {
      unmounted = true;
      safeStop(scannerRef.current, isRunningRef);
    };
  }, [handleScan]);

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 text-white">
          <Camera className="h-5 w-5" />
          <span className="font-semibold">Scan QR Code</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close scanner"
          className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 active:bg-white/40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-white">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-white px-6 py-2 font-medium text-gray-900"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div id={scannerId.current} className="w-full max-w-sm overflow-hidden rounded-lg" />
          <p className="text-sm text-white/60">Point your camera at a lot or slab QR code</p>
        </div>
      )}
    </div>
  );
}
