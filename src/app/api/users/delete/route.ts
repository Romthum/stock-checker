import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { targetUserId, actorUserId } = await req.json();
    if (!targetUserId || !actorUserId)
      return NextResponse.json({ error: 'ต้องระบุ targetUserId และ actorUserId' }, { status: 400 });

    if (targetUserId === actorUserId) {
      return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 });
    }

    // เช็กว่า target เป็น OWNER หรือไม่
    const { data: targetProfile, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single();
    if (profErr) throw profErr;

    // ถ้าเป็น OWNER เช็กว่าเหลือ OWNER อย่างน้อย 2 คนไหม
    if (targetProfile?.role === 'OWNER') {
      const { count, error: countErr } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'OWNER');
      if (countErr) throw countErr;
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'ไม่สามารถลบ OWNER คนสุดท้ายได้' }, { status: 400 });
      }
    }

    // ลบ auth user ก่อน (จะทำให้โทเค็นหมดอายุ)
    const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
    if (delErr) throw delErr;

    // ลบ/ทำเครื่องหมายในโปรไฟล์ (จะลบจริงหรือเก็บ log ก็ได้)
    await admin.from('profiles').delete().eq('id', targetUserId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'delete failed' }, { status: 500 });
  }
}
