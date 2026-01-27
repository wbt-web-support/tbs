import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getTeamId } from "@/utils/supabase/teams";

// GET: Fetch subcategories for a team
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const service_id = searchParams.get("service_id");

    let query = supabase
      .from("service_subcategories")
      .select(`
        id,
        team_id,
        service_id,
        subcategory_name,
        description,
        ai_generated,
        created_at,
        updated_at,
        global_services:service_id (
          id,
          service_name,
          description,
          category,
          display_order
        )
      `)
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (service_id) {
      query = query.eq("service_id", service_id);
    }

    const { data: subcategories, error } = await query;

    if (error) {
      console.error("Error fetching subcategories:", error);
      return NextResponse.json({ error: "Failed to fetch subcategories" }, { status: 500 });
    }

    // Group subcategories by service for easier consumption
    const grouped = (subcategories || []).reduce((acc: any, subcat: any) => {
      const serviceName = subcat.global_services?.service_name || "Unknown";
      if (!acc[serviceName]) {
        acc[serviceName] = {
          service_id: subcat.service_id,
          service_name: serviceName,
          display_order: subcat.global_services?.display_order ?? 999999,
          subcategories: []
        };
      }
      acc[serviceName].subcategories.push({
        id: subcat.id,
        subcategory_name: subcat.subcategory_name,
        description: subcat.description,
        ai_generated: subcat.ai_generated,
        created_at: subcat.created_at,
        updated_at: subcat.updated_at
      });
      return acc;
    }, {});

    // Sort grouped services by display_order
    const groupedArray = Object.values(grouped).sort((a: any, b: any) => {
      return a.display_order - b.display_order;
    });

    return NextResponse.json({ 
      subcategories: subcategories || [],
      grouped: groupedArray
    });
  } catch (error: any) {
    console.error("Error in GET /api/subcategories:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new subcategory
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service_id, subcategory_name, description, ai_generated } = body;

    if (!service_id || !subcategory_name) {
      return NextResponse.json(
        { error: "Service ID and subcategory name are required" },
        { status: 400 }
      );
    }

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    // Check if subcategory already exists for this team and service
    const { data: existingSubcategory } = await supabase
      .from("service_subcategories")
      .select("id")
      .eq("team_id", teamId)
      .eq("service_id", service_id)
      .eq("subcategory_name", subcategory_name.trim())
      .single();

    if (existingSubcategory) {
      return NextResponse.json(
        { error: "Subcategory already exists for this service" },
        { status: 409 }
      );
    }

    // Create new subcategory
    const { data: subcategory, error } = await supabase
      .from("service_subcategories")
      .insert({
        team_id: teamId,
        service_id: service_id,
        subcategory_name: subcategory_name.trim(),
        description: description || null,
        ai_generated: ai_generated !== undefined ? ai_generated : false
      })
      .select(`
        id,
        team_id,
        service_id,
        subcategory_name,
        description,
        ai_generated,
        created_at,
        updated_at,
        global_services:service_id (
          id,
          service_name,
          description,
          category,
          display_order
        )
      `)
      .single();

    if (error) {
      console.error("Error creating subcategory:", error);
      return NextResponse.json({ error: "Failed to create subcategory" }, { status: 500 });
    }

    return NextResponse.json({ subcategory }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/subcategories:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Update a subcategory
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, subcategory_name, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Subcategory ID is required" },
        { status: 400 }
      );
    }

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    // Verify the subcategory belongs to the user's team
    const { data: existingSubcategory } = await supabase
      .from("service_subcategories")
      .select("id, team_id")
      .eq("id", id)
      .single();

    if (!existingSubcategory) {
      return NextResponse.json(
        { error: "Subcategory not found" },
        { status: 404 }
      );
    }

    if (existingSubcategory.team_id !== teamId) {
      return NextResponse.json(
        { error: "Unauthorized to update this subcategory" },
        { status: 403 }
      );
    }

    // If subcategory_name is being updated, check for duplicates
    if (subcategory_name) {
      const { data: duplicateCheck } = await supabase
        .from("service_subcategories")
        .select("id")
        .eq("team_id", teamId)
        .eq("service_id", existingSubcategory.service_id)
        .eq("subcategory_name", subcategory_name.trim())
        .neq("id", id)
        .single();

      if (duplicateCheck) {
        return NextResponse.json(
          { error: "Subcategory name already exists for this service" },
          { status: 409 }
        );
      }
    }

    // Update subcategory
    const updateData: any = {};
    if (subcategory_name) updateData.subcategory_name = subcategory_name.trim();
    if (description !== undefined) updateData.description = description;

    const { data: subcategory, error } = await supabase
      .from("service_subcategories")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        team_id,
        service_id,
        subcategory_name,
        description,
        ai_generated,
        created_at,
        updated_at,
        global_services:service_id (
          id,
          service_name,
          description,
          category,
          display_order
        )
      `)
      .single();

    if (error) {
      console.error("Error updating subcategory:", error);
      return NextResponse.json({ error: "Failed to update subcategory" }, { status: 500 });
    }

    return NextResponse.json({ subcategory });
  } catch (error: any) {
    console.error("Error in PUT /api/subcategories:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a subcategory
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Subcategory ID is required" },
        { status: 400 }
      );
    }

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    // Verify the subcategory belongs to the user's team
    const { data: existingSubcategory } = await supabase
      .from("service_subcategories")
      .select("id, team_id")
      .eq("id", id)
      .single();

    if (!existingSubcategory) {
      return NextResponse.json(
        { error: "Subcategory not found" },
        { status: 404 }
      );
    }

    if (existingSubcategory.team_id !== teamId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this subcategory" },
        { status: 403 }
      );
    }

    // Check if there are any machines using this subcategory
    const { data: machines, error: machinesError } = await supabase
      .from("machines")
      .select("id, enginename, enginetype")
      .eq("subcategory_id", id);

    if (machinesError) {
      console.error("Error checking machines:", machinesError);
      return NextResponse.json(
        { error: "Failed to check associated machines" },
        { status: 500 }
      );
    }

    if (machines && machines.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete subcategory with associated machines",
          machines: machines.map((m: any) => ({
            id: m.id,
            name: m.enginename,
            type: m.enginetype
          }))
        },
        { status: 409 }
      );
    }

    // Delete subcategory
    const { error } = await supabase
      .from("service_subcategories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting subcategory:", error);
      return NextResponse.json({ error: "Failed to delete subcategory" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/subcategories:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
