import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { notificationApi } from './notificationApi';
import JSZip from 'jszip';

export interface EmployeeDocumentType {
  id: string;
  name: string;
  is_mandatory: boolean;
  category: 'personal' | 'educational' | 'professional' | 'bank' | 'custom';
  applicable_employment_types?: string[];
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type_id: string;
  document_name: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  status: 'uploaded' | 'pending' | 'requested';
  requested_by?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
  document_type?: EmployeeDocumentType;
  requested_by_user?: { full_name: string };
  uploaded_by_user?: { full_name: string };
}

export class EmployeeDocumentService {
  private static readonly BUCKET_NAME = 'employee-documents';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = ['application/pdf'];

  /**
   * Get HR users for notifications
   */
  private static async getHRUsers(): Promise<{ id: string; full_name: string }[]> {
    try {
      console.log('Fetching HR users for notifications...');
      
      // Get all active users with their role and department info
      const { data: allUsers, error } = await supabase
        .from('users')
        .select(`
          id, 
          full_name,
          role:roles(name),
          department:departments!users_department_id_fkey(name),
          "isSA"
        `)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      console.log(`Found ${allUsers?.length || 0} active users`);

      // Filter to find HR users
      const hrUsers = allUsers?.filter(user => {
        const isHRRole = user.role?.name && ['hr', 'hrm', 'admin', 'super_admin'].includes(user.role.name);
        const isSuperAdmin = user.isSA === true;
        const isHRDepartment = user.department?.name && 
          user.department.name.toLowerCase().includes('hr');
        
        const isHRUser = isHRRole || isSuperAdmin || isHRDepartment;
        
        if (isHRUser) {
          console.log(`HR User found: ${user.full_name} - Role: ${user.role?.name}, Super Admin: ${user.isSA}, Department: ${user.department?.name}`);
        }
        
        return isHRUser;
      }) || [];

      console.log(`Filtered to ${hrUsers.length} HR users:`, hrUsers.map(u => u.full_name));

      return hrUsers.map(user => ({
        id: user.id,
        full_name: user.full_name
      }));
    } catch (error) {
      console.error('Failed to get HR users:', error);
      return [];
    }
  }

  /**
   * Send notification when document is requested
   */
  private static async notifyDocumentRequested(
    employeeId: string,
    employeeName: string,
    documentName: string,
    requestedBy: string
  ): Promise<void> {
    try {
      console.log(`Sending document request notification to employee ${employeeName} (${employeeId}) for document: ${documentName}`);
      
      const result = await notificationApi.createNotification({
        user_id: employeeId,
        title: 'Document Upload Required',
        message: `Please upload your "${documentName}" document. This document has been requested for your employee records.`,
        type: 'document_request',
        data: {
          document_name: documentName,
          requested_by: requestedBy,
          action: 'upload_document',
          target: 'dashboard/documents',
          tab: 'requests'  // This will direct to the Upload Requests tab
        }
      });
      
      console.log('Document request notification sent successfully:', result);
    } catch (error) {
      console.error('Failed to send document request notification:', error);
      console.error('Error details:', {
        employeeId,
        employeeName,
        documentName,
        requestedBy,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send notification when document is uploaded
   */
  private static async notifyDocumentUploaded(
    employeeId: string,
    employeeName: string,
    documentName: string
  ): Promise<void> {
    try {
      console.log(`Sending document upload notifications for employee ${employeeName} (${employeeId}) document: ${documentName}`);
      
      // Get HR users
      const hrUsers = await this.getHRUsers();
      
      if (hrUsers.length === 0) {
        console.warn('No HR users found to notify about document upload');
        return;
      }
      
      console.log(`Found ${hrUsers.length} HR users to notify:`, hrUsers.map(u => u.full_name));

      // Send notification to all HR users
      const notificationPromises = hrUsers.map(async (hrUser) => {
        try {
          const result = await notificationApi.createNotification({
            user_id: hrUser.id,
            title: 'New Document Uploaded',
            message: `${employeeName} has uploaded "${documentName}" document.`,
            type: 'document_upload',
            data: {
              employee_id: employeeId,
              employee_name: employeeName,
              document_name: documentName,
              action: 'review_document',
              target: 'employees'
            }
          });
          console.log(`Notification sent to HR user ${hrUser.full_name}:`, result);
          return result;
        } catch (error) {
          console.error(`Failed to send notification to HR user ${hrUser.full_name}:`, error);
          return null;
        }
      });

      const results = await Promise.allSettled(notificationPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      console.log(`Document upload notifications: ${successful}/${hrUsers.length} sent successfully`);
    } catch (error) {
      console.error('Failed to send document upload notifications:', error);
      console.error('Error details:', {
        employeeId,
        employeeName,
        documentName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Predefined document types
  static readonly DEFAULT_DOCUMENT_TYPES: Omit<EmployeeDocumentType, 'id'>[] = [
    // Personal Documents
    { name: 'Latest passport-size photograph', is_mandatory: true, category: 'personal' },
    { name: 'Police Clearance Certificate (PCC)', is_mandatory: true, category: 'personal' },
    { name: 'Copy of Birth Certificate / School Leaving Certificate', is_mandatory: true, category: 'personal' },
    { name: 'Aadhaar Card', is_mandatory: true, category: 'personal' },
    { name: 'PAN Card / PAN Details', is_mandatory: true, category: 'personal' },
    { name: 'One Professional Photograph (plain white background)', is_mandatory: true, category: 'personal' },
    { name: 'Driving License', is_mandatory: false, category: 'personal' },
    { name: 'Passport', is_mandatory: false, category: 'personal' },

    // Educational Documents
    { name: '10th Certificate', is_mandatory: true, category: 'educational' },
    { name: '12th Certificate', is_mandatory: true, category: 'educational' },
    { name: 'Degree Certificate', is_mandatory: true, category: 'educational' },
    { name: 'Copy of Educational Qualification Certificates', is_mandatory: true, category: 'educational' },

    // Bank Documents
    { name: 'Bank Account Details', is_mandatory: true, category: 'bank' },
    { name: 'Cancelled Cheque', is_mandatory: true, category: 'bank' },

    // Professional Documents (All employment types)
    { name: 'Offer Letter', is_mandatory: true, category: 'professional' },
    { name: 'Signed Copy Received', is_mandatory: true, category: 'professional' },

    // Professional Documents (Not required for Associate)
    { 
      name: 'Relieving Letter and Experience Certificates', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time'] // Not for associates
    },
    { 
      name: 'Copy of Resignation Email', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time']
    },
    { 
      name: 'Last Drawn Salary Slip / Certificate', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time']
    },
    { 
      name: 'UAN (Universal Account Number)', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time']
    },
    { 
      name: 'ESIC (Employee State Insurance Corporation) Number', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time']
    },
    { 
      name: 'Form 16', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time']
    },
    { 
      name: 'TDS Document', 
      is_mandatory: false, 
      category: 'professional',
      applicable_employment_types: ['full_time', 'part_time']
    },
  ];

  /**
   * Validates if the file is acceptable for upload
   */
  static validateFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        error: `File size must be less than ${this.MAX_FILE_SIZE / 1024 / 1024}MB` 
      };
    }

    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return { 
        isValid: false, 
        error: 'Invalid file type. Please upload PDF files only.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Generates a unique filename to prevent overwriting
   */
  static generateUniqueFileName(originalFileName: string, _employeeId: string, documentTypeName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().slice(0, 8);
    const extension = originalFileName.split('.').pop() || 'pdf';
    
    // Clean the document type name for filename
    const cleanDocumentType = documentTypeName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    return `${cleanDocumentType}_${timestamp}_${uuid}.${extension}`;
  }

  /**
   * Get document types for a specific employee (global + employee-specific)
   */
  static async getDocumentTypes(employeeId?: string): Promise<EmployeeDocumentType[]> {
    let query = supabase
      .from('employee_document_types')
      .select('*');

    if (employeeId) {
      // Get global document types OR employee-specific ones
      query = query.or(`created_for_employee_id.is.null,created_for_employee_id.eq.${employeeId}`);
    } else {
      // Get only global document types
      query = query.is('created_for_employee_id', null);
    }

    const { data, error } = await query.order('category, name');

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new document type (for custom documents)
   */
  static async createDocumentType(documentType: {
    name: string;
    is_mandatory?: boolean;
    category?: string;
    created_for_employee_id?: string | null;
    created_by: string;
  }): Promise<EmployeeDocumentType> {
    const { data, error } = await supabase
      .from('employee_document_types')
      .insert({
        name: documentType.name,
        is_mandatory: documentType.is_mandatory || false,
        category: documentType.category || 'custom',
        created_for_employee_id: documentType.created_for_employee_id || null,
        created_by: documentType.created_by
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get employee documents
   */
  static async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select(`
        *,
        document_type:employee_document_types(*),
        requested_by_user:users!employee_documents_requested_by_fkey(full_name),
        uploaded_by_user:users!employee_documents_uploaded_by_fkey(full_name)
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Upload a document
   */
  static async uploadDocument(
    file: File,
    employeeId: string,
    documentTypeId: string,
    uploadedBy: string
  ): Promise<{ success: boolean; url?: string; documentRecord?: EmployeeDocument; error?: string }> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Get employee info for folder naming
      const { data: employee, error: employeeError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', employeeId)
        .maybeSingle();

      if (employeeError || !employee) {
        return { success: false, error: 'Employee not found' };
      }

      // Get document type info
      const { data: docType, error: docTypeError } = await supabase
        .from('employee_document_types')
        .select('name')
        .eq('id', documentTypeId)
        .maybeSingle();

      if (docTypeError || !docType) {
        return { success: false, error: 'Invalid document type' };
      }

      // Generate clean filename using document type name
      const cleanDocumentName = docType.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const fileName = `${cleanDocumentName}.pdf`;
      
      // Create organized file path using employee name
      const sanitizedEmployeeName = employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const filePath = `${sanitizedEmployeeName}/${fileName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting with same document type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return { 
          success: false, 
          error: `Upload failed: ${uploadError.message}` 
        };
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        return { 
          success: false, 
          error: 'Failed to generate public URL for uploaded file' 
        };
      }

      // Create or update document record in database
      const documentData = {
        employee_id: employeeId,
        document_type_id: documentTypeId,
        document_name: docType.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded' as const,
        uploaded_by: uploadedBy
      };

      // Check if document already exists
      const { data: existingDoc } = await supabase
        .from('employee_documents')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('document_type_id', documentTypeId)
        .maybeSingle();

      let documentRecord;
      if (existingDoc) {
        // Update existing document
        const { data, error: updateError } = await supabase
          .from('employee_documents')
          .update({
            ...documentData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDoc.id)
          .select(`
            *,
            document_type:employee_document_types(*),
            requested_by_user:users!employee_documents_requested_by_fkey(full_name),
            uploaded_by_user:users!employee_documents_uploaded_by_fkey(full_name)
          `)
          .single();

        if (updateError) {
          // Clean up uploaded file if database update fails
          await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
          throw updateError;
        }
        documentRecord = data;
      } else {
        // Create new document record
        const { data, error: insertError } = await supabase
          .from('employee_documents')
          .insert(documentData)
          .select(`
            *,
            document_type:employee_document_types(*),
            requested_by_user:users!employee_documents_requested_by_fkey(full_name),
            uploaded_by_user:users!employee_documents_uploaded_by_fkey(full_name)
          `)
          .single();

        if (insertError) {
          // Clean up uploaded file if database insert fails
          await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
          throw insertError;
        }
        documentRecord = data;
      }

      // Send notification to HR about the upload
      await this.notifyDocumentUploaded(
        employeeId,
        employee.full_name,
        docType.name
      );

      return { 
        success: true, 
        url: urlData.publicUrl,
        documentRecord
      };

    } catch (error: any) {
      console.error('Document upload service error:', error);
      return { 
        success: false, 
        error: `Upload failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Request a document from employee
   */
  static async requestDocument(
    employeeId: string,
    documentTypeId: string,
    requestedBy: string
  ): Promise<{ success: boolean; documentRecord?: EmployeeDocument; error?: string }> {
    try {
      // Get document type info
      const { data: docType, error: docTypeError } = await supabase
        .from('employee_document_types')
        .select('name')
        .eq('id', documentTypeId)
        .maybeSingle();

      if (docTypeError || !docType) {
        return { success: false, error: 'Invalid document type' };
      }

      // Get employee info for notification
      const { data: employee, error: employeeError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', employeeId)
        .maybeSingle();

      if (employeeError || !employee) {
        return { success: false, error: 'Employee not found' };
      }

      const documentData = {
        employee_id: employeeId,
        document_type_id: documentTypeId,
        document_name: docType.name,
        status: 'requested' as const,
        requested_by: requestedBy
      };

      // Check if document already exists
      const { data: existingDoc } = await supabase
        .from('employee_documents')
        .select('id, status')
        .eq('employee_id', employeeId)
        .eq('document_type_id', documentTypeId)
        .maybeSingle();

      let documentRecord;
      if (existingDoc) {
        // Only update if not already uploaded
        if (existingDoc.status !== 'uploaded') {
          const { data, error: updateError } = await supabase
            .from('employee_documents')
            .update({
              status: 'requested',
              requested_by: requestedBy,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingDoc.id)
            .select(`
              *,
              document_type:employee_document_types(*),
              requested_by_user:users!employee_documents_requested_by_fkey(full_name),
              uploaded_by_user:users!employee_documents_uploaded_by_fkey(full_name)
            `)
            .single();

          if (updateError) throw updateError;
          documentRecord = data;
        } else {
          return { success: false, error: 'Document is already uploaded' };
        }
      } else {
        // Create new document request
        const { data, error: insertError } = await supabase
          .from('employee_documents')
          .insert(documentData)
          .select(`
            *,
            document_type:employee_document_types(*),
            requested_by_user:users!employee_documents_requested_by_fkey(full_name),
            uploaded_by_user:users!employee_documents_uploaded_by_fkey(full_name)
          `)
          .single();

        if (insertError) throw insertError;
        documentRecord = data;
      }

      // Send notification to employee
      await this.notifyDocumentRequested(
        employeeId,
        employee.full_name,
        docType.name,
        requestedBy
      );

      return { 
        success: true, 
        documentRecord
      };

    } catch (error: any) {
      console.error('Document request service error:', error);
      return { 
        success: false, 
        error: `Request failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get document info first
      const { data: document, error: fetchError } = await supabase
        .from('employee_documents')
        .select('file_url')
        .eq('id', documentId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (!document) {
        return { success: false, error: 'Document not found' };
      }

      // Delete from storage if file exists
      if (document.file_url) {
        try {
          // Extract file path from URL
          const url = new URL(document.file_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME);
          
          if (bucketIndex !== -1) {
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
          }
        } catch (storageError) {
          console.error('Failed to delete file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;

      return { success: true };

    } catch (error: any) {
      console.error('Document delete service error:', error);
      return { 
        success: false, 
        error: `Delete failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Download all documents as a zip file
   */
  static async downloadAllDocuments(employeeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all uploaded documents for the employee
      const documents = await this.getEmployeeDocuments(employeeId);
      const uploadedDocs = documents.filter(doc => doc.status === 'uploaded' && doc.file_url);

      if (uploadedDocs.length === 0) {
        return { success: false, error: 'No documents available for download' };
      }

      // Get employee name for folder naming
      const { data: employee, error: employeeError } = await supabase
        .from('users')
        .select('full_name, employee_id')
        .eq('id', employeeId)
        .maybeSingle();

      if (employeeError || !employee) {
        return { success: false, error: 'Employee not found' };
      }

      // Create zip file
      const zip = new JSZip();
      const folderName = `${employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}_Documents`;
      const documentsFolder = zip.folder(folderName);

      if (!documentsFolder) {
        return { success: false, error: 'Failed to create zip folder' };
      }

      // Download and add each document to zip
      const downloadPromises = uploadedDocs.map(async (doc) => {
        try {
          const response = await fetch(doc.file_url!);
          if (!response.ok) {
            console.warn(`Failed to download ${doc.document_name}: ${response.statusText}`);
            return null;
          }

          const blob = await response.blob();
          const fileName = `${doc.document_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`;
          
          documentsFolder.file(fileName, blob);
          return true;
        } catch (error) {
          console.warn(`Error downloading ${doc.document_name}:`, error);
          return null;
        }
      });

      // Wait for all downloads to complete
      const results = await Promise.allSettled(downloadPromises);
      const successfulDownloads = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;

      if (successfulDownloads === 0) {
        return { success: false, error: 'Failed to download any documents' };
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true };

    } catch (error: any) {
      console.error('Download all documents error:', error);
      return { 
        success: false, 
        error: `Download failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Initialize default document types (run once)
   */
  static async initializeDocumentTypes(): Promise<void> {
    try {
      // Check if document types already exist
      const { data: existingTypes } = await supabase
        .from('employee_document_types')
        .select('id')
        .limit(1);

      if (existingTypes && existingTypes.length > 0) {
        console.log('Document types already initialized');
        return;
      }

      // Insert default document types
      const { error } = await supabase
        .from('employee_document_types')
        .insert(this.DEFAULT_DOCUMENT_TYPES);

      if (error) throw error;
      console.log('Default document types initialized successfully');

    } catch (error: any) {
      console.error('Failed to initialize document types:', error);
      throw error;
    }
  }
}

export default EmployeeDocumentService;
