'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import BarcodeScanner from '@/components/BarcodeScanner';
import Image from 'next/image';

type ProductForm = {
  name: string;
  sku: string;
  category: string;
  cost_price: number | '';
  sale_price: number | '';
  qty: number | '';
  image_url: string;
};

type ProductRow = { category: string | null };

export default function NewProductPage() {
  // ---------- state ----------
  const [form, setForm] = useState<ProductForm>({
    name: '',
    sku: '',
    category: '',
    cost_price: '',
    sale_price: '',
    qty: '',
    image_url: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // ---------- โหลดหมวดหมู่เดิมเพื่อแนะนำ ----------
  const [cats, setCats] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('products_public')
        .select('category')
        .order('category', { ascending: true, nullsFirst: true });
      if (!error) {
        const s = new Set<string>();
        (data as ProductRow[]).forEach(r => {
          if (r.category && r.category.trim()) s.add(r.category.trim());
        });
        setCats(Array.from(s));
      }
    })();
  }, []);
  const topCats = useMemo(() => cats.slice(0, 8), [cats]);

  // ---------- handlers ----------
  const onScan = (code: string) => {
    setShowScanner(false);
    setForm(f => ({ ...f, sku: code }));
  };

  const onChange = (k: keyof ProductForm, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  async function save() {
    setErr('');
    setOk('');
    // validate
    if (!form.name.trim()) { setErr('กรุณากรอกชื่อสินค้า'); return; }

    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

      // แทรกสินค้าพร้อมยอดเริ่มต้น (ใช้ trigger อัปเดต qty เมื่อมี movement)
      const { data: inserted, error } = await supabase
        .from('products')
        .insert({
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          category: form.category.trim() || null,
          cost_price: form.cost_price === '' ? null : Number(form.cost_price),
          sale_price: form.sale_price === '' ? null : Number(form.sale_price),
          image_url: form.image_url.trim() || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // ถ้ากรอก qty เริ่มต้น → ลง movement เป็น ADJUST
      const initQty = form.qty === '' ? 0 : Number(form.qty);
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
      setForm({
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        sale_price: '',
        qty: '',
        image_url: '',
      });
    } catch (e: any) {
      setErr(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition"
        >
          <span className="text-lg">🏠</span>
          <span className="text-sm font-medium">กลับหน้าหลัก</span>
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">เพิ่มสินค้าใหม่</span>
      </div>

      {/* Form card */}
      <div className="max-w-3xl mx-auto px-3 py-4">
        <div className="card p-4 space-y-4">
          {/* แถวบน: ตัวอย่างรูป + ชื่อ */}
          <div className="flex gap-3">
            <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
              <Image
                src={form.image_url || '/placeholder.png'}
                alt="preview"
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <label className="flex-1">
              <div className="text-sm muted mb-1">ชื่อสินค้า</div>
              <input
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                placeholder="เช่น โค้ก 325 ml แพ็ค"
                value={form.name}
                onChange={(e) => onChange('name', e.target.value)}
              />
            </label>
          </div>

          {/* SKU + สแกน + หมวด */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              <div className="text-sm muted mb-1">รหัสสินค้า (SKU/บาร์โค้ด)</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                  placeholder="สแกนหรือพิมพ์"
                  value={form.sku}
                  onChange={(e) => onChange('sku', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="rounded-lg px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  📷 สแกน
                </button>
              </div>
            </label>

            <label>
              <div className="text-sm muted mb-1">หมวดหมู่</div>
              <input
                list="cat-suggest"
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                placeholder="เช่น เครื่องดื่ม / ขนม"
                value={form.category}
                onChange={(e) => onChange('category', e.target.value)}
              />
              {/* suggestions */}
              <datalist id="cat-suggest">
                {topCats.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {cats.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {topCats.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="px-2 py-1 text-xs rounded-full border bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
                      onClick={() => setForm(f => ({ ...f, category: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </label>
          </div>

          {/* ราคา/จำนวน */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label>
              <div className="text-sm muted mb-1">ราคาทุน (บาท)</div>
              <input
                type="number"
                inputMode="decimal"
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                value={form.cost_price}
                onChange={(e) => onChange('cost_price', e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              <div className="text-sm muted mb-1">ราคาขาย (บาท)</div>
              <input
                type="number"
                inputMode="decimal"
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                value={form.sale_price}
                onChange={(e) => onChange('sale_price', e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm muted">จำนวนเริ่มต้น (ชิ้น)</span>
                <span className="text-xs text-zinc-400">(บันทึกเป็น ADJUST)</span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                value={form.qty}
                onChange={(e) => onChange('qty', e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          {/* รูปภาพ */}
          <label>
            <div className="text-sm muted mb-1">ลิงก์รูปสินค้า</div>
            <input
              className="w-full rounded-lg border px-3 py-2 bg-white text-zinc-900 border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 text-xs"
              value={form.image_url}
              onChange={(e) => onChange('image_url', e.target.value)}
              placeholder="เช่น https://.../image.jpg"
            />
          </label>

          {/* สถานะ */}
          {err && <div className="text-sm text-rose-600 dark:text-rose-400">{err}</div>}
          {ok && <div className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</div>}

          {/* ปุ่ม */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => (window.location.href = '/products')}
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
      </div>

      {/* Modal สแกนบาร์โค้ด */}
      {showScanner && (
        <BarcodeScanner onDetected={onScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
