import { supabase } from './supabase';

export interface IncidentAttachment {
  id: string;
  incident_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  uploaded_by_user?: {
    full_name: string;
    email: string;
  };
}

export interface EmployeeIncident {
  id: string;
  employee_id: string;
  title: string;
  incident_date: string;
  comments?: string;
  attachment_file_url?: string;
  attachment_file_name?: string;
  attachment_file_size?: number;
  attachment_mime_type?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by_user?: {
    full_name: string;
    email: string;
  };
  // Multiple attachments
  attachments?: IncidentAttachment[];
}

export interface CreateIncidentData {
  employee_id: string;
  title: string;
  incident_date: string;
  comments?: string;
  created_by: string;
}

export interface UpdateIncidentData {
  title?: string;
  incident_date?: string;
  comments?: string;
}

class IncidentService {
  // Get all incidents for an employee
  async getEmployeeIncidents(employeeId: string): Promise<EmployeeIncident[]> {
    const { data, error } = await supabase
      .from('employee_incidents')
      .select(`
        *,
        created_by_user:users!created_by(full_name, email),
        attachments:incident_attachments(
          id,
          file_name,
          file_url,
          file_size,
          mime_type,
          uploaded_by,
          created_at,
          uploaded_by_user:users!uploaded_by(full_name, email)
        )
      `)
      .eq('employee_id', employeeId)
      .order('incident_date', { ascending: false });

    if (error) {
      console.error('Error fetching employee incidents:', error);
      throw error;
    }

    return data || [];
  }

  // Create a new incident
  async createIncident(incidentData: CreateIncidentData): Promise<EmployeeIncident> {
    const { data, error } = await supabase
      .from('employee_incidents')
      .insert([incidentData])
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating incident:', error);
      throw error;
    }

    return data;
  }

  // Update an incident
  async updateIncident(incidentId: string, incidentData: UpdateIncidentData): Promise<EmployeeIncident> {
    const { data, error } = await supabase
      .from('employee_incidents')
      .update(incidentData)
      .eq('id', incidentId)
      .select(`
        *,
        created_by_user:users!created_by(full_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating incident:', error);
      throw error;
    }

    return data;
  }

  // Delete an incident
  async deleteIncident(incidentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // First, get the incident to check if it has an attachment
      const { data: incident } = await supabase
        .from('employee_incidents')
        .select('attachment_file_url, attachment_file_name')
        .eq('id', incidentId)
        .single();

      // Delete the attachment file from storage if it exists
      if (incident?.attachment_file_url && incident?.attachment_file_name) {
        const fileName = incident.attachment_file_name;
        const { error: storageError } = await supabase.storage
          .from('employee-documents')
          .remove([`incidents/${fileName}`]);

        if (storageError) {
          console.warn('Error deleting attachment file:', storageError);
          // Continue with deletion even if file removal fails
        }
      }

      // Delete the incident record
      const { error } = await supabase
        .from('employee_incidents')
        .delete()
        .eq('id', incidentId);

      if (error) {
        console.error('Error deleting incident:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteIncident:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Upload multiple attachments for an incident
  async uploadAttachments(
    incidentId: string, 
    files: File[], 
    employeeId: string, 
    incidentTitle: string,
    uploadedBy: string
  ): Promise<{ success: boolean; error?: string; uploadedCount?: number }> {
    try {
      // Check if adding these files would exceed the 10-file limit
      const { data: existingAttachments } = await supabase
        .from('incident_attachments')
        .select('id')
        .eq('incident_id', incidentId);

      const existingCount = existingAttachments?.length || 0;
      if (existingCount + files.length > 10) {
        return { 
          success: false, 
          error: `Cannot upload ${files.length} files. Maximum 10 attachments per incident (${existingCount} already uploaded)` 
        };
      }

      // Validate file sizes (10MB limit per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      for (const file of files) {
        if (file.size > maxSize) {
          return { success: false, error: `File "${file.name}" is too large. Maximum size is 10MB` };
        }
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

      const sanitizedEmployeeName = employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const sanitizedTitle = incidentTitle.replace(/[^a-zA-Z0-9\s\-_.]/g, '').replace(/\s+/g, '_');
      
      let uploadedCount = 0;
      const uploadPromises = files.map(async (file, index) => {
        try {
          // Generate unique filename with original extension
          const timestamp = Date.now();
          const fileExtension = file.name.split('.').pop() || 'bin';
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9\s\-_.]/g, '').replace(/\s+/g, '_');
          const fileName = `incident_${timestamp}_${index}_${sanitizedFileName}`;
          
          // Create organized file path
          const filePath = `${sanitizedEmployeeName}/incidents/${fileName}`;

          // Upload file to storage
          const { error: uploadError } = await supabase.storage
            .from('employee-documents')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error for file:', file.name, uploadError);
            throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
          }

          // Get the public URL
          const { data: urlData } = supabase.storage
            .from('employee-documents')
            .getPublicUrl(filePath);

          // Insert attachment record
          const { error: insertError } = await supabase
            .from('incident_attachments')
            .insert({
              incident_id: incidentId,
              file_name: fileName,
              file_url: urlData.publicUrl,
              file_size: file.size,
              mime_type: file.type,
              uploaded_by: uploadedBy
            });

          if (insertError) {
            console.error('Insert error for file:', file.name, insertError);
            // Try to clean up the uploaded file
            await supabase.storage.from('employee-documents').remove([filePath]);
            throw new Error(`Failed to save ${file.name}: ${insertError.message}`);
          }

          uploadedCount++;
        } catch (error) {
          console.error('Error uploading file:', file.name, error);
          throw error;
        }
      });

      await Promise.all(uploadPromises);
      return { success: true, uploadedCount };
    } catch (error) {
      console.error('Upload attachments error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed',
        uploadedCount
      };
    }
  }

  // Legacy single file upload method for backward compatibility
  async uploadAttachment(
    incidentId: string, 
    file: File, 
    employeeId: string, 
    incidentTitle: string,
    uploadedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.uploadAttachments(
      incidentId, 
      [file], 
      employeeId, 
      incidentTitle, 
      uploadedBy || employeeId
    );
    return { success: result.success, error: result.error };
  }

  // Remove specific attachment from an incident
  async removeAttachment(attachmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the attachment info
      const { data: attachment, error: fetchError } = await supabase
        .from('incident_attachments')
        .select(`
          *,
          incident:employee_incidents!incident_id(
            employee_id,
            employee:users!employee_id(full_name)
          )
        `)
        .eq('id', attachmentId)
        .single();

      if (fetchError || !attachment) {
        return { success: false, error: 'Attachment not found' };
      }

      // Construct the file path
      const incident = attachment.incident as any;
      const employee = incident.employee as any;
      const sanitizedEmployeeName = employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const fileName = attachment.file_name;
      const filePath = `${sanitizedEmployeeName}/incidents/${fileName}`;

      // Remove file from storage
      const { error: storageError } = await supabase.storage
        .from('employee-documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage error:', storageError);
        // Continue with database deletion even if file removal fails
      }

      // Remove attachment record
      const { error: deleteError } = await supabase
        .from('incident_attachments')
        .delete()
        .eq('id', attachmentId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return { success: false, error: deleteError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Remove attachment error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Removal failed' 
      };
    }
  }

  // Remove all attachments from an incident (legacy method)
  async removeAllAttachments(incidentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get all attachments for this incident
      const { data: attachments, error: fetchError } = await supabase
        .from('incident_attachments')
        .select('id')
        .eq('incident_id', incidentId);

      if (fetchError) {
        return { success: false, error: fetchError.message };
      }

      if (!attachments || attachments.length === 0) {
        return { success: true }; // No attachments to remove
      }

      // Remove each attachment
      for (const attachment of attachments) {
        const result = await this.removeAttachment(attachment.id);
        if (!result.success) {
          console.error('Failed to remove attachment:', attachment.id, result.error);
          // Continue removing other attachments
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Remove all attachments error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Removal failed' 
      };
    }
  }
}

export default new IncidentService();
