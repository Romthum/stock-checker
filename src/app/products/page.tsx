'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import BarcodeScanner from '@/components/BarcodeScanner';
import EditProductModal from '@/components/EditProductModal';
import { useRole } from '@/lib/useRole';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number | null;
  qty: number;
  updated_at: string;
  image_url: string | null;
  category: string | null;
};

export default function ProductsPage() {
  const { canManage } = useRole();
  const [editItem, setEditItem] = useState<Product | null>(null);

  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeCat, setActiveCat] = useState<string>('ทั้งหมด');

  async function load() {
    setErr('');
    setLoading(true);

    let query = supabase
      .from('products_public')
      .select('*')
      .order('category', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

    if (q.trim()) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) setErr(error.message);
    setItems((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function adjust(
    id: string,
    delta: number,
    reason: 'RESTOCK' | 'SALE' | 'ADJUST'
  ) {
    const { data: s } = await supabase.auth.getSession();
    const uid = s?.session?.user?.id;
    if (!uid) { setErr('ยังไม่ได้ล็อกอิน'); return; }
    const { error } = await supabase
      .from('stock_movements')
      .insert({ product_id: id, change: delta, reason, created_by: uid });
    if (error) setErr(error.message); else load();
  }

  const onScan = async (code: string) => {
    setShowScanner(false);
    setQ(code);
    await load();
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) set.add(p.category || 'อื่น ๆ');
    return ['ทั้งหมด', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    if (activeCat === 'ทั้งหมด') return items;
    const c = activeCat === 'อื่น ๆ' ? null : activeCat;
    return items.filter((p) => (p.category || 'อื่น ๆ') === (c ?? 'อื่น ๆ'));
  }, [items, activeCat]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    const list = activeCat === 'ทั้งหมด' ? items : filtered;
    for (const p of list) {
      const key = p.category || 'อื่น ๆ';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, filtered, activeCat]);

  return (
    <div className="space-y-4 min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header + กลับหน้าแรก */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition"
        >
          <span className="text-lg">🏠</span>
          <span className="text-sm font-medium">กลับหน้าหลัก</span>
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">สินค้า</span>
      </div>

      {/* แถบค้นหา + สแกน */}
      <div className="sticky top-[44px] z-20 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="ค้นหาชื่อ/บาร์โค้ด"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="rounded-lg px-4 text-sm bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            onClick={load}
          >
            ค้นหา
          </button>
          <button
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 text-sm text-white"
            onClick={() => setShowScanner(true)}
          >
            📷 สแกน
          </button>
        </div>
        {err && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</div>}
      </div>

      {/* หมวดหมู่เป็นแท็บ/ชิป */}
      <div className="sticky top-[96px] z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${
                activeCat === cat
                  ? 'bg-blue-600 text-white border-transparent'
                  : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 hover:dark:bg-zinc-800'
              }`}
              title={cat}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* เนื้อหา */}
      {loading ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400 py-10">กำลังโหลดสินค้า…</div>
      ) : (
        <div className="space-y-6 px-3 pb-8">
          {grouped.map(([cat, list]) => (
            <section key={cat}>
              {/* หัวหมวด */}
              <div className="sticky top-[140px] z-0 mb-2">
                <div className="inline-block bg-zinc-100 text-zinc-700 px-3 py-1 rounded-md border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800">
                  {cat} <span className="text-xs text-zinc-500 dark:text-zinc-400">({list.length})</span>
                </div>
              </div>

              {/* กริดสินค้า */}
              <div className="grid grid-cols-2 gap-3">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl overflow-hidden bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm hover:shadow-md transition"
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={p.image_url || '/placeholder.png'}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 320px"
                      />
                      {/* ป้ายราคา */}
                      <div className="absolute left-2 bottom-2 rounded-md bg-black/80 text-white text-sm font-semibold px-2 py-0.5">
                        ฿{p.sale_price ?? '-'}
                      </div>
                      {/* ป้ายสต็อกต่ำ */}
                      {p.qty <= 5 && (
                        <div className="absolute right-2 top-2 rounded-md bg-red-600 text-white text-[10px] px-2 py-1 shadow">
                          สต็อกต่ำ
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="font-medium text-sm leading-snug line-clamp-2 text-zinc-900 dark:text-zinc-50">{p.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{p.sku || '-'}</div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">คงเหลือ</div>
                        <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{p.qty}</div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          className="h-10 rounded-lg bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition"
                          onClick={() => adjust(p.id, +1, 'RESTOCK')}
                        >
                          +1 รับเข้า
                        </button>
                        <button
                          className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition"
                          onClick={() => adjust(p.id, -1, 'SALE')}
                        >
                          −1 ขาย
                        </button>
                      </div>

                      {canManage && (
                        <div className="mt-2">
                          <button
                            className="w-full h-9 rounded-lg border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            onClick={() => setEditItem(p)}
                          >
                            ✏️ แก้ไขสินค้า
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {!grouped.length && <div className="text-center text-zinc-500 dark:text-zinc-400 py-10">ไม่พบสินค้า</div>}
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onDetected={onScan} onClose={() => setShowScanner(false)} />
      )}

      {editItem && (
        <EditProductModal
          open={!!editItem}
          product={editItem}
          onClose={() => setEditItem(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
