import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getTeamId } from "@/utils/supabase/teams";

// GET: Fetch services for a team
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
    const type = searchParams.get("type"); // "all" for all services, "team" for team's services

    if (type === "all") {
      // Return all available global services
      const { data: allServices, error } = await supabase
        .from("global_services")
        .select("*")
        .eq("is_active", true)
        .order("service_name", { ascending: true });

      if (error) {
        console.error("Error fetching all services:", error);
        return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
      }

      // Also get which services the team has selected
      const { data: teamServices } = await supabase
        .from("team_services")
        .select("service_id")
        .eq("team_id", teamId);

      const selectedServiceIds = (teamServices || []).map((ts: any) => ts.service_id);

      return NextResponse.json({ 
        services: allServices || [],
        selectedServiceIds: selectedServiceIds
      });
    } else {
      // Return only services selected by the team
      const { data: teamServices, error } = await supabase
        .from("team_services")
        .select(`
          id,
          service_id,
          created_at,
          updated_at,
          global_services:service_id (
            id,
            service_name,
            description,
            category,
            is_active
          )
        `)
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching team services:", error);
        return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
      }

      // Transform the data to match expected format
      const services = (teamServices || []).map((ts: any) => ({
        id: ts.service_id,
        team_id: teamId,
        service_name: ts.global_services?.service_name,
        description: ts.global_services?.description,
        category: ts.global_services?.category,
        created_at: ts.created_at,
        updated_at: ts.updated_at
      }));

      return NextResponse.json({ services });
    }
  } catch (error: any) {
    console.error("Error in GET /api/services:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Add a service to a team (from global services) or create new global service
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service_id, service_name, category } = body;

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    let globalServiceId = service_id;

    // If service_id is provided, use it; otherwise create new global service
    if (!globalServiceId && service_name) {
      // Check if global service exists
      const { data: existingGlobalService } = await supabase
        .from("global_services")
        .select("id")
        .eq("service_name", service_name.trim())
        .single();

      if (existingGlobalService) {
        globalServiceId = existingGlobalService.id;
      } else {
        // Create new global service
        const { data: newGlobalService, error: createError } = await supabase
          .from("global_services")
          .insert({
            service_name: service_name.trim(),
            category: category || "General",
            is_active: true
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating global service:", createError);
          return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
        }

        globalServiceId = newGlobalService.id;
      }
    }

    if (!globalServiceId) {
      return NextResponse.json(
        { error: "Service ID or name is required" },
        { status: 400 }
      );
    }

    // Check if team already has this service
    const { data: existingTeamService } = await supabase
      .from("team_services")
      .select("id")
      .eq("team_id", teamId)
      .eq("service_id", globalServiceId)
      .single();

    if (existingTeamService) {
      return NextResponse.json(
        { error: "Service already added to team" },
        { status: 409 }
      );
    }

    // Add service to team
    const { data: teamService, error } = await supabase
      .from("team_services")
      .insert({
        team_id: teamId,
        service_id: globalServiceId,
      })
      .select(`
        id,
        service_id,
        created_at,
        updated_at,
        global_services:service_id (
          id,
          service_name,
          description,
          category,
          is_active
        )
      `)
      .single();

    if (error) {
      console.error("Error adding service to team:", error);
      return NextResponse.json({ error: "Failed to add service" }, { status: 500 });
    }

    // Transform response
    const service = {
      id: teamService.service_id,
      team_id: teamId,
      service_name: teamService.global_services?.service_name,
      description: teamService.global_services?.description,
      category: teamService.global_services?.category,
      created_at: teamService.created_at,
      updated_at: teamService.updated_at
    };

    return NextResponse.json({ service }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/services:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Update a global service (admin only) or update team service connection
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service_id, service_name, description, category, is_active } = body;

    // Check if user is admin (can update global services)
    const { data: businessInfo } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = businessInfo?.role === "admin" || businessInfo?.role === "super_admin";

    if (isAdmin && service_id && (service_name || description || category !== undefined || is_active !== undefined)) {
      // Update global service (admin only)
      const updateData: any = {};
      if (service_name) updateData.service_name = service_name.trim();
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: globalService, error } = await supabase
        .from("global_services")
        .update(updateData)
        .eq("id", service_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating global service:", error);
        return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
      }

      return NextResponse.json({ service: globalService });
    } else {
      return NextResponse.json(
        { error: "Insufficient permissions or invalid request" },
        { status: 403 }
      );
    }
  } catch (error: any) {
    console.error("Error in PUT /api/services:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a service from team or delete global service (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const service_id = searchParams.get("service_id");
    const global_service_id = searchParams.get("global_service_id"); // For admin to delete global service

    const teamId = await getTeamId(supabase, user.id);
    if (!teamId) {
      return NextResponse.json({ error: "Team ID not found" }, { status: 404 });
    }

    // Check if user is admin
    const { data: businessInfo } = await supabase
      .from("business_info")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = businessInfo?.role === "admin" || businessInfo?.role === "super_admin";

    if (global_service_id && isAdmin) {
      // Admin deleting a global service
      const { error } = await supabase
        .from("global_services")
        .delete()
        .eq("id", global_service_id);

      if (error) {
        console.error("Error deleting global service:", error);
        return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (service_id) {
      // Remove service from team
      const { error } = await supabase
        .from("team_services")
        .delete()
        .eq("team_id", teamId)
        .eq("service_id", service_id);

      if (error) {
        console.error("Error removing service from team:", error);
        return NextResponse.json({ error: "Failed to remove service" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Service ID is required" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error in DELETE /api/services:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
