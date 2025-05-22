import { createClient } from '@/utils/supabase/server';

/**
 * Initialize Supabase storage buckets
 * This function creates necessary buckets if they don't exist
 */
export async function initializeSupabaseStorage() {
  try {
    console.log('Initializing Supabase storage buckets...');
    const supabase = await createClient();

    // Create the machines bucket if it doesn't exist
    const { data: machinesBucket, error: machinesBucketError } = await supabase.storage
      .getBucket('machines');

    if (machinesBucketError && machinesBucketError.message.includes('The resource was not found')) {
      console.log('Creating machines bucket...');
      const { error: createError } = await supabase.storage.createBucket('machines', {
        public: true, // Make the bucket public so we can access images without authentication
        fileSizeLimit: 10485760, // 10MB limit
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif']
      });

      if (createError) {
        console.error('Error creating machines bucket:', createError);
      } else {
        console.log('Machines bucket created successfully');
      }
    } else if (machinesBucketError) {
      console.error('Error checking machines bucket:', machinesBucketError);
    } else {
      console.log('Machines bucket already exists');
    }

    // Update bucket to be public if it exists but isn't public
    if (!machinesBucketError && machinesBucket) {
      if (!machinesBucket.public) {
        console.log('Updating machines bucket to be public...');
        const { error: updateError } = await supabase.storage.updateBucket('machines', {
          public: true,
          fileSizeLimit: 10485760, // 10MB limit
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif']
        });

        if (updateError) {
          console.error('Error updating machines bucket:', updateError);
        } else {
          console.log('Machines bucket updated to be public');
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error initializing Supabase storage:', error);
    return { success: false, error };
  }
} 