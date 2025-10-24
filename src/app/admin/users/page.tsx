'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRole } from '@/lib/useRole';

type Profile = { id: string; display_name: string|null; role: 'OWNER'|'MANAGER'|'STAFF'; email?: string };

export default function UsersPage() {
  const { canManage, role, loading } = useRole();
  const [rows, setRows] = useState<Profile[]>([]);
  const [msg, setMsg] = useState('');

  // เชิญผู้ใช้ (จากเวอร์ชันก่อน)
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<'STAFF'|'MANAGER'|'OWNER'>('STAFF');
  const [inviting, setInviting] = useState(false);
  const [tempPass, setTempPass] = useState<string|undefined>(undefined);

  // รีเซ็ต/ลบ
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);

  useEffect(()=>{ load(); },[]);
  async function load(){
    setMsg('');
    // ดึง role + แสดงอีเมล (ดึงจาก auth.users ผ่าน view ของคุณ หรือเก็บลง profiles.display_name)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role')
      .order('created_at', {ascending:false});
    if (error) setMsg(error.message); else setRows((data as any)??[]);
  }

  async function updateRole(id:string, newRole:Profile['role']){
    setMsg('');
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    if (error) setMsg(error.message); else { setMsg('อัปเดตสำเร็จ'); load(); }
  }

  async function invite() {
    setMsg('');
    setTempPass(undefined);
    if (!email) { setMsg('กรุณากรอกอีเมล'); return; }
    setInviting(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'เชิญไม่สำเร็จ');

      if (json.method === 'invite') {
        setMsg(`ส่งคำเชิญไปที่ ${json.email} แล้ว`);
      } else if (json.method === 'create') {
        setMsg(`สร้างผู้ใช้ ${json.email} สำเร็จ`);
        setTempPass(json.tempPassword);
      }
      setEmail('');
      load();
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setInviting(false);
    }
  }

  async function doReset(email: string) {
    setMsg('');
    setRecoveryLink(null);
    setBusyId(email);
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'รีเซ็ตไม่สำเร็จ');
      if (json.action_link) {
        setRecoveryLink(json.action_link);
        setMsg('สร้างลิงก์รีเซ็ตสำเร็จ (คัดลอกส่งให้ผู้ใช้)');
      } else {
        setMsg('ส่งอีเมลรีเซ็ตสำเร็จ');
      }
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function doDelete(targetUserId: string) {
    setMsg('');
    if (!confirm('ยืนยันลบบัญชีผู้ใช้นี้?')) return;
    setBusyId(targetUserId);
    try {
      // หา actorUserId ปัจจุบัน
      const { data } = await supabase.auth.getUser();
      const actorUserId = data.user?.id;
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ targetUserId, actorUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      setMsg('ลบผู้ใช้สำเร็จ');
      load();
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="p-4">กำลังโหลดสิทธิ์…</div>;
  if (!canManage) return <div className="p-4">เฉพาะ MANAGER/OWNER เท่านั้น</div>;

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100">
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <button onClick={()=>window.history.back()} className="text-zinc-300 hover:text-white">⬅️ กลับ</button>
        <span className="text-xs text-zinc-500">จัดการผู้ใช้</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm">
          สิทธิ์ปัจจุบันของคุณ: <b>{role}</b>
        </div>

        {/* เชิญผู้ใช้ */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
          <div className="text-lg font-semibold">เชิญผู้ใช้ใหม่</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="email"
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
              placeholder="อีเมลผู้ใช้ เช่น staff@example.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />
            <select
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
              value={newRole}
              onChange={(e)=>setNewRole(e.target.value as any)}
            >
              <option value="STAFF">STAFF</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OWNER">OWNER</option>
            </select>
            <button
              onClick={invite}
              disabled={inviting}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 disabled:opacity-60"
            >
              {inviting ? 'กำลังเชิญ…' : 'เชิญ'}
            </button>
          </div>
          {msg && <div className="text-sm text-zinc-300">{msg}</div>}
          {recoveryLink && (
            <div className="text-sm text-amber-300 break-all">
              ลิงก์รีเซ็ตรหัส (คัดลอกไปส่งให้ผู้ใช้): <br />
              <a className="underline" href={recoveryLink}>{recoveryLink}</a>
            </div>
          )}
          {tempPass && (
            <div className="text-sm text-amber-300">
              รหัสผ่านชั่วคราว: <b>{tempPass}</b>
            </div>
          )}
        </div>

        {/* ตารางผู้ใช้ */}
        <div className="rounded-xl overflow-hidden border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="text-left px-3 py-2">ผู้ใช้</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-right px-3 py-2">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {rows.map(u => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.display_name ?? u.id.slice(0,8)}</td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1"
                      value={u.role}
                      onChange={e=>updateRole(u.id, e.target.value as any)}
                    >
                      <option value="STAFF">STAFF</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="OWNER">OWNER</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1"
                        onClick={() => {
                          // ถ้าเก็บอีเมลไว้ใน profiles.display_name
                          const email = u.display_name || '';
                          if (!email || !email.includes('@')) {
                            setMsg('ไม่พบอีเมลในโปรไฟล์ของผู้ใช้นี้ (ต้องเชิญใหม่เพื่อกรอกอีเมล)');
                            return;
                          }
                          doReset(email);
                        }}
                        disabled={busyId === (u.display_name || '')}
                      >
                        รีเซ็ตรหัส
                      </button>
                      <button
                        className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1"
                        onClick={() => doDelete(u.id)}
                        disabled={busyId === u.id}
                      >
                        ลบผู้ใช้
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-3 py-8 text-center text-zinc-500" colSpan={3}>
                    ยังไม่มีผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
