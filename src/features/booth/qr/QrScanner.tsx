import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Lecture de QR code avec la caméra arrière, entièrement sur l'appareil.
 * Aucune image n'est envoyée ni conservée.
 */
export default function QrScanner({
  onResult,
  onClose,
  onDenied,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
  onDenied: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    const finish = (text: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      stop();
      onResult(text);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO_CAMERA');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        if (!cancelled) onDenied();
        return;
      }
      if (cancelled) return stop();
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BD = (window as any).BarcodeDetector;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let detector: any = null;
      if (BD) {
        try {
          const formats: string[] = (await BD.getSupportedFormats?.()) ?? ['qr_code'];
          if (formats.includes('qr_code')) detector = new BD({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      const jsQR = detector ? null : (await import('jsqr')).default;

      let busy = false;
      timer = setInterval(async () => {
        if (busy || doneRef.current || !video.videoWidth) return;
        busy = true;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes?.[0]?.rawValue) finish(codes[0].rawValue);
          } else if (jsQR && ctx) {
            const w = Math.min(video.videoWidth, 800);
            const h = Math.round((video.videoHeight / video.videoWidth) * w);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data) finish(code.data);
          }
        } catch {
          // image suivante
        } finally {
          busy = false;
        }
      }, 200);
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onResult, onDenied]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-64 w-64 rounded-2xl border-4 border-background/90 shadow-[0_0_0_9999px_hsl(var(--foreground)/0.45)]" />
      </div>
      <p className="relative mt-[max(1rem,env(safe-area-inset-top))] px-4 text-center text-base font-medium text-background">
        Placez le QR code dans le cadre
      </p>
      <div className="relative mt-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="lg" variant="secondary" className="min-h-[56px] w-full text-base" onClick={onClose}>
          <X className="mr-2 h-5 w-5" /> Fermer
        </Button>
      </div>
    </div>
  );
}
