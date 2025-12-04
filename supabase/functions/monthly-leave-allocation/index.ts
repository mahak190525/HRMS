import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if cron should run by checking settings
    const { data: settings, error: settingsError } = await supabase
      .rpc('get_active_cron_settings');

    if (settingsError) {
      throw new Error(`Failed to get cron settings: ${settingsError.message}`);
    }

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No active cron settings found' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const activeSettings = settings[0];
    const currentDate = new Date();
    const endDate = new Date(activeSettings.end_date);

    // Check if end date has passed
    if (currentDate > endDate) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Cron job end date (${activeSettings.end_date}) has passed. Please update settings.` 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Check if cron is active
    if (!activeSettings.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Cron job is currently disabled' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Execute the monthly leave allocation function
    const { data: results, error: allocationError } = await supabase
      .rpc('allocate_monthly_leave');

    if (allocationError) {
      throw new Error(`Failed to allocate monthly leave: ${allocationError.message}`);
    }

    // Count successes and failures
    const successCount = results?.filter((r: any) => r.success).length || 0;
    const failureCount = results?.filter((r: any) => r.success === false).length || 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Monthly leave allocation completed. Success: ${successCount}, Failures: ${failureCount}`,
        results: results,
        settings: {
          end_date: activeSettings.end_date,
          last_run_at: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in monthly leave allocation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

