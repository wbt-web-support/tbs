import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPISimplified } from "@/lib/quickbooks-api-simplified";

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

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const preserveData = body.preserveData === true;

    const qbAPI = new QuickBooksAPISimplified();

    // Check for existing connection
    const connection = await qbAPI.getConnection(userId);
    if (!connection) {
      return NextResponse.json({ 
        error: "No QuickBooks connection found." 
      }, { status: 404 });
    }

    try {
      if (preserveData) {
        // Just mark as disconnected but keep data
        await qbAPI.updateConnectionStatus(userId, connection.company_id, 'error');
        
        return NextResponse.json({ 
          success: true,
          message: "QuickBooks connection disconnected. Data preserved.",
          dataPreserved: true
        });
      } else {
        // Remove the entire connection and all data
        await qbAPI.removeConnection(userId, connection.company_id);
        
        return NextResponse.json({ 
          success: true,
          message: "QuickBooks connection removed completely.",
          dataPreserved: false
        });
      }

    } catch (disconnectError) {
      console.error('Error during QuickBooks disconnect:', disconnectError);
      return NextResponse.json({ 
        error: "Failed to disconnect QuickBooks",
        details: disconnectError instanceof Error ? disconnectError.message : String(disconnectError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in QuickBooks disconnect:", error);
    return NextResponse.json({ 
      error: "Failed to process disconnect request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}