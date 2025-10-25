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

const PAGE_SIZE = 40;

export default function ProductsPage() {
  const { canManage } = useRole();

  // data & ui
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [err, setErr] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);

  // categories UI (มาจาก view product_categories)
  const [allCats, setAllCats] = useState<string[]>(['ทั้งหมด']);
  const [activeCat, setActiveCat] = useState<string>('ทั้งหมด');

  // pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // edit / updating
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ---------- โหลดหมวดหมู่ทั้งหมดจาก view ----------
  async function loadCategories() {
    const { data, error } = await supabase
      .from('product_categories') // ⚠️ ต้องมี view นี้ในฐานข้อมูล
      .select('category')
      .order('category', { ascending: true });

    if (!error) {
      const cats = (data ?? [])
        .map((r: any) => r.category as string)
        .filter(Boolean);
      setAllCats(['ทั้งหมด', ...cats]);
    }
  }

  useEffect(() => {
    loadCategories();

    // Realtime: มีการเปลี่ยนแปลงที่ products → reload หมวด
    const ch = supabase
      .channel('cats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => loadCategories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- debounce คำค้นหา ----------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // ---------- โหลดสินค้า (เร็วขึ้น: ไม่ใช้ COUNT, ดึงเกิน 1 เพื่อตรวจ hasMore) ----------
  useEffect(() => {
    let aborted = false;

    async function load() {
      setErr('');
      setLoading(true);

      // base query
      let query = supabase
        .from('products_public')
        .select('id,name,sku,sale_price,qty,updated_at,image_url,category');

      // filter: category
      if (activeCat !== 'ทั้งหมด') {
        if (activeCat === 'อื่น ๆ') query = query.is('category', null);
        else query = query.eq('category', activeCat);
      }

      // search
      const s = debouncedQ;
      if (s) {
        // ถ้าเหมือนบาร์โค้ด → ลอง exact sku ก่อน
        const looksLikeBarcode = /^\d{6,}$/.test(s);
        if (looksLikeBarcode) {
          const exact = await query
            .eq('sku', s)
            .order('name', { ascending: true })
            .range(0, PAGE_SIZE); // +1 เพื่อเช็ค hasMore
          if (exact.error) {
            if (!aborted) {
              setErr(exact.error.message);
              setLoading(false);
            }
            return;
          }
          const list = (exact.data ?? []) as Product[];
          const more = list.length > PAGE_SIZE;
          const sliced = more ? list.slice(0, PAGE_SIZE) : list;

          if (!aborted) {
            setItems(prev => (page === 1 ? sliced : [...prev, ...sliced]));
            setHasMore(more);
            setLoading(false);
          }
          return;
        }
        // fallback → ILIKE name/sku
        query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
      }

      // order: ใช้คอลัมน์ที่มีดัชนี
      if (!s) {
        query = query
          .order('category', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true });
      } else {
        query = query.order('name', { ascending: true });
      }

      // paging: ดึงเกิน 1 รายการ
      const start = (page - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE; // +1
      const res = await query.range(start, end);

      if (res.error) {
        if (!aborted) {
          setErr(res.error.message);
          setLoading(false);
        }
        return;
      }

      const list = (res.data ?? []) as Product[];
      const more = list.length > PAGE_SIZE;
      const sliced = more ? list.slice(0, PAGE_SIZE) : list;

      if (!aborted) {
        setItems(prev => (page === 1 ? sliced : [...prev, ...sliced]));
        setHasMore(more);
        setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, activeCat]);

  // reset page เมื่อเปลี่ยนการค้นหา/หมวด
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, activeCat]);

  // ---------- สแกนบาร์โค้ด ----------
  const handleScan = (code: string) => {
    setShowScanner(false);
    setQ(code);
    setPage(1); // useEffect จะโหลดผลให้เอง
  };

  // ---------- +1/−1 แบบไม่รีโหลดทั้งหน้า ----------
  async function adjust(
    id: string,
    delta: number,
    reason: 'RESTOCK' | 'SALE' | 'ADJUST'
  ) {
    setUpdatingId(id);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) {
        setErr('ยังไม่ได้ล็อกอิน');
        return;
      }

      const { error } = await supabase
        .from('stock_movements')
        .insert({ product_id: id, change: delta, reason, created_by: uid });
      if (error) throw error;

      setItems(prev =>
        prev.map(p => (p.id === id ? { ...p, qty: p.qty + delta } : p))
      );
    } catch (e: any) {
      setErr(e.message || 'ปรับจำนวนไม่สำเร็จ');
    } finally {
      setUpdatingId(null);
    }
  }

  // group สำหรับแสดงหัวหมวด (จาก items ที่กำลังแสดง)
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of items) {
      const key = p.category || 'อื่น ๆ';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

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
      <div className="sticky top-11 z-20 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="ค้นหาชื่อ/บาร์โค้ด"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="rounded-lg px-4 text-sm bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            onClick={() => setPage(1)}
            title="ปกติระบบจะค้นหาอัตโนมัติ (ดีบาวซ์ 300ms)"
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

      {/* หมวดหมู่เป็นแท็บ/ชิป — ใช้ allCats (มาจาก view) */}
      <div className="sticky top-24 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {allCats.map((cat) => (
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
        <div className="space-y-6 px-3 pb-4">
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
                          disabled={updatingId === p.id}
                          className="h-10 rounded-lg bg-zinc-200 text-zinc-900 hover:bg-zinc-300 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition"
                          onClick={() => adjust(p.id, +1, 'RESTOCK')}
                        >
                          +1 รับเข้า
                        </button>
                        <button
                          disabled={updatingId === p.id}
                          className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60 active:scale-95 transition"
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

          {!grouped.length && (
            <div className="text-center text-zinc-500 dark:text-zinc-400 py-10">
              ไม่พบสินค้า
            </div>
          )}

          {/* ปุ่มโหลดเพิ่ม */}
          {hasMore && (
            <div className="pt-2">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="w-full h-10 rounded-lg bg-zinc-200 text-zinc-900 hover:bg-zinc-300 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                {loading ? 'กำลังโหลด…' : 'โหลดเพิ่มเติม'}
              </button>
            </div>
          )}
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onDetected={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {editItem && (
        <EditProductModal
          open={!!editItem}
          product={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => setPage(1)} // กลับหน้าแรกให้ข้อมูลใหม่อยู่บนสุด
        />
      )}
    </div>
  );
}
