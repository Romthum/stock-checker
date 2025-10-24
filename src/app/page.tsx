'use client';
import { supabase } from '@/lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRole } from '@/lib/useRole';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const { role, canManage, loading } = useRole();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user ?? null),
    );
    return () => sub?.subscription.unsubscribe();
  }, []);

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
              className: {
                container: 'text-left',
              },
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

        <button
          onClick={() => supabase.auth.signOut()}
          className="card card-hover"
        >
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
