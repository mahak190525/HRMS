import { supabase } from './supabase';

interface QueuedEmail {
  queue_id: string;
  module_type: string;
  reference_id: string;
  email_type: string;
  subject: string;
  priority: string;
  recipients: {
    to: Array<{ email: string; name: string }>;
    cc_static?: Array<{ email: string; name: string }>;
    cc_dynamic_resolved?: Array<{ email: string; name: string }>;
  };
  email_data: {
    // Leave-specific fields
    employee_name?: string;
    employee_email?: string;
    leave_type?: string;
    start_date?: string;
    end_date?: string;
    days_count?: number;
    approver_name?: string;
    approver_title?: string;
    comments?: string;
    user_id?: string;
    // Policy-specific fields
    policy_count?: number;
    assigned_by_name?: string;
    assigned_at?: string;
    policy_names?: string[];
    // Performance-specific fields
    kra_title?: string;
    manager_name?: string;
    // Generic fields
    [key: string]: any;
  };
  scheduled_at: string;
  retry_count: number;
}

class EmailQueueService {
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;

  /**
   * Start processing the email queue periodically
   */
  startQueueProcessor(intervalMs: number = 10000) { // Check every 10 seconds
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    // Process immediately
    this.processQueue();
  }

  /**
   * Stop the queue processor
   */
  stopQueueProcessor() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Process pending emails in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;

    try {
      console.log('🔄 Calling edge function to process email queue...');
      
      // Call the edge function's process-queue endpoint directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email/process-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`❌ Edge function returned ${response.status}:`, data);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        return;
      }

      if (data?.success) {
        console.log(`✅ Edge function processed ${data.processed || 0} emails`);
      } else {
        console.error('⚠️ Edge function failed:', data);
      }

    } catch (error) {
      console.error('❌ Failed to call edge function for queue processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // OLD METHOD REMOVED: processQueuedEmail is no longer needed
  // All email processing is now handled by the edge function via /process-queue endpoint

  /**
   * Mark an email as processed in the database
   */
  private async markEmailProcessed(
    queueId: string, 
    success: boolean, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('mark_email_processed', {
        p_queue_id: queueId,
        p_success: success,
        p_error_message: errorMessage || null,
        p_error_details: errorMessage ? { message: errorMessage } : null
      });

      if (error) {
        console.error('Failed to mark email as processed:', error);
      }
    } catch (error) {
      console.error('Error marking email as processed:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('status');

      if (error) throw error;

      const stats = { pending: 0, sent: 0, failed: 0 };
      
      data?.forEach((item: any) => {
        if (item.status === 'pending') stats.pending++;
        else if (item.status === 'sent') stats.sent++;
        else if (item.status === 'failed') stats.failed++;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return { pending: 0, sent: 0, failed: 0 };
    }
  }

  /**
   * Manually trigger queue processing (for testing)
   */
  async triggerProcessing(): Promise<void> {
    await this.processQueue();
  }
}

export const emailQueueService = new EmailQueueService();
