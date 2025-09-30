// Test utility to verify manager isolation is working correctly
// This file can be used to test that managers only see asset requests from their direct reports

import { supabase } from '../services/supabase';
import { assetApi } from '../services/api';

export interface ManagerIsolationTestResult {
  success: boolean;
  managerName: string;
  managerRole: string;
  directReportsCount: number;
  visibleRequestsCount: number;
  expectedRequestsCount: number;
  isIsolationWorking: boolean;
  message: string;
}

/**
 * Test if manager isolation is working correctly for asset requests
 * @param managerId The UUID of the manager to test
 * @returns Test result showing if isolation is working
 */
export async function testManagerIsolation(managerId: string): Promise<ManagerIsolationTestResult> {
  try {
    // Get manager info
    const { data: managerData, error: managerError } = await supabase
      .from('users')
      .select(`
        full_name,
        role:roles(name)
      `)
      .eq('id', managerId)
      .single();

    if (managerError || !managerData) {
      return {
        success: false,
        managerName: 'Unknown',
        managerRole: 'Unknown', 
        directReportsCount: 0,
        visibleRequestsCount: 0,
        expectedRequestsCount: 0,
        isIsolationWorking: false,
        message: `Failed to fetch manager data: ${managerError?.message || 'Manager not found'}`
      };
    }

    // Get count of direct reports
    const { count: directReportsCount, error: reportsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', managerId);

    if (reportsError) {
      return {
        success: false,
        managerName: managerData.full_name,
        managerRole: managerData.role?.name || 'Unknown',
        directReportsCount: 0,
        visibleRequestsCount: 0,
        expectedRequestsCount: 0,
        isIsolationWorking: false,
        message: `Failed to count direct reports: ${reportsError.message}`
      };
    }

    // Get count of asset requests from direct reports ONLY (excluding manager's own requests)
    const directReportIds = await getDirectReportIds(managerId);
    console.log('Direct report IDs:', directReportIds);
    let expectedRequestsCount = 0;
    let expectedError = null;
    
    if (directReportIds.length > 0) {
      // Only count requests from direct reports, exclude manager's own requests
      const result = await supabase
        .from('asset_requests')
        .select('*', { count: 'exact' })
        .in('user_id', directReportIds)
        .neq('user_id', managerId); // Exclude manager's own requests
      expectedRequestsCount = result.count || 0;
      expectedError = result.error;
      console.log('Expected requests (from direct reports only, excluding manager):', result.data);
      console.log('Expected requests count:', expectedRequestsCount);
    } else {
      console.log('No direct reports found for manager:', managerId);
    }

    if (expectedError) {
      return {
        success: false,
        managerName: managerData.full_name,
        managerRole: managerData.role?.name || 'Unknown',
        directReportsCount: directReportsCount || 0,
        visibleRequestsCount: 0,
        expectedRequestsCount: 0,
        isIsolationWorking: false,
        message: `Failed to count expected requests: ${expectedError.message}`
      };
    }

    // Now test what the manager can actually see through the SAME API the component uses
    console.log('Testing manager API - fetching visible requests for manager:', managerId);
    let visibleRequests: any[] = [];
    let visibleRequestsCount = 0;
    let visibleError = null;
    
    try {
      visibleRequests = await assetApi.getManagerAssetRequests();
      visibleRequestsCount = visibleRequests?.length || 0;
      console.log('Visible requests data (via API):', visibleRequests);
      console.log('Visible requests count (via API):', visibleRequestsCount);
    } catch (error) {
      visibleError = error;
      console.error('Error fetching manager requests via API:', error);
    }

    if (visibleError) {
      return {
        success: false,
        managerName: managerData.full_name,
        managerRole: managerData.role?.name || 'Unknown',
        directReportsCount: directReportsCount || 0,
        visibleRequestsCount: 0,
        expectedRequestsCount: expectedRequestsCount || 0,
        isIsolationWorking: false,
        message: `Failed to count visible requests: ${visibleError.message}`
      };
    }

    const isIsolationWorking = visibleRequestsCount === expectedRequestsCount;

    return {
      success: true,
      managerName: managerData.full_name,
      managerRole: managerData.role?.name || 'Unknown',
      directReportsCount: directReportsCount || 0,
      visibleRequestsCount: visibleRequestsCount || 0,
      expectedRequestsCount: expectedRequestsCount || 0,
      isIsolationWorking,
      message: isIsolationWorking 
        ? `✅ Manager isolation is working correctly! Manager can see ${visibleRequestsCount} requests from ${directReportsCount} direct reports (excluding their own requests).`
        : `❌ Manager isolation is NOT working! Manager can see ${visibleRequestsCount} requests but should only see ${expectedRequestsCount} requests from ${directReportsCount} direct reports (excluding their own requests).`
    };

  } catch (error) {
    return {
      success: false,
      managerName: 'Unknown',
      managerRole: 'Unknown',
      directReportsCount: 0,
      visibleRequestsCount: 0,
      expectedRequestsCount: 0,
      isIsolationWorking: false,
      message: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Helper function to get IDs of direct reports for a manager
 */
async function getDirectReportIds(managerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('manager_id', managerId);

  if (error || !data) {
    return [];
  }

  return data.map(user => user.id);
}

/**
 * Comprehensive test function that can be called from browser console or debug tools
 * Usage: import { runManagerIsolationTest } from './utils/testManagerIsolation'; runManagerIsolationTest('manager-uuid');
 */
export async function runManagerIsolationTest(managerId: string): Promise<void> {
  console.log('🔍 Testing Manager Isolation for Asset Requests...');
  console.log('Manager ID:', managerId);
  
  const result = await testManagerIsolation(managerId);
  
  console.log('\n📊 Test Results:');
  console.log('Manager Name:', result.managerName);
  console.log('Manager Role:', result.managerRole);
  console.log('Direct Reports Count:', result.directReportsCount);
  console.log('Visible Requests Count:', result.visibleRequestsCount);
  console.log('Expected Requests Count:', result.expectedRequestsCount);
  console.log('Isolation Working:', result.isIsolationWorking ? '✅ YES' : '❌ NO');
  console.log('\n💬 Message:', result.message);
  
  if (!result.success) {
    console.error('❌ Test failed to complete successfully');
  }
}
