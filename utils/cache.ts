// Cache configuration
const CACHE_CONFIG = {
  DATA_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 1000, // Maximum number of users to cache
};

// Server-wide cache
const serverCache = {
  globalInstructions: null as any,
  lastGlobalFetch: null as number | null,
  userData: new Map<string, any>(),
  lastUserFetch: new Map<string, number>(),
  
  async getGlobalInstructions(fetchFn: () => Promise<any>) {
    const now = Date.now();
    if (!this.globalInstructions || !this.lastGlobalFetch || 
        (now - this.lastGlobalFetch > CACHE_CONFIG.DATA_REFRESH_INTERVAL)) {
      console.log('🔄 [Cache] Fetching fresh global instructions');
      this.globalInstructions = await fetchFn();
      this.lastGlobalFetch = now;
      console.log('✅ [Cache] Global instructions cached successfully');
      console.log('📊 [Cache] Global instructions size:', JSON.stringify(this.globalInstructions).length, 'bytes');
    } else {
      console.log('📦 [Cache] Using cached global instructions');
      console.log('⏰ [Cache] Cache age:', Math.round((now - this.lastGlobalFetch!) / 1000), 'seconds');
    }
    return this.globalInstructions;
  },
  
  async getUserData(userId: string, fetchFn: (userId: string) => Promise<any>) {
    if (!userId) {
      console.log('⚠️ [Cache] No userId provided for getUserData');
      return null;
    }
    
    const now = Date.now();
    const lastFetch = this.lastUserFetch.get(userId);
    
    if (!this.userData.has(userId) || !lastFetch || 
        (now - lastFetch > CACHE_CONFIG.DATA_REFRESH_INTERVAL)) {
      console.log(`🔄 [Cache] Fetching fresh user data for: ${userId}`);
      const data = await fetchFn(userId);
      this.userData.set(userId, data);
      this.lastUserFetch.set(userId, now);
      
      // Log cache size and data details
      console.log('✅ [Cache] User data cached successfully');
      console.log('📊 [Cache] User data size:', JSON.stringify(data).length, 'bytes');
      console.log('📊 [Cache] Total cached users:', this.userData.size);
      
      // Log table data sizes
      if (data?.additionalData) {
        Object.entries(data.additionalData).forEach(([table, records]) => {
          if (Array.isArray(records)) {
            console.log(`📊 [Cache] ${table}: ${records.length} records`);
          }
        });
      }
      
      // Implement cache size limit
      if (this.userData.size > CACHE_CONFIG.MAX_CACHE_SIZE) {
        const oldestKey = Array.from(this.lastUserFetch.entries())
          .sort((a, b) => a[1] - b[1])[0][0];
        console.log(`🧹 [Cache] Removing oldest user from cache: ${oldestKey}`);
        this.userData.delete(oldestKey);
        this.lastUserFetch.delete(oldestKey);
      }
    } else {
      console.log(`📦 [Cache] Using cached data for user: ${userId}`);
      console.log('⏰ [Cache] Cache age:', Math.round((now - lastFetch) / 1000), 'seconds');
    }
    return this.userData.get(userId);
  },
  
  invalidateUser(userId: string) {
    console.log(`🗑️ [Cache] Invalidating cache for user: ${userId}`);
    this.userData.delete(userId);
    this.lastUserFetch.delete(userId);
    console.log('📊 [Cache] Remaining cached users:', this.userData.size);
  },
  
  invalidateGlobal() {
    console.log('🗑️ [Cache] Invalidating global instructions cache');
    this.globalInstructions = null;
    this.lastGlobalFetch = null;
  }
};

export default serverCache; 