import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// No user context needed since RLS is disabled and we validate at application level

export class AssetImageUploadService {
  private static readonly BUCKET_NAME = 'asset-condition-images';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_IMAGES_PER_QUARTER = 5;
  private static readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  /**
   * Validates if the image file is acceptable for upload
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        error: `Image size must be less than ${this.MAX_FILE_SIZE / 1024 / 1024}MB` 
      };
    }

    if (!this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { 
        isValid: false, 
        error: 'Invalid image type. Please upload JPEG, JPG, PNG, or WebP images only.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Generates a unique filename for asset condition images
   */
  static generateUniqueImageName(
    originalFileName: string, 
    assetTag: string, 
    quarter: number, 
    year: number
  ): string {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0]; // First segment of UUID for brevity
    const extension = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Clean the asset tag to be filename-safe
    const cleanAssetTag = assetTag
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    return `${cleanAssetTag}_Q${quarter}_${year}_${timestamp}_${uuid}.${extension}`;
  }

  /**
   * Gets current quarter and year
   */
  static getCurrentQuarterAndYear(): { quarter: number; year: number } {
    const now = new Date();
    const quarter = Math.floor((now.getMonth() + 3) / 3);
    const year = now.getFullYear();
    return { quarter, year };
  }

  /**
   * Check if user can upload more images for current quarter
   */
  static async checkUploadEligibility(
    assetAssignmentId: string, 
    userId: string
  ): Promise<{ canUpload: boolean; currentCount: number; maxAllowed: number; error?: string }> {
    try {
      // Validate permissions using the server-side function
      const { data: validationResult, error: validationError } = await supabase
        .rpc('validate_asset_image_permission', {
          p_user_id: userId,
          p_assignment_id: assetAssignmentId,
          p_operation: 'upload'
        });

      if (validationError) {
        console.error('Validation error:', validationError);
        return { 
          canUpload: false, 
          currentCount: 0, 
          maxAllowed: this.MAX_IMAGES_PER_QUARTER,
          error: 'Failed to validate permissions' 
        };
      }

      const validation = validationResult?.[0];
      if (!validation?.is_allowed) {
        return { 
          canUpload: false, 
          currentCount: 0, 
          maxAllowed: this.MAX_IMAGES_PER_QUARTER,
          error: validation?.error_message || 'Permission denied' 
        };
      }

      // Check quarterly upload limits
      const { data: limitResult, error: limitError } = await supabase
        .rpc('check_quarterly_upload_limit', {
          p_assignment_id: assetAssignmentId
        });

      if (limitError) {
        console.error('Limit check error:', limitError);
        return { 
          canUpload: false, 
          currentCount: 0, 
          maxAllowed: this.MAX_IMAGES_PER_QUARTER,
          error: 'Failed to check upload limits' 
        };
      }

      const limits = limitResult?.[0];
      const currentCount = limits?.current_count || 0;
      const maxAllowed = limits?.max_allowed || this.MAX_IMAGES_PER_QUARTER;
      const canUpload = limits?.can_upload_more || false;

      return { 
        canUpload, 
        currentCount, 
        maxAllowed,
        error: canUpload ? undefined : `Upload limit reached (${currentCount}/${maxAllowed} images this quarter)`
      };

    } catch (error: any) {
      console.error('Error checking upload eligibility:', error);
      return { 
        canUpload: false, 
        currentCount: 0, 
        maxAllowed: this.MAX_IMAGES_PER_QUARTER,
        error: `Failed to check eligibility: ${error.message}` 
      };
    }
  }

  /**
   * Uploads asset condition images to Supabase storage
   */
  static async uploadAssetImages(
    files: File[],
    assetAssignmentId: string,
    userId: string
  ): Promise<{ success: boolean; uploadedImages?: any[]; errors?: string[]; error?: string }> {
    try {
      if (!files || files.length === 0) {
        return { success: false, error: 'No files provided' };
      }

      // Check upload eligibility first
      const eligibility = await this.checkUploadEligibility(assetAssignmentId, userId);
      if (!eligibility.canUpload) {
        return { success: false, error: eligibility.error || 'Upload not allowed' };
      }

      // Check if adding these files would exceed the limit
      if (eligibility.currentCount + files.length > this.MAX_IMAGES_PER_QUARTER) {
        return { 
          success: false, 
          error: `Cannot upload ${files.length} images. Maximum ${this.MAX_IMAGES_PER_QUARTER} images per quarter. You have already uploaded ${eligibility.currentCount}.` 
        };
      }

      // Get asset details for filename generation
      const { data: assignment, error: assignmentError } = await supabase
        .from('asset_assignments')
        .select(`
          asset:assets(asset_tag, id)
        `)
        .eq('id', assetAssignmentId)
        .single();

      if (assignmentError || !assignment?.asset) {
        return { success: false, error: 'Failed to get asset details' };
      }

      const { quarter, year } = this.getCurrentQuarterAndYear();
      const uploadedImages: any[] = [];
      const errors: string[] = [];

      // Process each file
      for (const file of files) {
        try {
          // Validate file
          const validation = this.validateImageFile(file);
          if (!validation.isValid) {
            errors.push(`${file.name}: ${validation.error}`);
            continue;
          }

          // Generate unique filename
          const uniqueFileName = this.generateUniqueImageName(
            file.name, 
            assignment.asset.asset_tag, 
            quarter, 
            year
          );
          
          // Create organized file path
          const filePath = `${assignment.asset.asset_tag}/Q${quarter}_${year}/${uniqueFileName}`;

          // Upload to Supabase storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(this.BUCKET_NAME)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            errors.push(`${file.name}: Upload failed - ${uploadError.message}`);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from(this.BUCKET_NAME)
            .getPublicUrl(filePath);

          console.log('Generated public URL:', urlData);

          if (!urlData?.publicUrl) {
            errors.push(`${file.name}: Failed to generate public URL`);
            continue;
          }

          // Test if the URL is accessible (simple check)
          console.log(`Public URL for ${file.name}: ${urlData.publicUrl}`);

          // Save record to database
          const { data: imageRecord, error: dbError } = await supabase
            .from('asset_condition_images')
            .insert({
              asset_assignment_id: assetAssignmentId,
              asset_id: assignment.asset.id,
              user_id: userId,
              image_url: urlData.publicUrl,
              upload_quarter: quarter,
              upload_year: year,
              image_size_bytes: file.size,
              image_filename: uniqueFileName
            })
            .select()
            .single();

          if (dbError) {
            console.error('Database error:', dbError);
            errors.push(`${file.name}: Failed to save record - ${dbError.message}`);
            
            // Try to cleanup uploaded file
            await supabase.storage
              .from(this.BUCKET_NAME)
              .remove([filePath]);
            continue;
          }

          uploadedImages.push({
            ...imageRecord,
            originalFileName: file.name
          });

        } catch (error: any) {
          console.error('Error processing file:', file.name, error);
          errors.push(`${file.name}: ${error.message || 'Unknown error'}`);
        }
      }

      // Determine overall success
      const hasSuccesses = uploadedImages.length > 0;
      const hasErrors = errors.length > 0;

      if (hasSuccesses && !hasErrors) {
        return { success: true, uploadedImages };
      } else if (hasSuccesses && hasErrors) {
        return { success: true, uploadedImages, errors };
      } else {
        return { success: false, errors, error: 'All uploads failed' };
      }

    } catch (error: any) {
      console.error('Asset image upload service error:', error);
      return { 
        success: false, 
        error: `Upload failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Get asset condition images for a specific assignment and quarter
   */
  // static async getAssetImages(
  //   assetAssignmentId: string, 
  //   quarter?: number, 
  //   year?: number
  // ): Promise<{ success: boolean; images?: any[]; error?: string }> {
  //   try {
  //     const currentQuarterYear = this.getCurrentQuarterAndYear();
  //     const queryQuarter = quarter || currentQuarterYear.quarter;
  //     const queryYear = year || currentQuarterYear.year;

  //     const { data, error } = await supabase
  //       .from('asset_condition_images')
  //       .select(`
  //         *,
  //         asset:assets(name, asset_tag),
  //         user:users(full_name)
  //       `)
  //       .eq('asset_assignment_id', assetAssignmentId)
  //       .eq('upload_quarter', queryQuarter)
  //       .eq('upload_year', queryYear)
  //       .order('uploaded_at', { ascending: false });

  //     if (error) {
  //       return { success: false, error: error.message };
  //     }

  //     // Process image URLs - check if they're already complete URLs or just file paths
  //     const imagesWithValidUrls = (data || []).map((image) => {
  //       try {
  //         console.log(`Processing image ${image.id}: Original URL = ${image.image_url}`);
          
  //         // Check if the stored URL is already a complete URL (starts with http)
  //         if (image.image_url && (image.image_url.startsWith('http://') || image.image_url.startsWith('https://'))) {
  //           // Already a complete URL, use as-is
  //           console.log(`Image ${image.id}: Using existing complete URL`);
  //           return image;
  //         } else {
  //           // It's a file path, generate a public URL
  //           console.log(`Image ${image.id}: Generating public URL from path: ${image.image_url}`);
  //           const { data: publicUrlData } = supabase.storage
  //             .from(this.BUCKET_NAME)
  //             .getPublicUrl(image.image_url);

  //           const finalUrl = publicUrlData?.publicUrl || image.image_url;
  //           console.log(`Image ${image.id}: Generated URL = ${finalUrl}`);

  //           return {
  //             ...image,
  //             image_url: finalUrl
  //           };
  //         }
  //       } catch (urlError) {
  //         console.error(`Failed to process URL for image ${image.id}:`, urlError);
  //         return image; // Return original if URL processing fails
  //       }
  //     });

  //     return { success: true, images: imagesWithValidUrls };

  //   } catch (error: any) {
  //     console.error('Error fetching asset images:', error);
  //     return { 
  //       success: false, 
  //       error: `Failed to fetch images: ${error.message}` 
  //     };
  //   }
  // }

  static async getAssetImages(
    assetAssignmentId: string, 
    quarter?: number, 
    year?: number
  ): Promise<{ success: boolean; images?: any[]; error?: string }> {
    try {
      const currentQuarterYear = this.getCurrentQuarterAndYear();
      const queryQuarter = quarter || currentQuarterYear.quarter;
      const queryYear = year || currentQuarterYear.year;
  
      const { data, error } = await supabase
        .from('asset_condition_images')
        .select(`
          *,
          asset:assets(name, asset_tag),
          user:users(full_name)
        `)
        .eq('asset_assignment_id', assetAssignmentId)
        .eq('upload_quarter', queryQuarter)
        .eq('upload_year', queryYear)
        .order('uploaded_at', { ascending: false });
  
      if (error) {
        return { success: false, error: error.message };
      }
  
      return { success: true, images: data || [] };
  
    } catch (error: any) {
      console.error('Error fetching asset images:', error);
      return { 
        success: false, 
        error: `Failed to fetch images: ${error.message}` 
      };
    }
  };
  
  /**
   * Delete an asset condition image
   */
  static async deleteAssetImage(
    imageId: string, 
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get image details first
      const { data: imageRecord, error: fetchError } = await supabase
        .from('asset_condition_images')
        .select('*')
        .eq('id', imageId)
        .eq('user_id', userId) // Ensure user owns this image
        .single();

      if (fetchError || !imageRecord) {
        return { success: false, error: 'Image not found or access denied' };
      }

      // Extract file path from URL
      const url = new URL(imageRecord.image_url);
      const filePath = url.pathname.split(`/${this.BUCKET_NAME}/`)[1];

      if (!filePath) {
        return { success: false, error: 'Invalid image URL format' };
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('asset_condition_images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', userId);

      if (dbError) {
        return { success: false, error: `Failed to delete record: ${dbError.message}` };
      }

      return { success: true };

    } catch (error: any) {
      console.error('Error deleting asset image:', error);
      return { 
        success: false, 
        error: `Delete failed: ${error.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Get users who need to upload quarterly images (for notifications)
   */
  static async getUsersNeedingQuarterlyUpload(): Promise<{ success: boolean; users?: any[]; error?: string }> {
    try {
      const { quarter, year } = this.getCurrentQuarterAndYear();

      // Get active hardware asset assignments with missing images
      const { data, error } = await supabase.rpc('check_quarterly_upload_needed_all_users', {
        p_quarter: quarter,
        p_year: year
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, users: data || [] };

    } catch (error: any) {
      console.error('Error getting users needing upload:', error);
      return { 
        success: false, 
        error: `Failed to get users: ${error.message}` 
      };
    }
  }
}
