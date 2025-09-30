import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export interface WorkExperience {
  id: string;
  employee_id: string;
  employer_name: string;
  verification_status: 'Verified' | 'Not Verified' | 'N/A';
  comments?: string;
  attachment_file_url?: string;
  attachment_file_name?: string;
  attachment_file_size?: number;
  attachment_mime_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkExperienceData {
  employee_id: string;
  employer_name: string;
  verification_status?: 'Verified' | 'Not Verified' | 'N/A';
  comments?: string;
}

export interface UpdateWorkExperienceData {
  employer_name?: string;
  verification_status?: 'Verified' | 'Not Verified' | 'N/A';
  comments?: string;
}

export class WorkExperienceService {
  private static readonly BUCKET_NAME = 'employee-documents';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

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
        error: 'Invalid file type. Please upload PDF, JPG, or PNG files only.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Get all work experience records for an employee
   */
  static async getWorkExperience(employeeId: string): Promise<WorkExperience[]> {
    const { data, error } = await supabase
      .from('employee_work_experience')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new work experience record
   */
  static async createWorkExperience(workExperienceData: CreateWorkExperienceData): Promise<WorkExperience> {
    const { data, error } = await supabase
      .from('employee_work_experience')
      .insert({
        ...workExperienceData,
        verification_status: workExperienceData.verification_status || 'Not Verified'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a work experience record
   */
  static async updateWorkExperience(
    id: string, 
    workExperienceData: UpdateWorkExperienceData
  ): Promise<WorkExperience> {
    const { data, error } = await supabase
      .from('employee_work_experience')
      .update(workExperienceData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a work experience record
   */
  static async deleteWorkExperience(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get work experience info first to delete attachment if exists
      const { data: workExp, error: fetchError } = await supabase
        .from('employee_work_experience')
        .select('attachment_file_url')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Delete attachment from storage if exists
      if (workExp?.attachment_file_url) {
        try {
          // Extract file path from URL
          const url = new URL(workExp.attachment_file_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME);
          
          if (bucketIndex !== -1) {
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
          }
        } catch (storageError) {
          console.error('Failed to delete attachment from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('employee_work_experience')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return { success: true };

    } catch (error: any) {
      console.error('Work experience delete service error:', error);
      return { 
        success: false, 
        error: `Delete failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Upload attachment for work experience
   */
  static async uploadAttachment(
    workExperienceId: string,
    file: File,
    employeeId: string,
    employerName: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
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

      // Generate clean filename
      const sanitizedEmployeeName = employee.full_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const sanitizedEmployerName = employerName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const timestamp = Date.now();
      const uuid = uuidv4().slice(0, 8);
      const extension = file.name.split('.').pop() || 'pdf';
      const fileName = `${sanitizedEmployerName}_verification_${timestamp}_${uuid}.${extension}`;
      
      // Create organized file path
      const filePath = `${sanitizedEmployeeName}/work_experience/${fileName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
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

      // Update work experience record with attachment info
      const { error: updateError } = await supabase
        .from('employee_work_experience')
        .update({
          attachment_file_url: urlData.publicUrl,
          attachment_file_name: file.name,
          attachment_file_size: file.size,
          attachment_mime_type: file.type
        })
        .eq('id', workExperienceId);

      if (updateError) {
        // Clean up uploaded file if database update fails
        await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
        throw updateError;
      }

      return { 
        success: true, 
        url: urlData.publicUrl
      };

    } catch (error: any) {
      console.error('Work experience attachment upload error:', error);
      return { 
        success: false, 
        error: `Upload failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Remove attachment from work experience
   */
  static async removeAttachment(workExperienceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current attachment info
      const { data: workExp, error: fetchError } = await supabase
        .from('employee_work_experience')
        .select('attachment_file_url')
        .eq('id', workExperienceId)
        .single();

      if (fetchError) throw fetchError;

      // Delete file from storage if exists
      if (workExp.attachment_file_url) {
        try {
          const url = new URL(workExp.attachment_file_url);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME);
          
          if (bucketIndex !== -1) {
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
          }
        } catch (storageError) {
          console.error('Failed to delete file from storage:', storageError);
          // Continue with database update even if storage deletion fails
        }
      }

      // Remove attachment info from database
      const { error: updateError } = await supabase
        .from('employee_work_experience')
        .update({
          attachment_file_url: null,
          attachment_file_name: null,
          attachment_file_size: null,
          attachment_mime_type: null
        })
        .eq('id', workExperienceId);

      if (updateError) throw updateError;

      return { success: true };

    } catch (error: any) {
      console.error('Work experience attachment removal error:', error);
      return { 
        success: false, 
        error: `Removal failed: ${error.message || 'Unknown error'}` 
      };
    }
  }
}

export default WorkExperienceService;
