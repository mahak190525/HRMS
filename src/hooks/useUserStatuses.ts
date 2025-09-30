import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';

type UserStatusRow = {
  id: string;
  status?: string | null;
};

export function useUserStatuses(userIds: string[] | undefined) {
  const [data, setData] = useState<Record<string, UserStatusRow>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const uniqueIds = useMemo(() => {
    return Array.from(new Set((userIds || []).filter(Boolean)));
  }, [JSON.stringify(userIds || [])]);

  useEffect(() => {
    let cancelled = false;
    const fetchStatuses = async () => {
      if (!uniqueIds.length) {
        setData({});
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data: rows, error: err } = await supabase
          .from('users')
          .select('id, status')
          .in('id', uniqueIds);
        if (err) throw err;
        if (cancelled) return;
        const map: Record<string, UserStatusRow> = {};
        (rows || []).forEach((r: any) => { map[r.id] = r; });
        setData(map);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchStatuses();
    return () => { cancelled = true; };
  }, [JSON.stringify(uniqueIds)]);

  return { data, isLoading, error } as const;
}


