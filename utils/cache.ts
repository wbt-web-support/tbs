import { createClient } from "@/utils/supabase/server";

// Cache configuration
const CACHE_CONFIG = {
  DATA_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  AI_DASHBOARD_REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes for AI dashboard
  MAX_CACHE_SIZE: 1000, // Maximum number of users to cache
};

// Persistent cache using Supabase
const serverCache = {
  async getGlobalInstructions(fetchFn: () => Promise<any>) {
    try {
      const supabase = await createClient();
      const cacheKey = 'global_instructions';
      const now = new Date();
      
      // Try to get from cache first
      const { data: cachedData } = await supabase
        .from('app_cache')
        .select('data, expires_at')
        .eq('cache_key', cacheKey)
        .eq('cache_type', 'global_instructions')
        .single();

      if (cachedData && new Date(cachedData.expires_at) > now) {
        console.log('📦 [Cache] Using cached global instructions');
        console.log('⏰ [Cache] Cache expires at:', cachedData.expires_at);
        return cachedData.data;
      }

      // Fetch fresh data
      console.log('🔄 [Cache] Fetching fresh global instructions');
      const freshData = await fetchFn();
      const expiresAt = new Date(now.getTime() + CACHE_CONFIG.DATA_REFRESH_INTERVAL);

      // Store in cache
      await supabase
        .from('app_cache')
        .upsert({
          cache_key: cacheKey,
          cache_type: 'global_instructions',
          data: freshData,
          expires_at: expiresAt.toISOString()
        });

      console.log('✅ [Cache] Global instructions cached successfully');
      return freshData;
    } catch (error) {
      console.error('❌ [Cache] Error with global instructions cache:', error);
      // Fallback to direct fetch
      return await fetchFn();
    }
  },
  
  async getUserData(userId: string, fetchFn: (userId: string) => Promise<any>, forceRefresh = false) {
    if (!userId) {
      console.log('⚠️ [Cache] No userId provided for getUserData');
      return null;
    }

    try {
      const supabase = await createClient();
      const cacheKey = `user_data_${userId}`;
      const now = new Date();
      
      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const { data: cachedData } = await supabase
          .from('app_cache')
          .select('data, expires_at')
          .eq('cache_key', cacheKey)
          .eq('cache_type', 'user_data')
          .eq('user_id', userId)
          .single();

        if (cachedData && new Date(cachedData.expires_at) > now) {
          console.log(`📦 [Cache] Using cached data for user: ${userId}`);
          console.log('⏰ [Cache] Cache expires at:', cachedData.expires_at);
          return cachedData.data;
        }
      }

      // Fetch fresh data
      console.log(`🔄 [Cache] ${forceRefresh ? 'Force refreshing' : 'Fetching fresh'} user data for: ${userId}`);
      const freshData = await fetchFn(userId);
      const expiresAt = new Date(now.getTime() + CACHE_CONFIG.DATA_REFRESH_INTERVAL);

      // If force refresh, delete existing cache first to ensure clean replacement
      if (forceRefresh) {
        console.log(`🗑️ [Cache] Force refresh - deleting existing user data cache for user: ${userId}`);
        await supabase
          .from('app_cache')
          .delete()
          .eq('cache_key', cacheKey)
          .eq('cache_type', 'user_data')
          .eq('user_id', userId);
      }

      // Store fresh data in cache using upsert to handle duplicates
      const { error: upsertError } = await supabase
        .from('app_cache')
        .upsert({
          cache_key: cacheKey,
          user_id: userId,
          cache_type: 'user_data',
          data: freshData,
          expires_at: expiresAt.toISOString()
        });

      if (upsertError) {
        console.error('❌ [Cache] Error upserting user data cache:', upsertError);
      }

      console.log('✅ [Cache] User data cached successfully');
      return freshData;
    } catch (error) {
      console.error('❌ [Cache] Error with user data cache:', error);
      // Fallback to direct fetch
      return await fetchFn(userId);
    }
  },

  async getAiDashboardData(userId: string, fetchFn: (userId: string) => Promise<any>, forceRefresh = false) {
    if (!userId) {
      console.log('⚠️ [Cache] No userId provided for getAiDashboardData');
      return null;
    }

    try {
      const supabase = await createClient();
      const cacheKey = `ai_dashboard_${userId}`;
      const now = new Date();
      
      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const { data: cachedData } = await supabase
          .from('app_cache')
          .select('data, expires_at, created_at')
          .eq('cache_key', cacheKey)
          .eq('cache_type', 'ai_dashboard')
          .eq('user_id', userId)
          .single();

        if (cachedData && new Date(cachedData.expires_at) > now) {
          console.log(`📦 [AI Dashboard Cache] Using cached AI dashboard data for user: ${userId}`);
          console.log('⏰ [AI Dashboard Cache] Cache expires at:', cachedData.expires_at);
          
          // Update nextUpdate time in the cached data
          const nextUpdate = cachedData.expires_at;
          return {
            ...cachedData.data,
            timestamp: cachedData.created_at,
            nextUpdate: nextUpdate
          };
        }
      }

      // Fetch fresh data
      console.log(`🔄 [AI Dashboard Cache] ${forceRefresh ? 'Force refreshing' : 'Fetching fresh'} AI dashboard data for: ${userId}`);
      const freshData = await fetchFn(userId);
      const expiresAt = new Date(now.getTime() + CACHE_CONFIG.AI_DASHBOARD_REFRESH_INTERVAL);
      
      // Add timestamp to the data
      const dataWithTimestamp = {
        ...freshData,
        timestamp: now.toISOString(),
        nextUpdate: expiresAt.toISOString()
      };

      // If force refresh, delete existing cache first to ensure clean replacement
      if (forceRefresh) {
        console.log(`🗑️ [AI Dashboard Cache] Force refresh - deleting existing cache for user: ${userId}`);
        const { error: deleteError } = await supabase
          .from('app_cache')
          .delete()
          .eq('cache_key', cacheKey)
          .eq('cache_type', 'ai_dashboard')
          .eq('user_id', userId);
          
        if (deleteError) {
          console.error('❌ [AI Dashboard Cache] Error deleting old cache:', deleteError);
        } else {
          console.log('✅ [AI Dashboard Cache] Old cache deleted successfully');
        }
      }

      // Store fresh data in cache
      console.log(`💾 [AI Dashboard Cache] Storing fresh data in cache for user: ${userId}`);
      const { error: insertError } = await supabase
        .from('app_cache')
        .insert({
          cache_key: cacheKey,
          user_id: userId,
          cache_type: 'ai_dashboard',
          data: dataWithTimestamp,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) {
        console.error('❌ [AI Dashboard Cache] Error inserting cache data:', insertError);
        console.log('🔄 [AI Dashboard Cache] Trying upsert as fallback...');
        const { error: upsertError } = await supabase
          .from('app_cache')
          .upsert({
            cache_key: cacheKey,
            user_id: userId,
            cache_type: 'ai_dashboard',
            data: dataWithTimestamp,
            expires_at: expiresAt.toISOString()
          });
          
        if (upsertError) {
          console.error('❌ [AI Dashboard Cache] Upsert also failed:', upsertError);
          throw new Error(`Failed to cache data: ${upsertError.message}`);
        } else {
          console.log('✅ [AI Dashboard Cache] Data cached successfully via upsert');
        }
      } else {
        console.log('✅ [AI Dashboard Cache] Data cached successfully via insert');
      }

      return dataWithTimestamp;
    } catch (error) {
      console.error('❌ [AI Dashboard Cache] Error with dashboard cache:', error);
      // Fallback to direct fetch
      const fallbackData = await fetchFn(userId);
      return {
        ...fallbackData,
        timestamp: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + CACHE_CONFIG.AI_DASHBOARD_REFRESH_INTERVAL).toISOString()
      };
    }
  },

  // Check if cached AI dashboard data exists without generating fresh data
  async checkAiDashboardCache(userId: string) {
    if (!userId) {
      console.log('⚠️ [Cache] No userId provided for checkAiDashboardCache');
      return null;
    }

    try {
      const supabase = await createClient();
      const cacheKey = `ai_dashboard_${userId}`;
      const now = new Date();
      
      const { data: cachedData } = await supabase
        .from('app_cache')
        .select('data, expires_at, created_at')
        .eq('cache_key', cacheKey)
        .eq('cache_type', 'ai_dashboard')
        .eq('user_id', userId)
        .single();

      if (cachedData && new Date(cachedData.expires_at) > now) {
        console.log(`📦 [AI Dashboard Cache] Found valid cached data for user: ${userId}`);
        console.log('⏰ [AI Dashboard Cache] Cache expires at:', cachedData.expires_at);
        
        // Return cached data with timestamp info
        return {
          ...cachedData.data,
          timestamp: cachedData.created_at,
          nextUpdate: cachedData.expires_at
        };
      }

      console.log(`❌ [AI Dashboard Cache] No valid cached data found for user: ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ [AI Dashboard Cache] Error checking cache:', error);
      return null;
    }
  },
  
  async invalidateUser(userId: string) {
    try {
      const supabase = await createClient();
      
      console.log(`🗑️ [Cache] Invalidating cache for user: ${userId}`);
      await supabase
        .from('app_cache')
        .delete()
        .eq('user_id', userId);
        
      console.log('✅ [Cache] User cache invalidated successfully');
    } catch (error) {
      console.error('❌ [Cache] Error invalidating user cache:', error);
    }
  },
  
  async invalidateAiDashboard(userId: string) {
    try {
      const supabase = await createClient();
      
      console.log(`🗑️ [AI Dashboard Cache] Invalidating AI dashboard cache for user: ${userId}`);
      await supabase
        .from('app_cache')
        .delete()
        .eq('user_id', userId)
        .eq('cache_type', 'ai_dashboard');
        
      console.log('✅ [AI Dashboard Cache] Dashboard cache invalidated successfully');
    } catch (error) {
      console.error('❌ [AI Dashboard Cache] Error invalidating dashboard cache:', error);
    }
  },
  
  async invalidateGlobal() {
    try {
      const supabase = await createClient();
      
      console.log('🗑️ [Cache] Invalidating global instructions cache');
      await supabase
        .from('app_cache')
        .delete()
        .eq('cache_type', 'global_instructions');
        
      console.log('✅ [Cache] Global cache invalidated successfully');
    } catch (error) {
      console.error('❌ [Cache] Error invalidating global cache:', error);
    }
  },

  // Cleanup expired cache entries
  async cleanupExpiredCache() {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('app_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());
        
      if (!error) {
        console.log('🧹 [Cache] Cleaned up expired cache entries');
      }
    } catch (error) {
      console.error('❌ [Cache] Error cleaning up expired cache:', error);
    }
  },

  // Debug function to check current cache status
  async debugCacheStatus(userId: string) {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('app_cache')
        .select('cache_key, cache_type, created_at, expires_at, expires_at > now() as is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        console.log(`🔍 [Cache Debug] Cache status for user ${userId}:`, data);
        return data;
      }
    } catch (error) {
      console.error('❌ [Cache Debug] Error checking cache status:', error);
    }
    return [];
  }
};

export default serverCache; 