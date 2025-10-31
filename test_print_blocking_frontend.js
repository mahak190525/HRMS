// TEST SCRIPT FOR PRINT BLOCKING FRONTEND
// Run this in your browser console to test if the frontend is working

console.log('=== PRINT BLOCKING FRONTEND TEST ===');

// Test 1: Check if user is logged in
console.log('1. Checking user authentication...');
const userData = localStorage.getItem('hrms_user');
if (userData) {
  try {
    const user = JSON.parse(userData);
    console.log('✅ User found:', user.id, user.full_name || user.email);
  } catch (e) {
    console.log('❌ Invalid user data in localStorage:', userData);
  }
} else {
  console.log('❌ No user data found in localStorage');
}

// Test 2: Check environment variable
console.log('2. Checking environment variable...');
// Note: This might not work in production builds
console.log('VITE_ENABLE_PRINT_BLOCKING:', import.meta?.env?.VITE_ENABLE_PRINT_BLOCKING || 'undefined');

// Test 3: Test the RPC call directly
console.log('3. Testing RPC call directly...');
async function testRPCCall() {
  try {
    const userData = localStorage.getItem('hrms_user');
    if (!userData) {
      console.log('❌ Cannot test RPC - no user data');
      return;
    }
    
    const user = JSON.parse(userData);
    const userId = user.id;
    
    console.log('Calling log_print_blocking_attempt RPC...');
    
    // Import supabase (this might not work depending on your setup)
    // You might need to access it differently
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your actual URL
    const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your actual key
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase.rpc('log_print_blocking_attempt', {
      p_user_id: userId,
      p_action_type: 'test',
      p_action_description: 'Frontend Test',
      p_key_combination: 'Test',
      p_page_url: window.location.href,
      p_user_agent: navigator.userAgent,
      p_additional_data: { test: true, timestamp: new Date().toISOString() }
    });
    
    if (error) {
      console.log('❌ RPC Error:', error);
    } else {
      console.log('✅ RPC Success:', data);
    }
  } catch (error) {
    console.log('❌ RPC Test failed:', error);
  }
}

// Test 4: Simulate print blocking
console.log('4. Simulating Ctrl+P press...');
const event = new KeyboardEvent('keydown', {
  key: 'p',
  ctrlKey: true,
  bubbles: true
});
document.dispatchEvent(event);

console.log('=== TEST COMPLETE ===');
console.log('Check the console output above and also check:');
console.log('1. Network tab for any RPC calls to log_print_blocking_attempt');
console.log('2. Any toast notifications appearing');
console.log('3. Any additional console logs from the print blocker');

// Uncomment the line below to test RPC directly (after updating supabase credentials)
// testRPCCall();
