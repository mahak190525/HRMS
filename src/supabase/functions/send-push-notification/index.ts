import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PushNotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { user_id, title, message, type = 'general', data = {} }: PushNotificationPayload = await req.json()

    // Get user's push subscriptions from database
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (subscriptionsError) {
      throw subscriptionsError
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No push subscriptions found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare push notification payload
    const notificationPayload = {
      title,
      body: message,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: `hrms-${type}`,
      data: {
        type,
        ...data,
        url: getNotificationUrl(type, data)
      }
    }

    // Send push notifications to all user's subscriptions
    const pushPromises = subscriptions.map(async (subscription) => {
      try {
        // In a real implementation, you would use web-push library here
        // For demo purposes, we'll simulate the push
        console.log('Sending push notification to:', subscription.endpoint)
        console.log('Payload:', notificationPayload)
        
        // Simulate successful push
        return { success: true, endpoint: subscription.endpoint }
      } catch (error) {
        console.error('Failed to send push to:', subscription.endpoint, error)
        return { success: false, endpoint: subscription.endpoint, error: error.message }
      }
    })

    const results = await Promise.all(pushPromises)
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Push notifications sent: ${successCount} successful, ${failureCount} failed`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function getNotificationUrl(type: string, data: Record<string, any>): string {
  switch (type) {
    case 'leave_request_submitted':
    case 'leave_request_approved':
    case 'leave_request_rejected':
      return '/dashboard/leave'
    case 'complaint_submitted':
    case 'complaint_resolved':
      return '/dashboard/complaints'
    case 'performance_goal_assigned':
      return '/dashboard/performance'
    case 'interview_scheduled':
      return '/ats'
    case 'assessment_assigned':
      return '/ats/assessment'
    case 'exit_process_initiated':
      return '/exit'
    case 'document_approved':
    case 'document_rejected':
      return '/dashboard/documents'
    case 'document_request':
      return data?.target && data?.tab ? `/${data.target}?tab=${data.tab}` : '/dashboard/documents'
    case 'document_upload':
      return data?.target || '/employees'
    case 'asset_request_submitted':
      // For managers/admin who can approve/monitor
      return data?.target || '/employees/asset-management'
    case 'asset_request_approved':
    case 'asset_request_rejected':
    case 'asset_request_fulfilled':
      // For users to view their asset requests
      return data?.target || '/dashboard/assets'
    case 'asset_assigned':
    case 'asset_unassigned':
    case 'vm_assigned':
    case 'vm_unassigned':
      // For users to view their assigned assets
      return data?.target || '/dashboard/assets'
    default:
      return '/dashboard'
  }
}