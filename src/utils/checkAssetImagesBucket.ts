import { supabase } from '@/services/supabase';

export async function checkAndCreateAssetImagesBucket() {
  const bucketName = 'asset-condition-images';
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return { success: false, error: listError.message };
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Creating bucket: ${bucketName}`);
      
      // Try to create the bucket - handle RLS errors gracefully
      const { data: createResult, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (createError) {
        // If it's an RLS error, the bucket might need to be created via Supabase Dashboard
        if (createError.message?.includes('row-level security') || createError.message?.includes('policy')) {
          console.warn('Bucket creation requires admin privileges. Please create the bucket manually via Supabase Dashboard.');
          return { 
            success: false, 
            error: 'Bucket creation requires admin privileges. Please create the "asset-condition-images" bucket manually via Supabase Dashboard with public access.' 
          };
        }
        
        console.error('Error creating bucket:', createError);
        return { success: false, error: createError.message };
      }

      console.log('Bucket created successfully:', createResult);
    } else {
      console.log(`Bucket ${bucketName} already exists`);
    }

    // Test bucket access by trying to list files (only if bucket exists)
    const { data: buckets2 } = await supabase.storage.listBuckets();
    const bucketStillExists = buckets2?.some(bucket => bucket.name === bucketName);
    
    if (bucketStillExists) {
      const { data: files, error: listFilesError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });

      if (listFilesError) {
        console.error('Error accessing bucket:', listFilesError);
        // Don't fail completely if we can't list files - the bucket might still work for uploads
        console.warn('Bucket exists but may have access restrictions');
      }
    }

    return { success: true, bucketExists: bucketStillExists || bucketExists };
    
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

// Function to test image URL accessibility
export async function testImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
