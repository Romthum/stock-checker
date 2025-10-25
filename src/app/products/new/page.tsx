'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ImageUpload from '@/components/ImageUpload';
import BarcodeScanner from '@/components/BarcodeScanner';

type Role = 'STAFF' | 'MANAGER' | 'OWNER' | null;

type FormState = {
  name: string;
  sku: string;
  cost_price: string; // เก็บเป็น string เพื่อไม่ให้ input กระตุก
  sale_price: string;
  qty: string;        // ยอดเริ่มต้น จะบันทึกเป็น movement ADJUST
  category: string;
  image_url: string;
};

export default function NewProduct() {
  // ---------------- state ----------------
  const [role, setRole] = useState<Role>(null);
  const [form, setForm] = useState<FormState>({
    name: '',
    sku: '',
    cost_price: '',
    sale_price: '',
    qty: '0',
    category: '',
    image_url: '',
  });
  const [cats, setCats] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const router = useRouter();

  // ---------------- effects ----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        // role
        const { data: u } = await supabase.auth.getUser();
        if (u?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', u.user.id)
            .single();
          if (error) throw error;
          setRole((data?.role as Role) ?? 'STAFF');
        } else {
          setRole('STAFF');
        }

        // categories (อ่านจาก view เพื่อความปลอดภัย RLS)
        const { data: catRows, error: catErr } = await supabase
          .from('products_public')
          .select('category')
          .order('category', { ascending: true, nullsFirst: true });
        if (catErr) throw catErr;

        const uniq = Array.from(
          new Set(
            (catRows ?? [])
              .map((r: any) => (r.category as string | null) ?? '')
              .filter((x) => x && x.trim().length > 0)
              .map((x) => x.trim())
          )
        ).sort((a, b) => a.localeCompare(b));
        setCats(uniq);
      } catch (e: any) {
        setErr(e.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // top 8 หมวดแนะนำ
  const topCats = useMemo(() => cats.slice(0, 8), [cats]);

  // ---------------- helpers ----------------
  const setF = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const parseNum = (s: string): number | null => {
    if (s == null || s.trim() === '') return null;
    const n = Number(s.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  // ---------------- actions ----------------
  const handleScanFill = (code: string) => {
    setF('sku', code);
    setShowScanner(false);
  };

  async function save() {
    setErr('');
    setOk('');

    if (role === 'STAFF') {
      setErr('สำหรับผู้จัดการ/เจ้าของร้านเท่านั้น');
      return;
    }

    const name = form.name.trim();
    if (!name) {
      setErr('กรุณากรอกชื่อสินค้า');
      return;
    }

    const sku = form.sku.trim();
    const costPrice = parseNum(form.cost_price) ?? 0;
    const salePrice = parseNum(form.sale_price) ?? 0;
    const initQty = parseNum(form.qty) ?? 0;
    const category = form.category.trim() || null;
    const image_url = form.image_url.trim() || null;

    setBusy(true);
    try {
      // ตรวจ SKU ซ้ำ (ถ้ากรอก)
      if (sku) {
        const { data: dup, error: dupErr } = await supabase
          .from('products_public')
          .select('id')
          .eq('sku', sku)
          .limit(1);
        if (dupErr) throw dupErr;
        if (dup && dup.length > 0) {
          setErr('SKU นี้มีอยู่แล้วในระบบ');
          setBusy(false);
          return;
        }
      }

      // ต้องมี session เพื่อบันทึก movement
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

      // 1) เพิ่มสินค้า (ไม่ตั้ง qty ตรง ๆ ให้ trigger/ประวัติเป็นคนดูแล)
      const { data: inserted, error: insErr } = await supabase
        .from('products')
        .insert({
          name,
          sku: sku || null,
          cost_price: costPrice,
          sale_price: salePrice,
          category,
          image_url,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      // 2) ถ้ามียอดเริ่มต้น → ลง movement = ADJUST
      if (inserted?.id && initQty !== 0) {
        const { error: mvErr } = await supabase.from('stock_movements').insert({
          product_id: inserted.id,
          change: initQty,
          reason: 'ADJUST',
          created_by: uid,
          note: 'ตั้งยอดเริ่มต้น',
        });
        if (mvErr) throw mvErr;
      }

      setOk('บันทึกสำเร็จ ✅');
      // เคลียร์ฟอร์มให้พร้อมเพิ่มตัวต่อไปเร็ว ๆ
      setForm({
        name: '',
        sku: '',
        cost_price: '',
        sale_price: '',
        qty: '0',
        category: '',
        image_url: '',
      });

      // ไปหน้ารายการสินค้า
      router.push('/products');
    } catch (e: any) {
      setErr(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => router.push('/products')}
          className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition"
        >
          <span className="text-lg">⬅️</span>
          <span className="text-sm font-medium">รายการสินค้า</span>
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">เพิ่มสินค้า</span>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        <h1 className="text-xl font-semibold">เพิ่มสินค้า</h1>

        {loading && <div className="text-zinc-500 dark:text-zinc-400">กำลังโหลด…</div>}

        {!loading && role === 'STAFF' && (
          <div className="card p-4">
            สำหรับผู้จัดการ/เจ้าของร้านเท่านั้น
          </div>
        )}

        {!loading && role !== 'STAFF' && (
          <div className="card p-4 space-y-4">
            {/* อัปโหลดรูป */}
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setF('image_url', url)}
            />

            {/* ชื่อสินค้า */}
            <label className="block">
              <div className="text-sm muted mb-1">ชื่อสินค้า</div>
              <input
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                placeholder="เช่น โค้ก 325 ml แพ็ค"
                value={form.name}
                onChange={(e) => setF('name', e.target.value)}
              />
            </label>

            {/* SKU + สแกน */}
            <div>
              <div className="text-sm muted mb-1">บาร์โค้ด / SKU</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                  placeholder="สแกนหรือพิมพ์รหัส"
                  value={form.sku}
                  onChange={(e) => setF('sku', e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={() => setShowScanner(true)}
                >
                  📷 สแกน
                </button>
              </div>
            </div>

            {/* หมวดหมู่ (เลือกจากเดิมหรือพิมพ์ใหม่) */}
            <div>
              <div className="text-sm muted mb-1">หมวดหมู่</div>
              <input
                list="category-suggest"
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                placeholder="เลือกหรือพิมพ์ใหม่ เช่น เครื่องดื่ม / ขนม / ของใช้"
                value={form.category}
                onChange={(e) => setF('category', e.target.value)}
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
                      type="button"
                      className="px-3 py-1.5 rounded-full text-sm border bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
                      onClick={() => setF('category', c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ราคา/จำนวนเริ่มต้น */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <div className="text-sm muted mb-1">ราคาทุน (บาท)</div>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                  value={form.cost_price}
                  onChange={(e) => setF('cost_price', e.target.value)}
                  placeholder="0.00"
                />
              </label>

              <label className="block">
                <div className="text-sm muted mb-1">ราคาขาย (บาท)</div>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                  value={form.sale_price}
                  onChange={(e) => setF('sale_price', e.target.value)}
                  placeholder="0.00"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm muted">จำนวนเริ่มต้น (ชิ้น)</span>
                  <span className="text-xs text-zinc-400">(จะลงประวัติเป็น ADJUST)</span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                  value={form.qty}
                  onChange={(e) => setF('qty', e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            {/* สถานะ */}
            {err && <div className="text-sm text-rose-600 dark:text-rose-400">{err}</div>}
            {ok && <div className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</div>}

            {/* ปุ่ม */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => router.push('/products')}
                className="px-4 py-2 rounded-lg border bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                ← กลับรายการสินค้า
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
              >
                {busy ? 'กำลังบันทึก…' : 'บันทึกสินค้า'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal สแกนบาร์โค้ด */}
      {showScanner && (
        <BarcodeScanner onDetected={handleScanFill} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
