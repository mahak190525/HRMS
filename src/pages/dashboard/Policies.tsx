import { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Shield
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PolicySimpleEditor } from '@/components/ui/policy-simple-editor';
import { usePolicies } from '@/hooks/usePolicies';
import type { Policy } from '@/types';
import { cn } from '@/lib/utils';

export function Policies() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  const { policies, loading, error } = usePolicies();

  // Filter only active policies and by search term
  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.content.toLowerCase().includes(searchTerm.toLowerCase());
    const isActive = policy.is_active; // Only show active policies
    return matchesSearch && isActive;
  });

  // Auto-select first policy when policies load
  useEffect(() => {
    if (filteredPolicies.length > 0 && !selectedPolicy) {
      setSelectedPolicy(filteredPolicies[0]);
    }
  }, [filteredPolicies, selectedPolicy]);

  // Update selected policy when search changes
  useEffect(() => {
    if (filteredPolicies.length > 0 && selectedPolicy && !filteredPolicies.find(p => p.id === selectedPolicy.id)) {
      setSelectedPolicy(filteredPolicies[0]);
    }
  }, [filteredPolicies, selectedPolicy]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Unable to Load Policies
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white">
      {/* Left Sidebar - Policy List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">All Policies</h2>
          <div className="text-sm text-gray-500 mb-3">
            {filteredPolicies.length} of {policies.filter(p => p.is_active).length} policies
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search policies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Policy List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredPolicies.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {searchTerm ? 'No policies found' : 'No policies available'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    onClick={() => setSelectedPolicy(policy)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3",
                      selectedPolicy?.id === policy.id
                        ? "bg-blue-50 border border-blue-200 text-blue-900"
                        : "hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {policy.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Main Content - Policy Details */}
      <div className="flex-1 flex flex-col">
        {selectedPolicy ? (
          <>
            {/* Policy Header */}
            <div className="p-2 border-b border-gray-200 bg-gray-50">
              <h1 className="text-lg font-semibold text-gray-900">
                {selectedPolicy.name}
              </h1>
              <div className="text-sm text-gray-500 mt-1">
                Version {selectedPolicy.version} • Updated {new Date(selectedPolicy.updated_at).toLocaleDateString()}
              </div>
            </div>

            {/* Policy Content */}
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                <PolicySimpleEditor
                  content={selectedPolicy.content}
                  onChange={() => {}} // Read-only
                  editable={false}
                  className="w-full"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select a Policy
              </h3>
              <p className="text-gray-600">
                Choose a policy from the list to view its details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Policies;
