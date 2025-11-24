# Debug Edge Function - Add This to Your send-email Function

Add this debugging code to your Edge Function to see what's happening:

```typescript
// Add this at the beginning of the serve function, right after getting requestData
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const emailService = new MicrosoftGraphService();
    const requestData: EmailRequest = await req.json();

    // ADD THIS DEBUG LOGGING
    console.log('=== EMAIL FUNCTION DEBUG ===');
    console.log('Request type:', requestData.type);
    console.log('Leave data:', JSON.stringify(requestData.leaveData, null, 2));
    console.log('Recipients:', JSON.stringify(requestData.recipients, null, 2));
    console.log('=== END DEBUG ===');

    if (requestData.type === 'test') {
      // ... existing test code
    } else if (requestData.type === 'leave_approval') {
      // ADD MORE DEBUG LOGGING HERE
      console.log('Processing leave approval email...');
      
      if (!requestData.leaveData || !requestData.recipients) {
        console.error('Missing required data:', {
          hasLeaveData: !!requestData.leaveData,
          hasRecipients: !!requestData.recipients
        });
        throw new Error('Leave data and recipients are required for leave approval email');
      }

      // Log recipient details
      console.log('Employee recipient:', requestData.recipients.employee);
      console.log('Admin/HR recipients:', requestData.recipients.adminsAndHR);
      console.log('Manager recipient:', requestData.recipients.manager);

      // ... rest of your existing leave approval code

      // ADD DEBUG BEFORE SENDING EMAIL
      console.log('About to send email with TO/CC structure...');
      
      // Your existing email sending code here...
      
      console.log('Email sent successfully!');
    }
  } catch (error) {
    console.error('=== EMAIL FUNCTION ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===');
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send email',
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
```

## After Adding Debug Logs:

1. **Redeploy the Edge Function** with the debug code
2. **Approve a leave** from the dashboard
3. **Check Edge Function logs** in Supabase Dashboard
4. **Look for the debug output** to see exactly what's happening

The debug logs will show:
- What data is being received
- Whether Microsoft Graph authentication is working
- Where exactly the process is failing

Share the debug output with me and I can pinpoint the exact issue!

