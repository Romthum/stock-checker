'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRole } from '@/lib/useRole';

type Row = {
  name: string;
  sku?: string;
  cost_price?: number;
  sale_price?: number;
  qty?: number;
  category?: string;
  image_url?: string;
};

export default function ImportExportPage() {
  const { canManage, loading } = useRole();
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(()=>{ load(); },[]);
  async function load(){
    const { data, error } = await supabase.from('products_public').select('*').order('updated_at', {ascending:false});
    if (error) { setMsg(error.message); return; }
    setItems(data ?? []);
  }

  if (loading) return <div className="p-4">กำลังโหลดสิทธิ์…</div>;
  if (!canManage) return <div className="p-4">เฉพาะ MANAGER/OWNER เท่านั้น</div>;

  function toCSV(rows:any[]){
    const headers = ['name','sku','cost_price','sale_price','qty','category','image_url'];
    const escape = (v:any)=> `"${String(v??'').replace(/"/g,'""')}"`;
    const lines = [headers.join(',')].concat(
      rows.map(r => headers.map(h => escape(r[h])).join(','))
    );
    return lines.join('\n');
  }

  function downloadCSV(){
    const csv = toCSV(items);
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0]; if (!file) return;
    setMsg('กำลังอ่านไฟล์…');
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { setMsg('ไฟล์ว่างหรือคอลัมน์ไม่ครบ'); return; }

    // upsert ตาม SKU (ต้อง unique ในตาราง)
    const payload = rows.map(r => ({
      name: r.name,
      sku: r.sku || null,
      cost_price: Number(r.cost_price || 0),
      sale_price: Number(r.sale_price || 0),
      qty: Number(r.qty || 0),
      category: r.category || null,
      image_url: r.image_url || null,
    }));

    const { error } = await supabase.from('products').upsert(payload, { onConflict: 'sku' });
    if (error) setMsg('นำเข้าไม่สำเร็จ: ' + error.message);
    else { setMsg(`นำเข้าสำเร็จ ${payload.length} แถว`); load(); }
    e.currentTarget.value = '';
  }

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100">
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button onClick={()=>window.history.back()} className="text-zinc-300 hover:text-white">⬅️ กลับ</button>
        <span className="text-xs text-zinc-500">Import / Export</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="text-lg font-semibold mb-2">ส่งออกสินค้า (CSV)</div>
          <button className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2" onClick={downloadCSV}>⬇️ ดาวน์โหลด CSV</button>
          <div className="text-xs text-zinc-400 mt-2">
            คอลัมน์: name, sku, cost_price, sale_price, qty, category, image_url
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="text-lg font-semibold mb-2">นำเข้าสินค้า (CSV)</div>
          <input type="file" accept=".csv" onChange={handleImport} className="block" />
          <div className="text-xs text-zinc-400 mt-2">
            ต้องมีคอลัมน์อย่างน้อย: name, sku
          </div>
        </div>

        {msg && <div className="text-sm text-zinc-300">{msg}</div>}
      </div>
    </div>
  );
}

/** parser ง่าย ๆ รองรับ header */
function parseCSV(text:string): Row[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const rows: Row[] = [];
  for (let i=1;i<lines.length;i++){
    const cols = splitCSVLine(lines[i]);
    const obj:any = {};
    headers.forEach((h,idx)=>obj[h]=cols[idx]);
    if (obj.name) rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line:string){
  const out:string[]=[]; let cur=''; let inQ=false;
  for (let i=0;i<line.length;i++){
    const c=line[i];
    if (c==='"' ){ if (inQ && line[i+1]==='"'){ cur+='"'; i++; } else { inQ=!inQ; } }
    else if (c===',' && !inQ){ out.push(cur); cur=''; }
    else { cur+=c; }
  }
  out.push(cur);
  return out.map(s=>s.replace(/^"|"$/g,''));
}
