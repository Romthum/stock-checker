'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Product = {
  id: string;
  name: string;
  sku?: string | null;
  cost_price?: number | null;   // ⬅ optional
  sale_price?: number | null;   // ⬅ optional
  qty?: number;                 // ⬅ optional
  category?: string | null;     // ⬅ optional
  image_url?: string | null;    // ⬅ optional
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: Partial<Product>;      // ⬅ รับ partial ได้
  onSaved: () => void;
};

export default function EditProductModal({ open, onClose, product, onSaved }: Props) {
  if (!open) return null;

  // ใส่ค่าเริ่มต้นกัน undefined
  const [form, setForm] = useState<Product>({
    id: product.id!,                          // id ต้องมีเมื่อแก้ไข
    name: product.name ?? '',
    sku: product.sku ?? '',
    cost_price: product.cost_price ?? 0,
    sale_price: product.sale_price ?? 0,
    qty: product.qty ?? 0,
    category: product.category ?? '',
    image_url: product.image_url ?? '',
  });

  async function save() {
    const { error } = await supabase
      .from('products')
      .update({
        name: form.name,
        sku: form.sku || null,
        cost_price: Number(form.cost_price ?? 0),
        sale_price: Number(form.sale_price ?? 0),
        qty: Number(form.qty ?? 0),
        category: form.category || null,
        image_url: form.image_url || null,
      })
      .eq('id', form.id);

    if (error) {
      alert(error.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
        <div className="text-lg font-semibold">แก้ไขสินค้า</div>

        <input
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
          placeholder="ชื่อสินค้า"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            placeholder="บาร์โค้ด / SKU"
            value={form.sku ?? ''}
            onChange={e => setForm({ ...form, sku: e.target.value })}
          />
          <input
            type="number"
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            placeholder="คงเหลือ"
            value={form.qty ?? 0}
            onChange={e => setForm({ ...form, qty: Number(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            placeholder="ราคาทุน"
            value={form.cost_price ?? 0}
            onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })}
          />
          <input
            type="number"
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            placeholder="ราคาขาย"
            value={form.sale_price ?? 0}
            onChange={e => setForm({ ...form, sale_price: Number(e.target.value) })}
          />
        </div>

        <input
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
          placeholder="หมวดหมู่"
          value={form.category ?? ''}
          onChange={e => setForm({ ...form, category: e.target.value })}
        />

        <input
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
          placeholder="ภาพ (URL)"
          value={form.image_url ?? ''}
          onChange={e => setForm({ ...form, image_url: e.target.value })}
        />

        <div className="flex gap-2 justify-end pt-2">
          <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}
