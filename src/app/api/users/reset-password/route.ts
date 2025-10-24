import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'ต้องระบุ email' }, { status: 400 });

    // ถ้าตั้ง SMTP แล้ว Supabase จะส่งเมลให้อัตโนมัติผ่าน generateLink(type:'recovery')
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: siteUrl }, // กลับหน้าแอปหลังรีเซ็ต
    });
    if (error) throw error;

    // ถ้ายังไม่ตั้งอีเมล ระบบก็จะ "ไม่ส่งอีเมล" แต่เราจะได้ action_link มาให้คัดลอก
    return NextResponse.json({
      ok: true,
      mode: data.properties?.email_otp ? 'email' : 'manual',
      action_link: (data as any)?.action_link, // อาจเป็น undefined ถ้าโหมดอีเมล
      message:
        (data as any)?.action_link
          ? 'คัดลอกลิงก์นี้แล้วส่งให้ผู้ใช้เพื่อรีเซ็ตรหัสผ่าน'
          : 'ถ้าตั้ง SMTP แล้ว ระบบจะส่งอีเมลให้ผู้ใช้อัตโนมัติ',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'reset failed' }, { status: 500 });
  }
}
