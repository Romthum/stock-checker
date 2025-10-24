'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  qty?: number | null;
  category?: string | null;
  image_url?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: Partial<Product>;
  onSaved: () => void;
};

export default function EditProductModal({ open, onClose, product, onSaved }: Props) {
  if (!open) return null;

  const [form, setForm] = useState<Product>({
    id: product.id!,
    name: product.name ?? '',
    sku: product.sku ?? '',
    cost_price: product.cost_price ?? 0,
    sale_price: product.sale_price ?? 0,
    qty: product.qty ?? 0,
    category: product.category ?? '',
    image_url: product.image_url ?? '',
  });
  const [busy, setBusy] = useState(false);

  // ✅ เก็บ qty เป็น string ระหว่างพิมพ์ เพื่อไม่ให้เด้งเป็น 0 ตลอด
  const [qtyStr, setQtyStr] = useState<string>(String(product.qty ?? 0));

  // helper แปลงเป็นตัวเลขปลอดภัย (ว่าง -> 0)
  const qtyNum = (() => {
    const n = parseInt(qtyStr, 10);
    return Number.isFinite(n) ? n : 0;
  })();

  async function save() {
    setBusy(true);
    try {
      // ใช้ค่าที่พิมพ์จริง
      const oldQty = Number(product.qty ?? 0);
      const newQty = qtyNum;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        const { data: s } = await supabase.auth.getSession();
        const uid = s?.session?.user?.id;
        if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

        const { error: mvErr } = await supabase.from('stock_movements').insert({
          product_id: form.id,
          change: delta,
          reason: 'ADJUST',
          created_by: uid,
          note: 'แก้จำนวนจากหน้าตั้งค่า',
        });
        if (mvErr) throw mvErr;
      }

      const { error: upErr } = await supabase
        .from('products')
        .update({
          name: form.name,
          sku: form.sku || null,
          cost_price: Number(form.cost_price ?? 0),
          sale_price: Number(form.sale_price ?? 0),
          category: form.category || null,
          image_url: form.image_url || null,
          // ไม่จำเป็นต้องอัปเดต qty ตรง ๆ เพราะ trigger จาก movements จัดการแล้ว
        })
        .eq('id', form.id);

      if (upErr) throw upErr;

      onSaved();
      onClose();
      alert('บันทึกสำเร็จ ✅');
    } catch (e: any) {
      alert(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`ยืนยันลบ "${form.name}" ?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', form.id);
      if (error) throw error;
      onSaved();
      onClose();
      alert('ลบสินค้าเรียบร้อย 🗑️');
    } catch (e: any) {
      alert(e.message || 'ลบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  // ปุ่มลัดปรับจำนวน (+1/-1) — ใช้ qtyStr แล้วค่อยแปลง
  const bump = (v: number) => {
    const n = parseInt(qtyStr || '0', 10) || 0;
    setQtyStr(String(n + v));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">🛠️ แก้ไขสินค้า</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        {/* ชื่อสินค้า */}
        <label className="block">
          <div className="text-sm text-zinc-400 mb-1">ชื่อสินค้า</div>
          <input
            className="w-full p-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        {/* SKU + หมวดหมู่ */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-zinc-400 mb-1">รหัสสินค้า (SKU/บาร์โค้ด)</div>
            <input
              className="w-full p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.sku ?? ''}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>
          <label className="block">
            <div className="text-sm text-zinc-400 mb-1">หมวดหมู่</div>
            <input
              className="w-full p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.category ?? ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="เช่น เครื่องดื่ม/ขนม"
            />
          </label>
        </div>

        {/* ราคาทุน + ราคาขาย */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-zinc-400 mb-1">ราคาทุน (บาท)</div>
            <input
              type="number"
              className="w-full p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.cost_price ?? 0}
              onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            <div className="text-sm text-zinc-400 mb-1">ราคาขาย (บาท)</div>
            <input
              type="number"
              className="w-full p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.sale_price ?? 0}
              onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
            />
          </label>
        </div>

        {/* จำนวนคงเหลือ + ปุ่ม +1/-1 + พิมพ์เองได้เต็มที่ */}
        <label className="block">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-400">จำนวนคงเหลือ (ชิ้น)</span>
            <span className="text-xs text-zinc-500">
              จะถูกบันทึกเป็นรายการ <b>ADJUST</b> ในประวัติสต็อก
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 rounded-lg bg-zinc-800 border border-zinc-700"
              onClick={() => bump(-1)}
              type="button"
            >
              −1
            </button>
            <input
              inputMode="numeric"            // 👍 มือถือแสดงแป้นตัวเลข
              pattern="[0-9]*"
              className="flex-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700 text-right"
              value={qtyStr}
              onChange={(e) => {
                // อนุญาตค่าว่างให้พิมพ์ต่อได้, กรองอักขระที่ไม่ใช่ตัวเลข
                const raw = e.target.value.replace(/[^\d]/g, '');
                setQtyStr(raw);
              }}
              placeholder="0"
            />
            <button
              className="px-3 rounded-lg bg-zinc-800 border border-zinc-700"
              onClick={() => bump(+1)}
              type="button"
            >
              +1
            </button>
          </div>
        </label>

        {/* URL รูปสินค้า */}
        <label className="block">
          <div className="text-sm text-zinc-400 mb-1">ลิงก์รูปสินค้า</div>
          <input
            className="w-full p-2 bg-zinc-800 rounded-lg border border-zinc-700 text-xs"
            value={form.image_url ?? ''}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="เช่น https://.../image.jpg"
          />
        </label>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <button className="px-4 py-2 text-zinc-400 hover:text-white" onClick={onClose}>
            ยกเลิก
          </button>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg"
              onClick={del}
              disabled={busy}
            >
              🗑️ ลบสินค้า
            </button>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
              onClick={save}
              disabled={busy}
            >
              💾 {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
