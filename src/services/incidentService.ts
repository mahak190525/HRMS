import { supabase } from './supabase';

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
        created_by_user:users!created_by(full_name, email)
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

  // Upload attachment for an incident
  async uploadAttachment(
    incidentId: string, 
    file: File, 
    employeeId: string, 
    incidentTitle: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate file type
      if (file.type !== 'application/pdf') {
        return { success: false, error: 'Only PDF files are allowed' };
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return { success: false, error: 'File size must be less than 10MB' };
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

      // Generate clean filename using same pattern as work experience
      const sanitizedEmployeeName = employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const sanitizedTitle = incidentTitle.replace(/[^a-zA-Z0-9\s\-_.]/g, '').replace(/\s+/g, '_');
      const timestamp = Date.now();
      const fileName = `incident_${timestamp}_${sanitizedTitle}.pdf`;
      
      // Create organized file path following employee document structure
      const filePath = `${sanitizedEmployeeName}/incidents/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return { success: false, error: uploadError.message };
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(filePath);

      // Update the incident with attachment info
      const { error: updateError } = await supabase
        .from('employee_incidents')
        .update({
          attachment_file_url: urlData.publicUrl,
          attachment_file_name: fileName,
          attachment_file_size: file.size,
          attachment_mime_type: file.type
        })
        .eq('id', incidentId);

      if (updateError) {
        console.error('Update error:', updateError);
        // Try to clean up the uploaded file
        await supabase.storage.from('employee-documents').remove([filePath]);
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Upload attachment error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  // Remove attachment from an incident
  async removeAttachment(incidentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the current attachment info and employee info
      const { data: incident } = await supabase
        .from('employee_incidents')
        .select(`
          attachment_file_url, 
          attachment_file_name,
          employee_id,
          employee:users!employee_id(full_name)
        `)
        .eq('id', incidentId)
        .single();

      if (!incident?.attachment_file_url || !incident?.attachment_file_name) {
        return { success: false, error: 'No attachment found' };
      }

      // Construct the correct file path
      const employee = incident.employee as any;
      const sanitizedEmployeeName = employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const fileName = incident.attachment_file_name;
      const filePath = `${sanitizedEmployeeName}/incidents/${fileName}`;

      // Remove file from storage
      const { error: storageError } = await supabase.storage
        .from('employee-documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage error:', storageError);
        return { success: false, error: storageError.message };
      }

      // Update the incident to remove attachment info
      const { error: updateError } = await supabase
        .from('employee_incidents')
        .update({
          attachment_file_url: null,
          attachment_file_name: null,
          attachment_file_size: null,
          attachment_mime_type: null
        })
        .eq('id', incidentId);

      if (updateError) {
        console.error('Update error:', updateError);
        return { success: false, error: updateError.message };
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
}

export default new IncidentService();
