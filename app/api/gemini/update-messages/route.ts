import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

async function getUserId(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  } catch (error) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const { instanceId, messages } = await req.json();
    if (!instanceId || !Array.isArray(messages)) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing instanceId or messages' }),
        { status: 400 }
      );
    }
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from('chat_history')
      .update({ messages })
      .eq('id', instanceId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) {
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update chat history' }),
        { status: 500 }
      );
    }
    return new NextResponse(
      JSON.stringify({ success: true, instance: updated })
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
} 