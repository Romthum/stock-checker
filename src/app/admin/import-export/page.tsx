'use client';

import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { useRole } from '@/lib/useRole';

type CSVRow = Record<string, string>;
type ProductInsert = {
  name: string;
  sku?: string | null;
  category?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  image_url?: string | null;
};

const REQUIRED = ['name']; // ฟิลด์ที่ต้องมีอย่างน้อย

export default function ImportExportPage() {
  const { canManage } = useRole();

  // Upload & preview
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parseErr, setParseErr] = useState<string>('');

  // Mapping header -> field
  const [mapName, setMapName] = useState<string>('name');
  const [mapSku, setMapSku] = useState<string>('sku');
  const [mapCategory, setMapCategory] = useState<string>('category');
  const [mapCost, setMapCost] = useState<string>('cost_price');
  const [mapSale, setMapSale] = useState<string>('sale_price');
  const [mapImage, setMapImage] = useState<string>('image_url');

  // Import status
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{done: number; total: number}>({done: 0, total: 0});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // Export status
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // default mapping ถ้าหัวตารางเป็นภาษาไทย/อื่น ๆ ให้ผู้ใช้แก้จาก dropdown
  }, []);

  const preview = useMemo(() => rows.slice(0, 10), [rows]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setRows([]);
    setHeaders([]);
    setParseErr('');
    setErr('');
    setOk('');
    if (!f) return;

    Papa.parse<CSVRow>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => (h || '').trim(),
      complete: (res) => {
        if (res.errors && res.errors.length) {
          setParseErr(res.errors.map(x => x.message).join(' | '));
        }
        const data = (res.data || []).filter(Boolean);
        setRows(data);
        // รวบหัวตารางจากทุกแถว
        const cols = new Set<string>();
        data.forEach(r => Object.keys(r || {}).forEach(k => cols.add((k || '').trim())));
        const arr = Array.from(cols);
        setHeaders(arr);
        // เดายอด map อัตโนมัติถ้าเจอ
        if (arr.includes('Name') && !arr.includes('name')) setMapName('Name');
        if (arr.includes('SKU') && !arr.includes('sku')) setMapSku('SKU');
        if (arr.includes('Category') && !arr.includes('category')) setMapCategory('Category');
        if (arr.includes('Cost') && !arr.includes('cost_price')) setMapCost('Cost');
        if (arr.includes('Price') && !arr.includes('sale_price')) setMapSale('Price');
        if (arr.includes('Image') && !arr.includes('image_url')) setMapImage('Image');
      },
      error: (e) => setParseErr(e.message || 'อ่านไฟล์ไม่สำเร็จ'),
    });
  }

  function getVal(r: CSVRow, key?: string) {
    if (!key) return '';
    return (r[key] ?? '').toString().trim();
  }

  function parseNum(s: string): number | null {
    if (s === '' || s == null) return null;
    const n = Number((s || '').replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  async function doImport() {
    setErr('');
    setOk('');
    if (!canManage) { setErr('คุณไม่มีสิทธิ์นำเข้าข้อมูล'); return; }
    if (!rows.length) { setErr('ยังไม่มีข้อมูล CSV'); return; }
    // ตรวจว่ามี name อย่างน้อย
    const nameKey = mapName || '';
    if (!nameKey || !headers.includes(nameKey)) {
      setErr('กรุณาเลือกคอลัมน์ "name" ให้ถูกต้อง');
      return;
    }

    // สร้าง payload
    const payload: ProductInsert[] = rows.map((r) => ({
      name: getVal(r, mapName),
      sku: (getVal(r, mapSku) || null) || null,
      category: (getVal(r, mapCategory) || null) || null,
      cost_price: parseNum(getVal(r, mapCost)),
      sale_price: parseNum(getVal(r, mapSale)),
      image_url: (getVal(r, mapImage) || null) || null,
    })).filter(p => (p.name || '').trim());

    if (!payload.length) { setErr('ไม่มีแถวที่มีชื่อสินค้า'); return; }

    // อัปโหลดแบบแบ่งชุด เพื่อลดภาระ IO
    setBusy(true);
    setProgress({done: 0, total: payload.length});
    try {
      const chunkSize = 200;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        // ใช้ upsert โดย onConflict = 'sku' ถ้าโปรเจกต์คุณตั้ง unique index ที่ sku
        // ถ้าไม่ได้ตั้ง unique(sku) ให้เปลี่ยนเป็น insert() แทน
        const { error } = await supabase
          .from('products')
          .upsert(chunk, { onConflict: 'sku' })
          .select('id'); // ขอ select เล็กน้อยเพื่อรอให้เสร็จ
        if (error) throw error;
        setProgress({done: Math.min(i + chunk.length, payload.length), total: payload.length});
      }
      setOk(`นำเข้าสำเร็จ ${payload.length} แถว ✅`);
    } catch (e: any) {
      setErr(e.message || 'นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function doExport() {
    setExporting(true);
    setErr('');
    setOk('');
    try {
      const { data, error } = await supabase
        .from('products_public')
        .select('name, sku, category, cost_price, sale_price, image_url')
        .order('category', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true })
        .limit(50000);
      if (error) throw error;

      const csv = Papa.unparse(data || [], {
        columns: ['name','sku','category','cost_price','sale_price','image_url'],
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOk(`ส่งออก ${data?.length ?? 0} รายการเรียบร้อย ✅`);
    } catch (e: any) {
      setErr(e.message || 'ส่งออกไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition"
        >
          <span className="text-lg">🏠</span>
          <span className="text-sm font-medium">กลับหน้าหลัก</span>
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">นำเข้า / ส่งออก CSV</span>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        {/* Export */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">ส่งออกสินค้า</div>
              <div className="text-sm muted">ดาวน์โหลด CSV ของสินค้าทั้งหมด</div>
            </div>
            <button
              onClick={doExport}
              disabled={exporting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
            >
              {exporting ? 'กำลังส่งออก…' : '⬇️ ดาวน์โหลด CSV'}
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="card p-4 space-y-3">
          <div className="font-medium">นำเข้าสินค้า (CSV)</div>
          <div className="text-sm muted">
            รองรับหัวตาราง: <code>name, sku, category, cost_price, sale_price, image_url</code>
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onPickFile}
            className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:bg-zinc-100 file:border file:border-zinc-200 file:hover:bg-zinc-200 dark:file:bg-zinc-800 dark:file:border-zinc-700 dark:file:hover:bg-zinc-700"
          />

          {parseErr && <div className="text-sm text-rose-600 dark:text-rose-400">{parseErr}</div>}

          {headers.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs muted mb-1">ชื่อสินค้า (name) *</div>
                <select value={mapName} onChange={(e)=>setMapName(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
                  {headers.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs muted mb-1">SKU</div>
                <select value={mapSku} onChange={(e)=>setMapSku(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
                  <option value="">(ไม่มี)</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs muted mb-1">หมวดหมู่</div>
                <select value={mapCategory} onChange={(e)=>setMapCategory(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
                  <option value="">(ไม่มี)</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <div className="text-xs muted mb-1">ราคาทุน</div>
                <select value={mapCost} onChange={(e)=>setMapCost(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
                  <option value="">(ไม่มี)</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs muted mb-1">ราคาขาย</div>
                <select value={mapSale} onChange={(e)=>setMapSale(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
                  <option value="">(ไม่มี)</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs muted mb-1">ลิงก์รูป</div>
                <select value={mapImage} onChange={(e)=>setMapImage(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700">
                  <option value="">(ไม่มี)</option>
                  {headers.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    {headers.map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                  {preview.map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                      {headers.map(h => (
                        <td key={h} className="px-3 py-2">{r[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <div className="px-3 py-2 text-xs muted">แสดงตัวอย่าง 10 แถวแรก จากทั้งหมด {rows.length} แถว</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs muted">
              * การนำเข้าใช้ <b>upsert</b> ตาม SKU (ถ้าตั้ง unique index ที่ <code>products.sku</code>)<br/>
              ถ้าโปรเจกต์ของคุณไม่ได้ใช้ SKU เป็น unique — ให้เปลี่ยนเป็น <code>insert()</code> ในโค้ด
            </div>
            <button
              onClick={doImport}
              disabled={busy || !rows.length}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
            >
              {busy ? `กำลังนำเข้า… ${progress.done}/${progress.total}` : '⬆️ นำเข้าสินค้า'}
            </button>
          </div>

          {err && <div className="text-sm text-rose-600 dark:text-rose-400 mt-2">{err}</div>}
          {ok && <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">{ok}</div>}
        </div>
      </div>
    </div>
  );
}
