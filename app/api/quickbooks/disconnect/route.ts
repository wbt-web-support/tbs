import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { QuickBooksAPI } from "@/lib/quickbooks-api";

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

export async function DELETE(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const qbAPI = new QuickBooksAPI();

    // Check for existing connection
    const connection = await qbAPI.getConnection(userId);
    if (!connection) {
      return NextResponse.json({ 
        error: "No QuickBooks connection found" 
      }, { status: 404 });
    }

    const { company_id } = connection;

    try {
      // Parse request body to check for data deletion preference
      let keepData = false;
      try {
        const body = await request.json();
        keepData = body.keepData || false;
      } catch {
        // If no body or invalid JSON, default to keeping data
        keepData = true;
      }

      console.log(`Disconnecting QuickBooks for user: ${userId}, keepData: ${keepData}`);

      if (!keepData) {
        // Remove the entire connection and all data
        await qbAPI.removeConnection(userId, company_id);
        console.log('QuickBooks connection and all data deleted');
      } else {
        // Just mark as disconnected but keep data
        await qbAPI.updateConnectionStatus(userId, company_id, 'error');
        console.log('QuickBooks connection disconnected, data preserved');
      }

      console.log('QuickBooks disconnection completed successfully');

      return NextResponse.json({ 
        success: true,
        message: "QuickBooks connection removed successfully",
        dataDeleted: !keepData
      });

    } catch (disconnectError) {
      console.error('Error during disconnection:', disconnectError);
      
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

// Handle other HTTP methods
export async function POST() {
  return NextResponse.json({ 
    error: "Method not allowed. Use DELETE to disconnect QuickBooks." 
  }, { status: 405 });
}

export async function GET() {
  return NextResponse.json({ 
    error: "Method not allowed. Use DELETE to disconnect QuickBooks." 
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ 
    error: "Method not allowed. Use DELETE to disconnect QuickBooks." 
  }, { status: 405 });
}