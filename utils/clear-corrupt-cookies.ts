/**
 * Clear corrupted Supabase auth cookies
 * This helps resolve "Failed to parse cookie string" errors
 */
export function clearCorruptedSupabaseCookies() {
  if (typeof window === 'undefined') return;
  
  try {
    // Get all cookies
    const cookies = document.cookie.split(';');
    
    // Find Supabase auth cookies
    const supabaseCookies = cookies.filter(cookie => 
      cookie.trim().startsWith('sb-') && cookie.includes('-auth-token')
    );
    
    // Clear corrupted cookies
    supabaseCookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      console.log(`Clearing potentially corrupted cookie: ${cookieName}`);
      
      // Clear cookie by setting it to expire
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    
    // Also clear localStorage items that might be corrupted
    const localStorageKeys = Object.keys(localStorage);
    const supabaseKeys = localStorageKeys.filter(key => 
      key.startsWith('sb-') && key.includes('-auth-token')
    );
    
    supabaseKeys.forEach(key => {
      console.log(`Clearing localStorage item: ${key}`);
      localStorage.removeItem(key);
    });
    
    console.log('Cleared corrupted Supabase auth data');
    
  } catch (error) {
    console.error('Error clearing corrupted cookies:', error);
  }
}

/**
 * Check if there are cookie parsing errors and auto-clear if needed
 */
export function handleCookieErrors() {
  // Listen for cookie parsing errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorMessage = args.join(' ');
    if (errorMessage.includes('Failed to parse cookie string') && 
        errorMessage.includes('base64-eyJ')) {
      console.warn('Detected corrupted Supabase cookie, attempting to clear...');
      clearCorruptedSupabaseCookies();
      // Reload page after clearing cookies
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    originalConsoleError.apply(console, args);
  };
}