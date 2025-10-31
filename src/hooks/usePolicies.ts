import { useState, useEffect, useCallback } from 'react';
import type { 
  Policy, 
  PolicyVersion, 
  PolicyPermission, 
  PolicyAccessLog,
  PolicyFormData,
  PolicyPermissionFormData,
  PolicySearchFilters,
  PolicyDashboardStats
} from '../types';
import PolicyApiService from '../services/policyApi';
import { toast } from 'sonner';

// Main policies hook
export const usePolicies = (filters?: PolicySearchFilters) => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.getPolicies(filters);
      setPolicies(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch policies';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const createPolicy = useCallback(async (policyData: PolicyFormData) => {
    try {
      const newPolicy = await PolicyApiService.createPolicy(policyData);
      setPolicies(prev => [newPolicy, ...prev]);
      return newPolicy;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create policy';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const updatePolicy = useCallback(async (id: string, policyData: Partial<PolicyFormData>) => {
    try {
      const updatedPolicy = await PolicyApiService.updatePolicy(id, policyData);
      setPolicies(prev => prev.map(p => p.id === id ? updatedPolicy : p));
      return updatedPolicy;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update policy';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const deletePolicy = useCallback(async (id: string) => {
    try {
      await PolicyApiService.deletePolicy(id);
      setPolicies(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete policy';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const duplicatePolicy = useCallback(async (id: string, newName: string) => {
    try {
      const duplicatedPolicy = await PolicyApiService.duplicatePolicy(id, newName);
      setPolicies(prev => [duplicatedPolicy, ...prev]);
      return duplicatedPolicy;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate policy';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const togglePolicyStatus = useCallback(async (id: string) => {
    try {
      const updatedPolicy = await PolicyApiService.togglePolicyStatus(id);
      setPolicies(prev => prev.map(p => p.id === id ? updatedPolicy : p));
      toast.success(`Policy ${updatedPolicy.is_active ? 'activated' : 'deactivated'} successfully`);
      return updatedPolicy;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle policy status';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  return {
    policies,
    loading,
    error,
    refetch: fetchPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    duplicatePolicy,
    togglePolicyStatus
  };
};

// Single policy hook
export const usePolicy = (id: string | null) => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.getPolicyById(id);
      setPolicy(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch policy';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  return {
    policy,
    loading,
    error,
    refetch: fetchPolicy
  };
};

// Policy versions hook
export const usePolicyVersions = (policyId: string | null) => {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!policyId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.getPolicyVersions(policyId);
      setVersions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch policy versions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return {
    versions,
    loading,
    error,
    refetch: fetchVersions
  };
};

// Categories removed - simplified policy system

// Policy permissions hook
export const usePolicyPermissions = (policyId: string | null) => {
  const [permissions, setPermissions] = useState<PolicyPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!policyId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.getPolicyPermissions(policyId);
      setPermissions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch permissions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const createPermission = useCallback(async (permissionData: PolicyPermissionFormData) => {
    try {
      const newPermission = await PolicyApiService.createPolicyPermission(permissionData);
      setPermissions(prev => [...prev, newPermission]);
      toast.success('Permission created successfully');
      return newPermission;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create permission';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const updatePermission = useCallback(async (id: string, permissionData: Partial<PolicyPermissionFormData>) => {
    try {
      const updatedPermission = await PolicyApiService.updatePolicyPermission(id, permissionData);
      setPermissions(prev => prev.map(p => p.id === id ? updatedPermission : p));
      toast.success('Permission updated successfully');
      return updatedPermission;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update permission';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const deletePermission = useCallback(async (id: string) => {
    try {
      await PolicyApiService.deletePolicyPermission(id);
      setPermissions(prev => prev.filter(p => p.id !== id));
      toast.success('Permission deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete permission';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const setRolePermissions = useCallback(async (role: string, permissions: { can_read: boolean; can_write: boolean; can_delete: boolean }) => {
    if (!policyId) return;
    
    try {
      await PolicyApiService.setRolePermissions(policyId, role, permissions);
      await fetchPermissions(); // Refresh permissions
      toast.success('Role permissions updated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role permissions';
      toast.error(errorMessage);
      throw err;
    }
  }, [policyId, fetchPermissions]);

  const setUserPermissions = useCallback(async (userId: string, permissions: { can_read: boolean; can_write: boolean; can_delete: boolean }) => {
    if (!policyId) return;
    
    try {
      await PolicyApiService.setUserPermissions(policyId, userId, permissions);
      await fetchPermissions(); // Refresh permissions
      toast.success('User permissions updated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user permissions';
      toast.error(errorMessage);
      throw err;
    }
  }, [policyId, fetchPermissions]);

  return {
    permissions,
    loading,
    error,
    refetch: fetchPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    setRolePermissions,
    setUserPermissions
  };
};

// Policy access logs hook
export const usePolicyAccessLogs = (policyId?: string, userId?: string) => {
  const [logs, setLogs] = useState<PolicyAccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.getPolicyAccessLogs(policyId, userId);
      setLogs(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch access logs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [policyId, userId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs
  };
};

// Policy dashboard stats hook
export const usePolicyDashboardStats = () => {
  const [stats, setStats] = useState<PolicyDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.getDashboardStats();
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard stats';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};

// Policy search hook
export const usePolicySearch = () => {
  const [searchResults, setSearchResults] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPolicies = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await PolicyApiService.searchPolicies(searchTerm);
      setSearchResults(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search policies';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    searchResults,
    loading,
    error,
    searchPolicies,
    clearSearch
  };
};

export default {
  usePolicies,
  usePolicy,
  usePolicyVersions,
  usePolicyPermissions,
  usePolicyAccessLogs,
  usePolicyDashboardStats,
  usePolicySearch
};
