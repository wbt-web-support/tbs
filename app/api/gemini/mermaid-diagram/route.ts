import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MODEL_NAME = "gemini-3-flash-preview";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

async function getUserId(req: Request): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch (error) {
    console.error("Error getting user session:", error);
    return null;
  }
}

async function getTeamId(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: businessInfo, error } = await supabase
      .from("business_info")
      .select("team_id")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return businessInfo?.team_id ?? null;
  } catch (error) {
    console.error("Error getting team ID:", error);
    return null;
  }
}

const MERMAID_PROMPT = `You are a Mermaid flowchart expert. Generate ONLY valid Mermaid flowchart code. No markdown fences, no explanation. Output ONLY the code.

TONE:
- Write all node labels and arrow labels in a human, general tone. Use natural, everyday language—conversational and easy to understand. Avoid jargon, corporate speak, or overly formal phrasing. Examples: "Customer gets in touch" not "Initiates contact"; "We send a quote" not "Quote dispatched"; "Did they say yes?" not "Affirmative response received."

DESIGN RULES (follow strictly):

1) SHAPES (use correct shape for each node type):
   - Start node: stadium shape with parentheses. Example: Start(["Trigger event"])
   - End node: stadium shape. Example: End(["Sale completed"])
   - Process/action steps: rectangle. Example: S1["Contact customer"] or S1["Send quote"]
   - Decisions/conditions: rhombus with curly braces. Example: D1{"Valid lead?"} or D2{"Customer accepted?"}
   - Use decisions when a step has yes/no, if/else, or conditional outcome. Show both branches with arrow labels: D1 -->|Yes| S2 and D1 -->|No| S3

2) NODE IDS AND LABELS:
   - IDs: short, no spaces, no special chars. Use Start, End, S1, S2, S3... for steps, D1, D2... for decisions.
   - Any label containing parentheses, commas, or colons MUST be in double quotes inside the shape. Examples: S1["Marketing (Google Ads)"], D1{"Ready to close?"}. Wrong: S1[Marketing (Google Ads)] breaks.

3) FLOW AND CONDITIONS:
   - Include every step from the provided actions/activities. High-level diagram but show all steps.
   - Where an action implies a condition (e.g. "if approved", "valid?", "customer decides"), add a decision node and use -->|Yes| and -->|No| (or -->|Optional|) to show branches.
   - Linear steps: A --> B --> C. After a decision, branches can rejoin later steps.

4) STYLING (use classDef for a professional look):
   - Define styles for start/end, process, and decision. Apply them to nodes.
   - Example after your nodes:
     classDef startEnd fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
     classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
     classDef decision fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
     class Start,End startEnd
     class S1,S2,S3 process
     class D1,D2 decision

5) LAYOUT:
   - Use flowchart TD for top-down (prefer for 4+ steps). First line: flowchart TD
   - Keep one step per line; align arrows clearly.

6) SUBGRAPHS (optional, for many steps):
   - You may group steps in subgraphs like: subgraph trigger ["Trigger"] ... end and subgraph process ["Process"] ... end for clarity.

Output ONLY the Mermaid code, nothing else.`;

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = await getTeamId(userId);
    if (!teamId) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      action,
      machineId,
      subcategoryId,
      serviceId,
      engineType,
      mermaidCode: existingCode,
      editPrompt,
    }: {
      action?: string;
      machineId?: string;
      subcategoryId?: string;
      serviceId?: string;
      engineType?: "GROWTH" | "FULFILLMENT";
      mermaidCode?: string;
      editPrompt?: string;
    } = body;

    // Edit flow: user provides current diagram + natural language edit request
    if (action === "edit") {
      const code = typeof existingCode === "string" ? existingCode.trim() : "";
      const prompt = typeof editPrompt === "string" ? editPrompt.trim() : "";
      if (!code || !prompt) {
        return NextResponse.json(
          { error: "mermaidCode and editPrompt are required for edit" },
          { status: 400 }
        );
      }
      const editInstruction = `${MERMAID_PROMPT}

The user has an existing flowchart and wants to edit it. Apply ONLY the requested change. Return the COMPLETE updated flowchart (every node and edge), not just the changed part. Keep the same style (classDef, shapes) and human tone unless the user asks to change it.

Current flowchart:
\`\`\`
${code}
\`\`\`

User request: ${prompt}

Return ONLY the full updated Mermaid flowchart code (no markdown fences, no explanation):`;

      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const generationConfig: Record<string, unknown> = {
        thinkingConfig: { thinkingLevel: "high" },
      };
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: editInstruction }] }],
        generationConfig,
      } as Parameters<typeof model.generateContent>[0]);
      const response = result.response;
      let text = response.text().trim();
      const fenceMatch = text.match(/^```(?:mermaid)?\s*([\s\S]*?)```\s*$/m);
      if (fenceMatch) text = fenceMatch[1].trim();
      else text = text.replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```\s*$/m, "");
      if (!text) {
        return NextResponse.json(
          { error: "No Mermaid code returned from edit" },
          { status: 500 }
        );
      }
      return NextResponse.json({ mermaidCode: text });
    }

    const engine = engineType === "FULFILLMENT" ? "FULFILLMENT" : "GROWTH";

    const supabase = await createClient();
    let query = supabase
      .from("machines")
      .select(
        "id, enginename, enginetype, triggeringevents, endingevent, actionsactivities"
      )
      .eq("user_id", teamId)
      .eq("enginetype", engine);

    if (machineId) {
      query = query.eq("id", machineId);
    } else if (subcategoryId) {
      query = query.eq("subcategory_id", subcategoryId);
    } else if (serviceId) {
      query = query.eq("service_id", serviceId);
    } else {
      return NextResponse.json(
        { error: "machineId, subcategoryId, or serviceId required" },
        { status: 400 }
      );
    }

    const { data: machine, error: machineError } = await query.single();

    if (machineError || !machine) {
      return NextResponse.json(
        { error: "Machine not found" },
        { status: 404 }
      );
    }

    const trigger =
      machine.triggeringevents?.[0]?.value ?? "Trigger";
    const end = machine.endingevent?.[0]?.value ?? "End";
    const activities = (machine.actionsactivities ?? [])
      .map((a: { value?: string }) => a?.value?.trim())
      .filter(Boolean);

    const hasData = activities.length > 0;

    const dataContext = hasData
      ? `
Machine name: ${machine.enginename ?? "Machine"}
Engine type: ${machine.enginetype}

TRIGGER (use stadium shape for Start): ${trigger}
END (use stadium shape for End): ${end}

ACTIONS IN ORDER (use rectangle for each; add decision diamonds where a step has a condition or yes/no):
${activities.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}

Instructions:
- Write every label in a human, general tone: natural and conversational, not formal or jargon-heavy.
- Create one node for the trigger (stadium), one for the end (stadium), and one node for each action above (rectangles). Use short IDs: Start, S1, S2, ... End.
- If any action implies a decision (e.g. "if customer agrees", "check validity"), add a decision node (rhombus) and use friendly branch labels like -->|Yes| -->|No| or -->|Got it| -->|Not yet| where it fits.
- Quote any label that contains parentheses, commas, or colons: e.g. S1["Step name (detail here)"].
- At the end add classDef for startEnd, process, decision and assign them to the nodes. Include all steps so the diagram is high-level but complete.
`
      : `
Machine name: ${machine.enginename ?? "Machine"}
Engine type: ${machine.enginetype}

No actions/activities yet. Generate a simple placeholder: Start(["Trigger"]) --> S1["Add steps in Planner"] --> End(["End"]). Use classDef to style Start and End (e.g. startEnd fill:#e8f5e9). Output only the code.
`;

    const fullPrompt = `${MERMAID_PROMPT}

${dataContext}

Generate the Mermaid flowchart code now (only the code, no markdown):`;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const generationConfig: Record<string, unknown> = {
      thinkingConfig: {
        thinkingLevel: "high",
      },
    };
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig,
    } as Parameters<typeof model.generateContent>[0]);
    const response = result.response;
    let text = response.text().trim();

    // Strip markdown code fence if model included it
    const fenceMatch = text.match(/^```(?:mermaid)?\s*([\s\S]*?)```\s*$/m);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    } else {
      text = text.replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```\s*$/m, "");
    }

    if (!text) {
      return NextResponse.json(
        { error: "No Mermaid code generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({ mermaidCode: text });
  } catch (error) {
    console.error("Mermaid diagram generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
