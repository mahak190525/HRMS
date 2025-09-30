import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EmployeeFeedback {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  status: 'submitted' | 'noted' | 'resolved';
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_email?: string;
}

export interface CreateFeedbackData {
  title: string;
  description: string;
}

export function useMyFeedback() {
  const [feedback, setFeedback] = useState<EmployeeFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchMyFeedback = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_feedback')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyFeedback();
  }, [user?.id]);

  return {
    feedback,
    loading,
    error,
    refetch: fetchMyFeedback,
  };
}

export function useAllFeedback() {
  const [feedback, setFeedback] = useState<EmployeeFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllFeedback = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_feedback')
        .select(`
          *,
          employee:users!employee_feedback_employee_id_fkey(
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedFeedback = data?.map(item => ({
        ...item,
        employee_name: item.employee?.full_name || 'Unknown',
        employee_email: item.employee?.email || '',
      })) || [];

      setFeedback(formattedFeedback);
    } catch (err) {
      console.error('Error fetching all feedback:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllFeedback();
  }, []);

  return {
    feedback,
    loading,
    error,
    refetch: fetchAllFeedback,
  };
}

export function useCreateFeedback() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const createFeedback = async (data: CreateFeedbackData) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return false;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('employee_feedback')
        .insert([
          {
            employee_id: user.id,
            title: data.title,
            description: data.description,
          },
        ]);

      if (error) throw error;

      toast.success('Feedback submitted successfully');
      return true;
    } catch (err) {
      console.error('Error creating feedback:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createFeedback,
    loading,
  };
}

export function useUpdateFeedbackStatus() {
  const [loading, setLoading] = useState(false);

  const updateStatus = async (feedbackId: string, status: 'submitted' | 'noted' | 'resolved') => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('employee_feedback')
        .update({ status })
        .eq('id', feedbackId);

      if (error) throw error;

      toast.success('Feedback status updated successfully');
      return true;
    } catch (err) {
      console.error('Error updating feedback status:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    updateStatus,
    loading,
  };
}
