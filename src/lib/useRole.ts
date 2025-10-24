'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export type Role = 'OWNER'|'MANAGER'|'STAFF'|null;

export function useRole() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) { setRole(null); setLoading(false); return; }
      const r = await supabase.from('profiles').select('role').eq('id', u.id).single();
      setRole((r.data?.role as any) ?? 'STAFF');
      setLoading(false);
    })();
  }, []);
  const canManage = role === 'MANAGER' || role === 'OWNER';
  return { role, canManage, loading };
}
