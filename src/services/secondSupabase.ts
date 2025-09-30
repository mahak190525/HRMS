import { createClient } from '@supabase/supabase-js';

const secondSupabaseUrl = import.meta.env.VITE_SECOND_SUPABASE_URL;
const secondSupabaseAnonKey = import.meta.env.VITE_SECOND_SUPABASE_ANON_KEY;

if (!secondSupabaseUrl || !secondSupabaseAnonKey) {
  throw new Error('Missing second Supabase environment variables');
}

export const secondSupabase = createClient(secondSupabaseUrl, secondSupabaseAnonKey);
