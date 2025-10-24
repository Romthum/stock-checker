'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ImageUpload from './ImageUpload';

type Product = {
  id: string;
  name: string;
  sku: string|null;
  cost_price: number|null;
  sale_price: number|null;
  qty: number;
  category: string|null;
  image_url: string|null;
};

export default function EditProductModal({
  open, onClose, product, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Product>(product);
  if (!open) return null;

  async function save() {
    const { error } = await supabase.from('products').update({
      name: form.name,
      sku: form.sku,
      cost_price: form.cost_price ?? 0,
      sale_price: form.sale_price ?? 0,
      qty: form.qty ?? 0,
      category: form.category,
      image_url: form.image_url,
    }).eq('id', form.id);
    if (error) alert(error.message); else { onSaved(); onClose(); }
  }

  async function remove() {
    if (!confirm(`ลบสินค้า: ${form.name}?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', form.id);
    if (error) alert(error.message); else { onSaved(); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">แก้ไขสินค้า</div>
          <button className="text-zinc-400 hover:text-white" onClick={onClose}>✕</button>
        </div>

        <div className="grid gap-3 max-h-[70vh] overflow-auto pr-1">
          <ImageUpload
            value={form.image_url || undefined}
            onChange={(url)=>setForm(p=>({ ...p, image_url: url }))}
          />
          <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            value={form.name} onChange={e=>setForm(p=>({...p, name: e.target.value}))} placeholder="ชื่อสินค้า" />
          <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            value={form.sku || ''} onChange={e=>setForm(p=>({...p, sku: e.target.value}))} placeholder="SKU" />
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
              value={form.cost_price ?? 0} onChange={e=>setForm(p=>({...p, cost_price: Number(e.target.value||0)}))}
              placeholder="ราคาทุน" inputMode="decimal" />
            <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
              value={form.sale_price ?? 0} onChange={e=>setForm(p=>({...p, sale_price: Number(e.target.value||0)}))}
              placeholder="ราคาขาย" inputMode="decimal" />
            <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
              value={form.qty ?? 0} onChange={e=>setForm(p=>({...p, qty: Number(e.target.value||0)}))}
              placeholder="คงเหลือ" inputMode="numeric" />
            <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
              value={form.category || ''} onChange={e=>setForm(p=>({...p, category: e.target.value}))}
              placeholder="หมวดหมู่" />
          </div>
        </div>

        <div className="flex justify-between gap-2 mt-3">
          <button className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2" onClick={remove}>ลบสินค้า</button>
          <div className="ml-auto flex gap-2">
            <button className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2" onClick={onClose}>ยกเลิก</button>
            <button className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2" onClick={save}>บันทึก</button>
          </div>
        </div>
      </div>
    </div>
  );
}
