'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function EditProductModal({ open, onClose, product, onSaved }: any) {
  const [form, setForm] = useState(product);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function save() {
    setLoading(true);
    const { error } = await supabase
      .from('products')
      .update({
        name: form.name,
        sku: form.sku,
        cost_price: form.cost_price,
        sale_price: form.sale_price,
        category: form.category,
        image_url: form.image_url,
      })
      .eq('id', form.id);
    setLoading(false);
    if (error) alert(error.message);
    else {
      alert('บันทึกข้อมูลสินค้าเรียบร้อย ✅');
      onSaved();
      onClose();
    }
  }

  async function del() {
    if (!confirm(`แน่ใจหรือไม่ที่จะลบ "${form.name}" ?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', form.id);
    if (error) alert(error.message);
    else {
      alert('ลบสินค้าเรียบร้อย 🗑️');
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 text-zinc-100 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-zinc-800">
        <h2 className="text-xl font-bold">🛠️ แก้ไขสินค้า</h2>

        {/* ชื่อสินค้า */}
        <label className="block">
          <span className="text-sm text-zinc-400">ชื่อสินค้า</span>
          <input
            className="w-full mt-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        {/* SKU + หมวดหมู่ */}
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-sm text-zinc-400">รหัสสินค้า (SKU)</span>
            <input
              className="w-full mt-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>

          <label>
            <span className="text-sm text-zinc-400">หมวดหมู่</span>
            <input
              className="w-full mt-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.category ?? ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
        </div>

        {/* ราคาทุน + ราคาขาย */}
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-sm text-zinc-400">ราคาทุน (บาท)</span>
            <input
              type="number"
              className="w-full mt-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.cost_price ?? 0}
              onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
            />
          </label>

          <label>
            <span className="text-sm text-zinc-400">ราคาขาย (บาท)</span>
            <input
              type="number"
              className="w-full mt-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700"
              value={form.sale_price ?? 0}
              onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
            />
          </label>
        </div>

        {/* URL รูปสินค้า */}
        <label>
          <span className="text-sm text-zinc-400">ลิงก์รูปสินค้า</span>
          <input
            className="w-full mt-1 p-2 bg-zinc-800 rounded-lg border border-zinc-700 text-xs"
            value={form.image_url ?? ''}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
        </label>

        {/* ปุ่มควบคุม */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white transition"
          >
            ยกเลิก
          </button>

          <div className="flex gap-2">
            <button
              onClick={del}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
            >
              🗑️ ลบสินค้า
            </button>
            <button
              disabled={loading}
              onClick={save}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              💾 {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
