const NodeCache = require('node-cache');

// Create cache instances with different TTLs (Time To Live)
const instructionsCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
const userDataCache = new NodeCache({ stdTTL: 600 }); // 10 minutes
const chatHistoryCache = new NodeCache({ stdTTL: 60 }); // 1 minute

// Supabase client should be passed here from the main file
let supabaseClient = null;
let globalInstructionsFunc = null;
let userDataFunc = null;

// Function to initialize the cache with the Supabase client
function initializeCache(supabase, getGlobalInstructionsFn, getUserDataFn) {
  supabaseClient = supabase;
  if (getGlobalInstructionsFn) globalInstructionsFunc = getGlobalInstructionsFn;
  if (getUserDataFn) userDataFunc = getUserDataFn;
  console.log('Cache module initialized with Supabase client');
}

const CACHE_KEYS = {
  INSTRUCTIONS: 'global_instructions',
  USER_DATA: (userId) => `user_data_${userId}`,
  CHAT_HISTORY: (userId) => `chat_history_${userId}`,
};

// Cache wrapper for getGlobalInstructions
async function getCachedGlobalInstructions(getGlobalInstructionsFunc) {
  let instructions = instructionsCache.get(CACHE_KEYS.INSTRUCTIONS);
  
  if (instructions === undefined) {
    // Use provided function or stored function
    const fn = getGlobalInstructionsFunc || globalInstructionsFunc;
    if (!fn) {
      console.error('No getGlobalInstructions function provided or stored');
      return [];
    }
    instructions = await fn();
    instructionsCache.set(CACHE_KEYS.INSTRUCTIONS, instructions);
    console.log('Cached global instructions');
  } else {
    console.log('Using cached global instructions');
  }
  
  return instructions;
}

// Cache wrapper for getUserData
async function getCachedUserData(userId, getUserDataFunc) {
  if (!userId) return null;
  
  const cacheKey = CACHE_KEYS.USER_DATA(userId);
  let userData = userDataCache.get(cacheKey);
  
  if (userData === undefined) {
    // Use provided function or stored function
    const fn = getUserDataFunc || userDataFunc;
    if (!fn) {
      console.error('No getUserData function provided or stored');
      return null;
    }
    userData = await fn(userId);
    userDataCache.set(cacheKey, userData);
    console.log(`Cached user data for user ${userId}`);
  } else {
    console.log(`Using cached user data for user ${userId}`);
  }
  
  return userData;
}

// Cache wrapper for chat history
async function getCachedChatHistory(userId) {
  if (!userId) return [];
  
  const cacheKey = CACHE_KEYS.CHAT_HISTORY(userId);
  let history = chatHistoryCache.get(cacheKey);
  
  if (history === undefined) {
    if (!supabaseClient) {
      console.error('Supabase client not initialized in cache module');
      return [];
    }
    
    const { data, error } = await supabaseClient
      .from('chat_history')
      .select('messages')
      .eq('user_id', userId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching chat history from database:', error);
      return [];
    }
    
    history = data?.messages || [];
    console.log(`Fetched chat history from database for user ${userId} - caching ${history.length} messages`);
    chatHistoryCache.set(cacheKey, history);
  } else {
    console.log(`Using cached chat history for user ${userId} - ${history.length} messages`);
  }
  
  return history;
}

// Function to invalidate user's cache when needed
function invalidateUserCache(userId) {
  userDataCache.del(CACHE_KEYS.USER_DATA(userId));
  chatHistoryCache.del(CACHE_KEYS.CHAT_HISTORY(userId));
  console.log(`Invalidated cache for user ${userId}`);
}

// Function to invalidate instructions cache
function invalidateInstructionsCache() {
  instructionsCache.del(CACHE_KEYS.INSTRUCTIONS);
  console.log('Invalidated instructions cache');
}

module.exports = {
  initializeCache,
  getCachedGlobalInstructions,
  getCachedUserData,
  getCachedChatHistory,
  invalidateUserCache,
  invalidateInstructionsCache,
}; 