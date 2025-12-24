import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

export interface IndianBankDetails {
  account_name: string;
  bank_name: string;
  account_no: string;
  ifsc_code: string;
  gstin: string;
  pan: string;
  registration_number: string;
}

export interface IndianDeets {
  bank: IndianBankDetails;
  email: string;
}

export interface LLCACHDetails {
  bank_name: string;
  account_name: string;
  ach_routing_number: string;
  account_number: string;
}

export interface LLCWireDetails {
  bank_name: string;
  account_name: string;
  wire_routing_number: string;
  account_number: string;
  domestic_swift_code: string;
  foreign_swift_code: string;
}

export interface LLCDeets {
  ach: LLCACHDetails;
  wire: LLCWireDetails;
  email: string;
}

export interface AppConfig {
  id: number;
  indian_deets: IndianDeets;
  llc_deets: LLCDeets;
  created_at: string;
  updated_at: string;
}

// Fetch app configuration
export const useAppConfig = () => {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async (): Promise<AppConfig> => {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

// Update Indian details
export const useUpdateIndianDeets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (indianDeets: IndianDeets) => {
      const { data, error } = await supabase
        .from('app_config')
        .update({ indian_deets: indianDeets })
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      toast.success('Indian details updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update Indian details: ${error.message}`);
    },
  });
};

// Update LLC details
export const useUpdateLLCDeets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (llcDeets: LLCDeets) => {
      const { data, error } = await supabase
        .from('app_config')
        .update({ llc_deets: llcDeets })
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      toast.success('LLC details updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update LLC details: ${error.message}`);
    },
  });
};

// Update both configurations at once
export const useUpdateAppConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ indianDeets, llcDeets }: { indianDeets: IndianDeets; llcDeets: LLCDeets }) => {
      const { data, error } = await supabase
        .from('app_config')
        .update({ 
          indian_deets: indianDeets,
          llc_deets: llcDeets 
        })
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      toast.success('Configuration updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update configuration: ${error.message}`);
    },
  });
};
