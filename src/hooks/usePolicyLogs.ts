import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

export interface PolicyActivityLog {
  id: string;
  policy_id: string;
  user_id?: string;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  policy_name: string;
  policy_version?: number;
  changes?: {
    action_type?: string;
    name?: { from: string; to: string };
    version?: { from: number; to: number };
    content?: {
      content_changed: boolean;
      old_length: number;
      new_length: number;
      size_change: number;
      old_preview?: string;
      new_preview?: string;
      preview_type?: 'full';
    };
    is_active?: { from: boolean; to: boolean };
    policy_name?: string;
    content_length?: number;
    final_version?: number;
    was_active?: boolean;
    previous_status?: boolean;
    new_status?: boolean;
  };
  created_at: string;
  user_full_name?: string;
  user_email?: string;
}

export interface PolicyActivityStats {
  total_activities: number;
  creates: number;
  updates: number;
  deletes: number;
  activations: number;
  deactivations: number;
  recent_activity_count: number;
}

export interface PolicyLogsFilters {
  policy_id?: string;
  user_id?: string;
  action?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

export function usePolicyLogs(filters?: PolicyLogsFilters) {
  const [logs, setLogs] = useState<PolicyActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchLogs = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 0 : page;
      const offset = currentPage * pageSize;

      const { data, error } = await supabase.rpc('get_policy_activity_logs', {
        p_policy_id: filters?.policy_id || null,
        p_user_id: filters?.user_id || null,
        p_action: filters?.action || null,
        p_limit: pageSize,
        p_offset: offset
      });

      if (error) throw error;

      const newLogs = data || [];
      
      if (reset) {
        setLogs(newLogs);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }

      setHasMore(newLogs.length === pageSize);
      if (!reset) {
        setPage(prev => prev + 1);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch policy logs';
      setError(errorMessage);
      console.error('Error fetching policy logs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchLogs(false);
    }
  }, [fetchLogs, loading, hasMore]);

  const refresh = useCallback(() => {
    setPage(0);
    fetchLogs(true);
  }, [fetchLogs]);

  useEffect(() => {
    refresh();
  }, [filters]);

  return {
    logs,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
}

export function usePolicyActivityStats() {
  const [stats, setStats] = useState<PolicyActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_policy_activity_stats');

      if (error) throw error;

      if (data && data.length > 0) {
        setStats({
          total_activities: Number(data[0].total_activities),
          creates: Number(data[0].creates),
          updates: Number(data[0].updates),
          deletes: Number(data[0].deletes),
          activations: Number(data[0].activations),
          deactivations: Number(data[0].deactivations),
          recent_activity_count: Number(data[0].recent_activity_count)
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch policy activity stats';
      setError(errorMessage);
      console.error('Error fetching policy activity stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats
  };
}

export default usePolicyLogs;
