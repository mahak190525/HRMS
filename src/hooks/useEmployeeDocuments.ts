import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import EmployeeDocumentService from '@/services/employeeDocumentService';
import { toast } from 'sonner';

// Hook to get document types for a specific employee
export function useDocumentTypes(employeeId?: string) {
  return useQuery({
    queryKey: ['document-types', employeeId],
    queryFn: () => EmployeeDocumentService.getDocumentTypes(employeeId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Hook to get employee documents
export function useEmployeeDocuments(employeeId: string) {
  return useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: () => EmployeeDocumentService.getEmployeeDocuments(employeeId),
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook to upload a document
export function useUploadEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      file, 
      employeeId, 
      documentTypeId, 
      uploadedBy 
    }: { 
      file: File; 
      employeeId: string; 
      documentTypeId: string; 
      uploadedBy: string; 
    }) => EmployeeDocumentService.uploadDocument(file, employeeId, documentTypeId, uploadedBy),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch employee documents
        queryClient.invalidateQueries({ 
          queryKey: ['employee-documents', variables.employeeId] 
        });
        // Also invalidate employee data to reflect document changes
        queryClient.invalidateQueries({ queryKey: ['all-employees'] });
        queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
        queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
        toast.success('Document uploaded successfully!');
      } else {
        toast.error(result.error || 'Upload failed');
      }
    },
    onError: (error: any) => {
      console.error('Upload mutation error:', error);
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to request a document
export function useRequestEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      employeeId, 
      documentTypeId, 
      requestedBy 
    }: { 
      employeeId: string; 
      documentTypeId: string; 
      requestedBy: string; 
    }) => EmployeeDocumentService.requestDocument(employeeId, documentTypeId, requestedBy),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch employee documents
        queryClient.invalidateQueries({ 
          queryKey: ['employee-documents', variables.employeeId] 
        });
        // Also invalidate employee data to reflect document changes
        queryClient.invalidateQueries({ queryKey: ['all-employees'] });
        queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
        queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
        toast.success('Document requested successfully!');
      } else {
        toast.error(result.error || 'Request failed');
      }
    },
    onError: (error: any) => {
      console.error('Request mutation error:', error);
      toast.error(`Request failed: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to delete a document
export function useDeleteEmployeeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      documentId
    }: { 
      documentId: string;
      employeeId: string;
    }) => EmployeeDocumentService.deleteDocument(documentId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate and refetch employee documents
        queryClient.invalidateQueries({ 
          queryKey: ['employee-documents', variables.employeeId] 
        });
        // Also invalidate employee data to reflect document changes
        queryClient.invalidateQueries({ queryKey: ['all-employees'] });
        queryClient.invalidateQueries({ queryKey: ['filtered-employees'] });
        queryClient.invalidateQueries({ queryKey: ['employee', variables.employeeId] });
        toast.success('Document deleted successfully!');
      } else {
        toast.error(result.error || 'Delete failed');
      }
    },
    onError: (error: any) => {
      console.error('Delete mutation error:', error);
      toast.error(`Delete failed: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to create a custom document type
export function useCreateDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentType: {
      name: string;
      is_mandatory?: boolean;
      category?: string;
      created_for_employee_id?: string | null;
      created_by: string;
    }) => EmployeeDocumentService.createDocumentType(documentType),
    onSuccess: (_, variables) => {
      // Invalidate and refetch document types for the specific employee
      queryClient.invalidateQueries({ 
        queryKey: ['document-types', variables.created_for_employee_id] 
      });
      // Also invalidate general document types
      queryClient.invalidateQueries({ 
        queryKey: ['document-types'] 
      });
      toast.success('Custom document type created successfully!');
    },
    onError: (error: any) => {
      console.error('Create document type error:', error);
      toast.error(`Failed to create document type: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to initialize document types (for admin use)
export function useInitializeDocumentTypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: EmployeeDocumentService.initializeDocumentTypes,
    onSuccess: () => {
      // Invalidate and refetch document types
      queryClient.invalidateQueries({ 
        queryKey: ['document-types'] 
      });
      toast.success('Document types initialized successfully!');
    },
    onError: (error: any) => {
      console.error('Initialize document types error:', error);
      toast.error(`Failed to initialize document types: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to download all documents
export function useDownloadAllDocuments() {
  return useMutation({
    mutationFn: ({ employeeId }: { employeeId: string }) => 
      EmployeeDocumentService.downloadAllDocuments(employeeId),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('All documents downloaded successfully!');
      } else {
        toast.error(result.error || 'Download failed');
      }
    },
    onError: (error: any) => {
      console.error('Download all documents error:', error);
      toast.error(`Download failed: ${error.message || 'Unknown error'}`);
    },
  });
}