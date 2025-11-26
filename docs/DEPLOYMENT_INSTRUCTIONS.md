# Email Integration Deployment Instructions

## 🚀 Quick Fix Summary

The CORS error you encountered is because **Microsoft Graph API cannot be called directly from the browser**. I've created a **Supabase Edge Function** to handle the authentication and email sending server-side.

## 📁 Files Created/Updated

### New Files:
- `supabase/functions/send-email/index.ts` - Edge Function for email sending
- `supabase/functions/_shared/cors.ts` - CORS configuration

### Updated Files:
- `src/services/emailService.ts` - Now calls the Edge Function instead of direct API calls

## 🛠 Deployment Steps

### Step 1: Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```

### Step 3: Link to your project (if not already linked)
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 4: Deploy the Edge Function
```bash
supabase functions deploy send-email
```

### Step 5: Test the Integration
1. Go to your HRMS app
2. Navigate to **Settings → Email Test** tab (admin only)
3. Try sending a test email
4. The CORS error should be resolved!

## 🔧 Alternative Deployment (Manual)

If you prefer to deploy manually through the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click **Create Function**
4. Name it `send-email`
5. Copy the contents of `supabase/functions/send-email/index.ts`
6. Deploy the function

## 🧪 Testing After Deployment

### Test 1: Basic Email Test
```javascript
// This should now work without CORS errors
await emailApi.testEmail({
  email: 'your-email@example.com',
  name: 'Your Name'
});
```

### Test 2: Leave Approval Email
1. Create a test leave application
2. Approve it through the HRMS interface
3. Check that emails are sent automatically

## 🔍 Troubleshooting

### If you still get errors:

1. **Check Edge Function Logs**:
   - Go to Supabase Dashboard → Edge Functions → send-email → Logs
   - Look for authentication or API errors

2. **Verify Azure App Permissions**:
   - Ensure your Azure app has `Mail.Send` and `User.Read` permissions
   - Make sure `hrms@mechlintech.com` exists in your Microsoft 365 tenant

3. **Test Edge Function Directly**:
   ```bash
   curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email' \
     -H 'Authorization: Bearer YOUR_ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{
       "type": "test",
       "recipient": {
         "email": "test@example.com",
         "name": "Test User"
       }
     }'
   ```

## 📧 How It Works Now

1. **Frontend** calls `emailService.testEmail()` or `emailService.sendLeaveApprovalEmails()`
2. **Frontend** makes request to Supabase Edge Function (`send-email`)
3. **Edge Function** authenticates with Microsoft Graph API server-side
4. **Edge Function** sends emails using Microsoft Graph API
5. **Edge Function** returns success/error response to frontend

## 🔒 Security Benefits

- ✅ **No CORS issues** - All Microsoft Graph calls happen server-side
- ✅ **Secure credentials** - Client secret stays on the server
- ✅ **Better error handling** - Server-side validation and logging
- ✅ **Scalable** - Edge Functions auto-scale with usage

## 🎯 Next Steps

1. Deploy the Edge Function using the steps above
2. Test the email functionality
3. The leave approval emails will now work automatically!

---

**Note**: After deployment, the email integration will work seamlessly without any CORS errors. The frontend code remains the same - it just calls the Edge Function instead of trying to authenticate directly with Microsoft Graph.

