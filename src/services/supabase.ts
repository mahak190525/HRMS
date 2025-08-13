import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database helper functions
export const db = {
  // Users
  async getUser(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserByEmail(email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createUser(userData: any) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateUser(id: string, updates: any) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Leave Applications
  async getLeaveApplications(userId?: string) {
    let query = supabase
      .from('leave_applications')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createLeaveApplication(leaveData: any) {
    const { data, error } = await supabase
      .from('leave_applications')
      .insert(leaveData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Complaints
  async getComplaints(userId?: string) {
    let query = supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createComplaint(complaintData: any) {
    const { data, error } = await supabase
      .from('complaints')
      .insert(complaintData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Billing Records
  async getBillingRecords() {
    const { data, error } = await supabase
      .from('billing_records')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createBillingRecord(billingData: any) {
    const { data, error } = await supabase
      .from('billing_records')
      .insert(billingData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Invoices
  async getInvoices() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createInvoice(invoiceData: any) {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Candidates
  async getCandidates() {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createCandidate(candidateData: any) {
    const { data, error } = await supabase
      .from('candidates')
      .insert(candidateData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Referrals
  async getReferrals(userId?: string) {
    let query = supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('referred_by', userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createReferral(referralData: any) {
    const { data, error } = await supabase
      .from('referrals')
      .insert(referralData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Performance Goals
  async getPerformanceGoals(userId?: string) {
    let query = supabase
      .from('performance_goals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createPerformanceGoal(goalData: any) {
    const { data, error } = await supabase
      .from('performance_goals')
      .insert(goalData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};