import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** helper: หา user จากอีเมล */
async function findUserByEmail(email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

export async function POST(req: Request) {
  try {
    const { email, role }: { email: string; role: 'STAFF' | 'MANAGER' | 'OWNER' } = await req.json();
    if (!email || !role)
      return NextResponse.json({ error: 'ต้องระบุ email และ role' }, { status: 400 });

    console.log('[INVITE] เริ่มทำงานสำหรับ', email);

    // 🔹 1. ตรวจว่ามีผู้ใช้อยู่แล้วไหม
    const existing = await findUserByEmail(email);
    if (existing) {
      console.log('[INVITE] พบผู้ใช้เดิม, อัปเดต role แล้วสร้างลิงก์รีเซ็ต');
      await admin.from('profiles').upsert({
        id: existing.id,
        display_name: email,
        role,
      });

      // ลิงก์รีเซ็ตรหัส (เผื่อใช้ส่งให้ผู้ใช้)
      const { data: recData, error: recErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: siteUrl },
      });
      if (recErr) console.error('Generate recovery link error:', recErr);

      return NextResponse.json({
        ok: true,
        status: 'user_exists',
        email,
        note: 'อัปเดต role ให้เรียบร้อยแล้ว',
        recovery_link: (recData as any)?.action_link ?? null,
      });
    }

    // 🔹 2. พยายามเชิญทางอีเมล (ถ้ามี SMTP)
    try {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        { redirectTo: siteUrl }
      );
      if (!inviteError && inviteData?.user) {
        const user = inviteData.user;
        await admin.from('profiles').upsert({
          id: user.id,
          display_name: email,
          role,
        });
        return NextResponse.json({ ok: true, method: 'invite', email });
      }
      if (inviteError) console.warn('[INVITE] inviteUserByEmail error:', inviteError);
    } catch (e) {
      console.warn('[INVITE] SMTP invite ล้มเหลว, ใช้ fallback แทน');
    }

    // 🔹 3. ถ้าไม่มี SMTP → ใช้ signup link + รหัสชั่วคราว
    const tempPassword = 'Temp@' + Math.random().toString(36).slice(2, 10);
    const { data: signLink, error: signErr } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password: tempPassword,
      options: { redirectTo: siteUrl },
    });
    if (signErr) throw signErr;

    // อัปเดต profiles
    if ((signLink as any)?.user?.id) {
      await admin.from('profiles').upsert({
        id: (signLink as any).user.id,
        display_name: email,
        role,
      });
    }

    console.log('[INVITE] signup link สร้างสำเร็จ');
    return NextResponse.json({
      ok: true,
      method: 'signup_link',
      email,
      signup_link: (signLink as any)?.action_link ?? null,
      tempPassword,
      note: 'โปรเจกต์ยังไม่ตั้ง SMTP ใช้ลิงก์นี้ให้ผู้ใช้สมัครและเข้าสู่ระบบด้วยรหัสชั่วคราว',
    });
  } catch (err: any) {
    console.error('[INVITE ERROR]', err);
    // ✅ กัน response ว่าง (จะส่ง JSON เสมอ)
    return NextResponse.json(
      { error: err.message || 'invite failed', detail: JSON.stringify(err, null, 2) },
      { status: 500 }
    );
  }
}
