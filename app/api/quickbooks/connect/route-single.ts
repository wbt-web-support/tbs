import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPI } from "@/lib/quickbooks-api-single";

// Helper function to get user ID from request
async function getUserId() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id; 
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

export async function POST() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const qbAPI = new QuickBooksAPI();
    
    // Generate a state parameter for OAuth security
    const state = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Generate the OAuth authorization URL
    const authUrl = qbAPI.generateAuthUrl(state);

    return NextResponse.json({ 
      authUrl,
      state 
    });

  } catch (error) {
    console.error("Error initiating QuickBooks connection:", error);
    return NextResponse.json({ 
      error: "Failed to initiate QuickBooks connection",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}