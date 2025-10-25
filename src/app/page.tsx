'use client';
import { supabase } from '@/lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRole } from '@/lib/useRole';

type Stats = {
  products: number | null;
  lowStock: number | null;
  movementsToday: number | null;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const { role, canManage, loading } = useRole();
  const [stats, setStats] = useState<Stats>({
    products: null,
    lowStock: null,
    movementsToday: null,
  });
  const [statsErr, setStatsErr] = useState<string>('');

  // ------- Auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user ?? null),
    );
    return () => sub?.subscription.unsubscribe();
  }, []);

  // ------- Load dashboard stats
  useEffect(() => {
    if (!user) return;
    let aborted = false;

    async function loadStats() {
      setStatsErr('');

      // 1) จำนวนสินค้าทั้งหมด (จาก view products_public)
      const p = supabase
        .from('products_public')
        .select('id', { count: 'exact', head: true });

      // 2) สต็อกต่ำ (qty <= 5) — ควรมี index ที่ products.qty
      const low = supabase
        .from('products_public')
        .select('id', { count: 'exact', head: true })
        .lte('qty', 5);

      // 3) ความเคลื่อนไหววันนี้ (จาก movements view หรือ table จริง)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const isoStart = start.toISOString();

      const m = supabase
        .from('movements_public') // ถ้าไม่มี view ให้เปลี่ยนเป็น 'stock_movements'
        .select('product_id', { count: 'exact', head: true })
        .gte('created_at', isoStart);

      const [pRes, lowRes, mRes] = await Promise.allSettled([p, low, m]);

      const products =
        pRes.status === 'fulfilled' && !pRes.value.error ? pRes.value.count ?? 0 : null;
      const lowStock =
        lowRes.status === 'fulfilled' && !lowRes.value.error ? lowRes.value.count ?? 0 : null;
      const movementsToday =
        mRes.status === 'fulfilled' && !mRes.value.error ? mRes.value.count ?? 0 : null;

      if (!aborted) {
        setStats({ products, lowStock, movementsToday });
        const anyErr =
          (pRes.status === 'fulfilled' && pRes.value.error?.message) ||
          (lowRes.status === 'fulfilled' && lowRes.value.error?.message) ||
          (mRes.status === 'fulfilled' && mRes.value.error?.message) ||
          (pRes.status === 'rejected' && pRes.reason?.message) ||
          (lowRes.status === 'rejected' && lowRes.reason?.message) ||
          (mRes.status === 'rejected' && mRes.reason?.message) ||
          '';
        setStatsErr(String(anyErr || ''));
      }
    }

    loadStats();
    // อัปเดตสถิติทุก 60 วินาที (เบา ๆ)
    const t = setInterval(loadStats, 60_000);
    return () => {
      aborted = true;
      clearInterval(t);
    };
  }, [user]);

  // 🔒 หน้า Login
  if (!user) {
    return (
      <div className="space-y-5 text-center mt-10">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบเพื่อใช้งาน</h1>
        <div className="card max-w-sm mx-auto p-4">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb',        // blue-600
                    brandAccent: '#1d4ed8',  // blue-700
                    inputBorder: '#3f3f46',
                    inputText: '#e5e7eb',
                  },
                },
              },
              className: { container: 'text-left' },
            }}
            providers={[]}
          />
        </div>
        <p className="text-xs muted">
          ใช้อีเมลและรหัสผ่านที่สมัครใน Supabase เพื่อเข้าสู่ระบบ
        </p>
      </div>
    );
  }

  // 🏠 หน้า Dashboard หลังล็อกอิน
  return (
    <div className="space-y-6 mt-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold">ระบบเช็กสินค้า</h1>
        <p className="text-sm muted">
          ยินดีต้อนรับ, <b>{user.email}</b>
          {loading ? null : role ? (
            <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">
              ({role})
            </span>
          ) : null}
        </p>
      </div>

      {/* แถวสรุปสถิติ */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/products" className="card card-hover p-3">
          <div className="text-xs muted">สินค้าทั้งหมด</div>
          <div className="text-2xl font-semibold mt-1">
            {stats.products ?? '—'}
          </div>
        </Link>
        <Link href="/products?filter=low" className="card card-hover p-3">
          <div className="text-xs muted">สต็อกต่ำ (≤5)</div>
          <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">
            {stats.lowStock ?? '—'}
          </div>
        </Link>
        <Link href="/movements" className="card card-hover p-3">
          <div className="text-xs muted">ความเคลื่อนไหววันนี้</div>
          <div className="text-2xl font-semibold mt-1">
            {stats.movementsToday ?? '—'}
          </div>
        </Link>
      </div>
      {statsErr ? (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          หมายเหตุ: โหลดสถิติบางส่วนไม่สำเร็จ — {statsErr}
        </div>
      ) : null}

      {/* เมนูหลัก */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/products" className="card card-hover">
          <div className="text-center py-6">
            <div className="text-3xl mb-2">📦</div>
            <div className="font-medium">รายการสินค้า</div>
            <div className="text-xs muted mt-1">ดู/แก้ไขสินค้าในคลัง</div>
          </div>
        </Link>

        <Link href="/products/new" className="card card-hover">
          <div className="text-center py-6">
            <div className="text-3xl mb-2">➕</div>
            <div className="font-medium">เพิ่มสินค้าใหม่</div>
            <div className="text-xs muted mt-1">บันทึกสินค้าใหม่เข้าระบบ</div>
          </div>
        </Link>

        <Link href="/movements" className="card card-hover">
          <div className="text-center py-6">
            <div className="text-3xl mb-2">📊</div>
            <div className="font-medium">ประวัติสต็อก</div>
            <div className="text-xs muted mt-1">ดูรายการรับเข้า / ขายออก</div>
          </div>
        </Link>

        <button onClick={() => supabase.auth.signOut()} className="card card-hover">
          <div className="text-center py-6">
            <div className="text-3xl mb-2">🚪</div>
            <div className="font-medium text-red-600 dark:text-red-400">
              ออกจากระบบ
            </div>
            <div className="text-xs muted mt-1">Logout</div>
          </div>
        </button>
      </div>

      {/* เมนู Admin: แสดงเฉพาะ MANAGER/OWNER */}
      {!loading && canManage && (
        <>
          <div className="text-sm muted px-1">เมนูผู้ดูแลระบบ</div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/admin/import-export" className="card card-hover">
              <div className="text-center py-6">
                <div className="text-3xl mb-2">⬇️⬆️</div>
                <div className="font-medium">นำเข้า / ส่งออก CSV</div>
                <div className="text-xs muted mt-1">จัดการข้อมูลจำนวนมาก</div>
              </div>
            </Link>

            <Link href="/admin/users" className="card card-hover">
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🧑‍🤝‍🧑</div>
                <div className="font-medium">จัดการผู้ใช้</div>
                <div className="text-xs muted mt-1">
                  ตั้งสิทธิ์ OWNER / MANAGER / STAFF
                </div>
              </div>
            </Link>
          </div>
        </>
      )}

      <footer className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-6">
        © {new Date().getFullYear()} PeakWorldToy Stock Checker
      </footer>
    </div>
  );
}
