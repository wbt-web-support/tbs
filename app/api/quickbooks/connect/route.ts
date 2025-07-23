import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPI } from "@/lib/quickbooks-api";

// Helper function to get user ID from request
async function getUserId() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id; 
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

    // Check for existing active connection
    const qbAPI = new QuickBooksAPI();
    const existingConnection = await qbAPI.getConnection(userId);
    
    if (existingConnection) {
      return NextResponse.json({ 
        error: "QuickBooks connection already exists. Please disconnect first." 
      }, { status: 400 });
    }

    // Generate state parameter for OAuth security
    const state = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    // Generate OAuth authorization URL
    const authUrl = qbAPI.generateAuthUrl(state);

    // Store state in session/database for verification in callback
    // For now, we'll include it in the auth URL and verify it in callback
    
    return NextResponse.json({ 
      authUrl,
      state,
      message: "Redirect to QuickBooks for authorization" 
    });

  } catch (error) {
    console.error("Error initiating QuickBooks connection:", error);
    return NextResponse.json({ 
      error: "Failed to initiate QuickBooks connection",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}