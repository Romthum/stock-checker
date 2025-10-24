'use client';
import { useRef } from 'react';

export default function ImageUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="w-full flex justify-center">
      <div
        onClick={() => fileRef.current?.click()}
        className="relative cursor-pointer group rounded-xl border-2 border-dashed border-zinc-700 hover:border-blue-500 transition-all duration-200 w-full max-w-sm aspect-square overflow-hidden bg-zinc-900/40 flex flex-col items-center justify-center text-center"
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Product"
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-sm font-medium">
              📸 เปลี่ยนรูปภาพ
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-blue-400 transition">
            <div className="text-5xl mb-2">📷</div>
            <div className="text-sm font-medium">แตะเพื่อเพิ่มรูปภาพสินค้า</div>
            <div className="text-xs opacity-70 mt-1">(รองรับ JPG / PNG)</div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        hidden
      />
    </div>
  );
}
