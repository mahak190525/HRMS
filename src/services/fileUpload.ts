import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export class FileUploadService {
  private static readonly BUCKET_NAME = 'referral-resumes';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png'
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
        error: 'Invalid file type. Please upload PDF, DOC, DOCX, TXT, JPEG, or PNG files only.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Generates a unique filename to prevent overwriting
   */
  static generateUniqueFileName(originalFileName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().slice(0, 8); // Short UUID for readability
    const extension = originalFileName.split('.').pop() || '';
    const nameWithoutExtension = originalFileName.split('.').slice(0, -1).join('.');
    
    // Clean the filename to remove special characters
    const cleanName = nameWithoutExtension
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    return `${cleanName}_${timestamp}_${uuid}.${extension}`;
  }

  /**
   * Uploads a resume file to Supabase storage
   */
  static async uploadResume(
    file: File, 
    candidateName: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Generate unique filename
      const uniqueFileName = this.generateUniqueFileName(file.name);
      
      // Create file path with candidate name prefix for organization
      const cleanCandidateName = candidateName
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      const filePath = `${cleanCandidateName}/${uniqueFileName}`;

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false // Prevent overwriting
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

      return { 
        success: true, 
        url: urlData.publicUrl 
      };

    } catch (error: any) {
      console.error('File upload service error:', error);
      return { 
        success: false, 
        error: `Upload failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Deletes a resume file from Supabase storage
   */
  static async deleteResume(resumeUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract file path from URL
      const url = new URL(resumeUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME);
      
      if (bucketIndex === -1) {
        return { success: false, error: 'Invalid resume URL format' };
      }

      const filePath = pathParts.slice(bucketIndex + 1).join('/');

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        return { success: false, error: `Delete failed: ${error.message}` };
      }

      return { success: true };

    } catch (error: any) {
      console.error('File delete service error:', error);
      return { success: false, error: `Delete failed: ${error.message || 'Unknown error'}` };
    }
  }

  /**
   * Gets file metadata from Supabase storage
   */
  static async getFileMetadata(resumeUrl: string): Promise<{ 
    success: boolean; 
    metadata?: any; 
    error?: string 
  }> {
    try {
      const url = new URL(resumeUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === this.BUCKET_NAME);
      
      if (bucketIndex === -1) {
        return { success: false, error: 'Invalid resume URL format' };
      }

      const filePath = pathParts.slice(bucketIndex + 1).join('/');

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()
        });

      if (error) {
        return { success: false, error: error.message };
      }

      const fileInfo = data?.find(file => file.name === filePath.split('/').pop());
      
      return { 
        success: true, 
        metadata: fileInfo 
      };

    } catch (error: any) {
      console.error('File metadata service error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
}

export default FileUploadService;
