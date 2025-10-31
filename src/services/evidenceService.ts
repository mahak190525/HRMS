import { supabase } from './supabase';

export interface EvidenceFile {
  id: string;
  assignment_id: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  folder_path: string;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface UploadEvidenceParams {
  assignmentId: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  file: File;
  employeeName: string;
  templateName: string;
}

export interface EvidenceUploadResult {
  success: boolean;
  file?: EvidenceFile;
  error?: string;
  filePath?: string;
}

/**
 * Generate folder path for evidence files
 */
export function generateFolderPath(employeeName: string, templateName: string, quarter: string): string {
  const sanitizedEmployeeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedTemplateName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${sanitizedEmployeeName}/${sanitizedTemplateName}_${quarter}`;
}

/**
 * Generate unique filename with timestamp
 */
export function generateUniqueFileName(originalName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileExtension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}_${timestamp}.${fileExtension}`;
}

/**
 * Upload evidence file to Supabase Storage
 */
export async function uploadEvidenceFile({
  assignmentId,
  quarter,
  file,
  employeeName,
  templateName
}: UploadEvidenceParams): Promise<EvidenceUploadResult> {
  try {
    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File size exceeds 10MB limit'
      };
    }

    // Validate file type
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'File type not supported'
      };
    }

    // Check if user has reached the 5-file limit for this quarter
    const { data: existingFiles, error: countError } = await supabase
      .from('kra_evidence_files')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('quarter', quarter);

    if (countError) {
      return {
        success: false,
        error: 'Failed to check existing files'
      };
    }

    if (existingFiles && existingFiles.length >= 5) {
      return {
        success: false,
        error: 'Maximum 5 files allowed per quarter'
      };
    }

    // Generate paths
    const folderPath = generateFolderPath(employeeName, templateName, quarter);
    const fileName = generateUniqueFileName(file.name);
    const filePath = `${folderPath}/${fileName}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('KRA-evidence')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return {
        success: false,
        error: uploadError.message
      };
    }

    // Save file metadata to database
    const { data: fileData, error: dbError } = await supabase
      .from('kra_evidence_files')
      .insert({
        assignment_id: assignmentId,
        quarter: quarter,
        file_name: fileName,
        original_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        folder_path: folderPath
      })
      .select()
      .single();

    if (dbError) {
      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from('KRA-evidence')
        .remove([filePath]);

      return {
        success: false,
        error: dbError.message
      };
    }

    return {
      success: true,
      file: fileData,
      filePath: uploadData.path
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Get evidence files for a specific assignment and quarter
 */
export async function getEvidenceFiles(
  assignmentId: string, 
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4'
): Promise<{ data: EvidenceFile[] | null; error: any }> {
  let query = supabase
    .from('kra_evidence_files')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('uploaded_at', { ascending: false });

  if (quarter) {
    query = query.eq('quarter', quarter);
  }

  return await query;
}

/**
 * Delete evidence file
 */
export async function deleteEvidenceFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First get the file info
    const { data: fileData, error: fetchError } = await supabase
      .from('kra_evidence_files')
      .select('file_path')
      .eq('id', fileId)
      .single();

    if (fetchError || !fileData) {
      return {
        success: false,
        error: 'File not found'
      };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('KRA-evidence')
      .remove([fileData.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('kra_evidence_files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      return {
        success: false,
        error: dbError.message
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    };
  }
}

/**
 * Get download URL for evidence file
 */
export async function getEvidenceFileUrl(filePath: string): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('KRA-evidence')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      return {
        url: null,
        error: error.message
      };
    }

    return {
      url: data.signedUrl
    };

  } catch (error) {
    console.error('URL generation error:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to generate URL'
    };
  }
}

/**
 * Get evidence file statistics for an assignment
 */
export async function getEvidenceStats(assignmentId: string): Promise<{
  q1_count: number;
  q2_count: number;
  q3_count: number;
  q4_count: number;
  total_count: number;
  total_size: number;
}> {
  try {
    const { data, error } = await supabase
      .from('kra_evidence_files')
      .select('quarter, file_size')
      .eq('assignment_id', assignmentId);

    if (error || !data) {
      return {
        q1_count: 0,
        q2_count: 0,
        q3_count: 0,
        q4_count: 0,
        total_count: 0,
        total_size: 0
      };
    }

    const stats = {
      q1_count: 0,
      q2_count: 0,
      q3_count: 0,
      q4_count: 0,
      total_count: data.length,
      total_size: 0
    };

    data.forEach(file => {
      stats.total_size += file.file_size;
      switch (file.quarter) {
        case 'Q1':
          stats.q1_count++;
          break;
        case 'Q2':
          stats.q2_count++;
          break;
        case 'Q3':
          stats.q3_count++;
          break;
        case 'Q4':
          stats.q4_count++;
          break;
      }
    });

    return stats;

  } catch (error) {
    console.error('Stats error:', error);
    return {
      q1_count: 0,
      q2_count: 0,
      q3_count: 0,
      q4_count: 0,
      total_count: 0,
      total_size: 0
    };
  }
}
