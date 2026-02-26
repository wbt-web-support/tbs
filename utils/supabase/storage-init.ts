import { createClient } from '@/utils/supabase/server';

/**
 * Initialize Supabase storage buckets
 * This function creates necessary buckets if they don't exist
 */
export async function initializeSupabaseStorage() {
  try {
    const supabase = await createClient();

    // Create the machines bucket if it doesn't exist
    const { data: machinesBucket, error: machinesBucketError } = await supabase.storage
      .getBucket('machines');

    if (machinesBucketError && machinesBucketError.message.includes('The resource was not found')) {
      // Bucket doesn't exist, create it
      const { error: createError } = await supabase.storage.createBucket('machines', {
        public: true, // Make the bucket public so we can access images without authentication
        fileSizeLimit: 10485760, // 10MB limit
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif']
      });

      if (createError) {
        // Only log this error once, not on every page load
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not create machines bucket:', createError.message);
        }
        return { success: false, error: createError };
      }
    } else if (machinesBucketError) {
      // Only log unexpected errors in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Storage bucket check failed:', machinesBucketError.message);
      }
      return { success: false, error: machinesBucketError };
    }

    // Update bucket to be public if it exists but isn't public
    if (!machinesBucketError && machinesBucket) {
      if (!machinesBucket.public) {
        const { error: updateError } = await supabase.storage.updateBucket('machines', {
          public: true,
          fileSizeLimit: 10485760, // 10MB limit
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif']
        });

        if (updateError && process.env.NODE_ENV === 'development') {
          console.warn('Could not update machines bucket:', updateError.message);
        }
      }
    }

    // Create business-plan-docs bucket if it doesn't exist (PDF, DOC, DOCX, TXT)
    const bucketName = 'business-plan-docs';
    const { data: bpBucket, error: bpBucketError } = await supabase.storage.getBucket(bucketName);
    if (bpBucketError && bpBucketError.message.includes('The resource was not found')) {
      const { error: createBpError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ]
      });
      if (createBpError && process.env.NODE_ENV === 'development') {
        console.warn('Could not create business-plan-docs bucket:', createBpError.message);
      }
    }

    // Create database-backups bucket (private) for superadmin backups
    const backupBucketName = 'database-backups';
    const { error: backupBucketError } = await supabase.storage.getBucket(backupBucketName);
    if (backupBucketError && backupBucketError.message.includes('The resource was not found')) {
      const { error: createBackupError } = await supabase.storage.createBucket(backupBucketName, {
        public: false,
        fileSizeLimit: 524288000, // 500MB for backup bundles
      });
      if (createBackupError && process.env.NODE_ENV === 'development') {
        console.warn('Could not create database-backups bucket:', createBackupError.message);
      }
    }

    return { success: true };
  } catch (error) {
    // Only log in development to avoid console spam in production
    if (process.env.NODE_ENV === 'development') {
      console.warn('Storage initialization failed:', error);
    }
    return { success: false, error };
  }
} 