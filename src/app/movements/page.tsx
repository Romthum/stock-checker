'use client';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useState } from 'react';

type Movement = {
  id: string;
  change: number;
  reason: 'RESTOCK'|'SALE'|'ADJUST';
  created_at: string;
  product: { name: string; sku: string | null } | null;
};

type RangeKey = 'today' | '7d' | '30d' | 'custom';

export default function MovementsPage() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // ฟิลเตอร์ช่วงเวลา
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  // คำนวณช่วงเวลาตามปุ่มลัด
  const computedRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (rangeKey === 'today') {
      start.setHours(0,0,0,0);
    } else if (rangeKey === '7d') {
      start.setDate(end.getDate() - 7);
      start.setHours(0,0,0,0);
    } else if (rangeKey === '30d') {
      start.setDate(end.getDate() - 30);
      start.setHours(0,0,0,0);
    } else { // custom
      if (from) start.setTime(new Date(from + 'T00:00:00').getTime());
      if (to)   end.setTime(new Date(to + 'T23:59:59').getTime());
    }
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      start,
      end,
    };
  }, [rangeKey, from, to]);

  async function load() {
    setErr('');
    setLoading(true);
    const { startISO, endISO } = computedRange;

    const { data, error } = await supabase
      .from('stock_movements')
      .select('id, change, reason, created_at, product:products(name, sku)')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) setErr(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedRange.startISO, computedRange.endISO]);

  // ---------- สรุปสถิติ ----------
  const stats = useMemo(() => {
    const total = rows.length;
    let restock = 0, sale = 0, adjust = 0, net = 0;
    const hit: Record<string, number> = {};
    for (const r of rows) {
      net += r.change;
      if (r.reason === 'RESTOCK') restock += r.change;
      else if (r.reason === 'SALE') sale += Math.abs(r.change);
      else adjust += r.change;
      const key = r.product?.name ?? 'ไม่ทราบสินค้า';
      hit[key] = (hit[key] ?? 0) + Math.abs(r.change);
    }
    // สินค้าที่ถูกเคลื่อนไหวมากสุด
    let topName = '-', topVal = 0;
    for (const [name, val] of Object.entries(hit)) {
      if (val > topVal) { topVal = val; topName = name; }
    }
    return { total, restock, sale, adjust, net, topName, topVal };
  }, [rows]);

  function fmtDate(ts: string) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100">
      {/* Header + Back */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition"
        >
          <span className="text-lg">🏠</span>
          <span className="text-sm font-medium">กลับหน้าหลัก</span>
        </button>
        <span className="text-xs text-zinc-500">ประวัติการขยับสต็อก</span>
      </div>

      {/* Filters */}
      <div className="px-3 pt-3">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm border ${rangeKey==='today'?'bg-blue-600 text-white border-transparent':'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'}`}
              onClick={() => setRangeKey('today')}
            >วันนี้</button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm border ${rangeKey==='7d'?'bg-blue-600 text-white border-transparent':'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'}`}
              onClick={() => setRangeKey('7d')}
            >7 วัน</button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm border ${rangeKey==='30d'?'bg-blue-600 text-white border-transparent':'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'}`}
              onClick={() => setRangeKey('30d')}
            >30 วัน</button>

            <div className="h-6 w-px bg-zinc-800 mx-1" />

            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">จาก</label>
              <input
                type="date"
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm"
                value={from}
                onChange={(e)=>{ setFrom(e.target.value); setRangeKey('custom'); }}
              />
              <label className="text-xs text-zinc-400">ถึง</label>
              <input
                type="date"
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-sm"
                value={to}
                onChange={(e)=>{ setTo(e.target.value); setRangeKey('custom'); }}
              />
              <button
                className="px-3 py-1.5 rounded-lg text-sm bg-zinc-700 hover:bg-zinc-600"
                onClick={load}
              >แสดงผล</button>
            </div>
          </div>
          <div className="text-xs text-zinc-400 mt-2">
            ช่วงที่เลือก: {computedRange.start.toLocaleString()} – {computedRange.end.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 px-3 pt-3">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">จำนวนรายการ</div>
          <div className="text-2xl font-semibold mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">รับเข้า</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-400">+{stats.restock}</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">ขายออก</div>
          <div className="text-2xl font-semibold mt-1 text-rose-400">-{stats.sale}</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400">ยอดสุทธิ</div>
          <div className={`text-2xl font-semibold mt-1 ${stats.net>=0?'text-emerald-400':'text-rose-400'}`}>
            {stats.net>=0?'+':''}{stats.net}
          </div>
        </div>
      </div>

      {/* Top moved */}
      <div className="px-3 pt-1">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400 mb-1">สินค้าที่เคลื่อนไหวมากสุด</div>
          <div className="text-sm">{stats.topName}</div>
          <div className="text-xs text-zinc-500">รวม {stats.topVal} ชิ้น</div>
        </div>
      </div>

      {/* Table */}
      <div className="px-3 py-4">
        <div className="rounded-xl overflow-hidden border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="text-left px-3 py-2">สินค้า</th>
                <th className="text-left px-3 py-2">บาร์โค้ด</th>
                <th className="text-right px-3 py-2">เปลี่ยน</th>
                <th className="text-left px-3 py-2">เหตุผล</th>
                <th className="text-left px-3 py-2">เวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {loading && (
                <tr><td className="px-3 py-6 text-center text-zinc-400" colSpan={5}>กำลังโหลด…</td></tr>
              )}
              {!loading && rows.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-900/60">
                  <td className="px-3 py-2">{m.product?.name ?? '-'}</td>
                  <td className="px-3 py-2 text-zinc-400">{m.product?.sku ?? '-'}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${m.change>=0?'text-emerald-400':'text-rose-400'}`}>
                    {m.change>0?`+${m.change}`:m.change}
                  </td>
                  <td className="px-3 py-2">
                    {m.reason === 'RESTOCK' ? 'รับเข้า' : m.reason === 'SALE' ? 'ขาย' : 'ปรับแก้'}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{fmtDate(m.created_at)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td className="px-3 py-10 text-center text-zinc-500" colSpan={5}>ยังไม่มีรายการในช่วงเวลานี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {err && <div className="px-3 pb-4 text-sm text-red-400">{err}</div>}
    </div>
  );
}
