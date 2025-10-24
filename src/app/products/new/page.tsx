'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function NewProduct() {
  // ---- states (ประกาศให้ครบก่อน) ----
  const [role, setRole] = useState<'STAFF' | 'MANAGER' | 'OWNER' | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    cost_price: '',
    sale_price: '',
    qty: '0',
    category: '',
    image_url: '',
  });
  const [showScanner, setShowScanner] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  // ---- effects (ไม่ return ออกก่อนถึง hooks เหล่านี้) ----
  useEffect(() => {
    (async () => {
      setLoading(true);
      // role
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (u) {
        const r = await supabase
          .from('profiles')
          .select('role')
          .eq('id', u.id)
          .single();
        setRole((r.data?.role as any) ?? 'STAFF');
      } else {
        setRole('STAFF');
      }

      // categories
      const res = await supabase
        .from('products')
        .select('category')
        .order('category');
      const list = (res.data ?? [])
        .map((x: any) => x.category)
        .filter((x: string | null) => !!x && x.trim().length > 0) as string[];
      const uniq = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
      setCats(uniq);

      setLoading(false);
    })();
  }, []);

  // ---- memo (ต้องอยู่เสมอ ไม่ขึ้นกับการ return ก่อนหน้า) ----
  const topCats = useMemo(() => cats.slice(0, 6), [cats]);

  // ---- handlers ----
  async function save() {
    const { name, sku, cost_price, sale_price, qty, category, image_url } = form;
    const { error } = await supabase.from('products').insert({
      name,
      sku,
      cost_price: Number(cost_price || 0),
      sale_price: Number(sale_price || 0),
      qty: Number(qty || 0),
      category: category || null,
      image_url,
    });
    if (error) alert(error.message);
    else router.push('/products');
  }

  function handleScanFill(code: string) {
    setForm((f) => ({ ...f, sku: code }));
    setShowScanner(false);
  }

  // ---- render ----
  return (
    <div className="space-y-4 bg-zinc-950 min-h-screen text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = '/products')}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition"
        >
          <span className="text-lg">⬅️</span>
          <span className="text-sm font-medium">รายการสินค้า</span>
        </button>
        <span className="text-xs text-zinc-500">เพิ่มสินค้า</span>
      </div>

      <div className="px-3 pb-6 space-y-4">
        <h1 className="text-xl font-semibold mt-2">เพิ่มสินค้า</h1>

        {/* สถานะโหลด/สิทธิ์ */}
        {loading && <div className="text-zinc-400">กำลังโหลด…</div>}

        {!loading && role === 'STAFF' && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            สำหรับผู้จัดการ/เจ้าของร้านเท่านั้น
          </div>
        )}

        {!loading && role !== 'STAFF' && (
          <>
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            />

            <div className="grid gap-3">
              <input
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
                placeholder="ชื่อสินค้า"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />

              {/* SKU + ปุ่มสแกน */}
              <div>
                <div className="text-sm mb-1 text-zinc-300">บาร์โค้ด / SKU</div>
                <div className="flex gap-2">
                  <input
                    className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 flex-1"
                    placeholder="สแกนหรือพิมพ์รหัส"
                    value={form.sku}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sku: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-4 hover:bg-blue-500"
                    onClick={() => setShowScanner(true)}
                  >
                    📷 สแกน
                  </button>
                </div>
              </div>

              {/* หมวดหมู่: เลือกจากเดิมหรือพิมพ์ใหม่ */}
              <div>
                <div className="text-sm mb-1 text-zinc-300">หมวดหมู่</div>
                <input
                  list="category-suggest"
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 w-full"
                  placeholder="เลือกหรือพิมพ์ใหม่ เช่น เครื่องดื่ม, ขนม, ของใช้"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
                <datalist id="category-suggest">
                  {cats.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>

                {topCats.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {topCats.map((c) => (
                      <button
                        key={c}
                        className="px-3 py-1.5 rounded-full text-sm bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
                        onClick={() =>
                          setForm((f) => ({ ...f, category: c }))
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
                  placeholder="ราคาทุน"
                  inputMode="decimal"
                  value={form.cost_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cost_price: e.target.value }))
                  }
                />
                <input
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
                  placeholder="ราคาขาย"
                  inputMode="decimal"
                  value={form.sale_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sale_price: e.target.value }))
                  }
                />
                <input
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
                  placeholder="จำนวนเริ่มต้น"
                  inputMode="numeric"
                  value={form.qty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, qty: e.target.value }))
                  }
                />
              </div>

              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2"
                  onClick={save}
                >
                  บันทึก
                </button>
                <button
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-4 py-2"
                  onClick={() => router.push('/products')}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showScanner && (
        <BarcodeScanner
          onDetected={handleScanFill}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
