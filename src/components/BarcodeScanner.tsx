'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  // Native (BarcodeDetector)
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fallback (Quagga2)
  const quaggaContainerRef = useRef<HTMLDivElement | null>(null);
  const quaggaRef = useRef<any>(null);

  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);

  const loadQuagga = async () => {
    const mod: any = await import('@ericblade/quagga2');
    quaggaRef.current = mod.default ?? mod;
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;

    const startNative = async () => {
      // @ts-ignore
      const hasNative = typeof window !== 'undefined' && window.BarcodeDetector;
      if (!hasNative) return false;

      try {
        // @ts-ignore
        const detector = new window.BarcodeDetector({
          formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code'],
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!videoRef.current) return false;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          if (stop) return;
          try {
            const v = videoRef.current!;
            if (v.videoWidth && v.videoHeight) {
              const canvas = document.createElement('canvas');
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(v, 0, 0);
              const bitmap = await createImageBitmap(canvas);
              // @ts-ignore
              const codes = await detector.detect(bitmap);
              if (codes.length) {
                onDetected(codes[0].rawValue);
                return;
              }
            }
          } catch {/* ignore single frame */}
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return true;
      } catch (e: any) {
        setError(e?.message || 'เปิดกล้องไม่สำเร็จ');
        return false;
      }
    };

    const startFallback = async () => {
      setUsingFallback(true);
      await loadQuagga();
      const Quagga = quaggaRef.current;
      const targetEl = quaggaContainerRef.current;
      if (!Quagga || !targetEl) {
        setError('โหลดตัวสแกนหรือ target ไม่พร้อม');
        return false;
      }
      return new Promise<boolean>((resolve) => {
        Quagga.init(
          {
            inputStream: {
              type: 'LiveStream',
              target: targetEl, // ใช้ div เป็นเป้าหมาย
              constraints: {
                facingMode: 'environment',
                width: { min: 640, ideal: 1280 },
                height: { min: 360, ideal: 720 },
                aspectRatio: { min: 1, max: 2 },
              },
            },
            decoder: {
              readers: [
                'ean_reader','ean_8_reader','upc_reader','upc_e_reader','code_128_reader','code_39_reader',
              ],
            },
            locate: true,
          },
          (err: any) => {
            if (err) {
              setError(err.message || 'เริ่มสแกนไม่ได้');
              resolve(false);
              return;
            }
            Quagga.start();
            Quagga.onDetected((result: any) => {
              const code = result?.codeResult?.code;
              if (code) onDetected(code);
            });
            resolve(true);
          }
        );
      });
    };

    (async () => {
      const okNative = await startNative();
      if (!okNative) await startFallback();
    })();

    return () => {
      stop = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const Quagga = quaggaRef.current;
      if (Quagga) {
        try {
          Quagga.stop();
          Quagga.offDetected && Quagga.offDetected(() => {});
        } catch {}
      }
    };
  }, [onDetected]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', color: '#fff',
        display: 'grid', placeItems: 'center', zIndex: 50,
      }}
    >
      <div style={{ width: 'min(96vw, 800px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <strong>สแกนบาร์โค้ด {usingFallback ? '(โหมดสำรอง)' : ''}</strong>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px 10px' }}>ปิด</button>
        </div>

        {!usingFallback && (
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', borderRadius: 8, background: '#000', transform: 'scaleX(-1)' }}
          />
        )}

        {usingFallback && (
          <div
            ref={quaggaContainerRef}
            style={{
              width: '100%', minHeight: 280, borderRadius: 8,
              background: '#000', overflow: 'hidden', position: 'relative',
            }}
          />
        )}

        {!!error && <div style={{ color: '#ffb3b3', marginTop: 8 }}>Error: {error}</div>}
        <div style={{ opacity: 0.7, marginTop: 8, fontSize: 12 }}>
          เคล็ดลับ: ใช้ไฟฉาย/แสงช่วยให้สแกนไวขึ้น
        </div>
      </div>
    </div>
  );
}
