import { createClient } from '@/utils/supabase/server';
import { google } from 'googleapis';

interface CalendarTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  calendar_id?: string;
  sync_token?: string;
  account_name?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  timezone?: string;
  event_link?: string;
  attendees?: any[];
  recurrence?: any;
  status?: string;
}

/**
 * Get Google Calendar OAuth tokens for a user, refreshing if needed
 */
export async function getCalendarTokensForUser(userId: string): Promise<CalendarTokens | null> {
  try {
    const supabase = await createClient();
    
    const { data: tokenData, error } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !tokenData) {
      return null;
    }
    
    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    
    if (expiresAt && now >= expiresAt && tokenData.refresh_token) {
      const refreshedTokens = await refreshCalendarAccessToken(tokenData.refresh_token);
      if (refreshedTokens) {
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: refreshedTokens.access_token,
            expires_at: refreshedTokens.expires_at
          })
          .eq('user_id', userId);
        
        tokenData.access_token = refreshedTokens.access_token;
        tokenData.expires_at = refreshedTokens.expires_at;
      }
    }
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      calendar_id: tokenData.calendar_id || 'primary',
      sync_token: tokenData.sync_token,
      account_name: tokenData.account_name
    };
  } catch (error) {
    console.error('Error getting calendar tokens for user:', error);
    return null;
  }
}

/**
 * Refresh Google Calendar access token
 */
export async function refreshCalendarAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to refresh calendar token:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    
    return {
      access_token: data.access_token,
      expires_at: expiresAt
    };
  } catch (error) {
    console.error('Error refreshing calendar access token:', error);
    return null;
  }
}

/**
 * Get Google Calendar API client
 */
export async function getCalendarClient(userId: string) {
  const tokens = await getCalendarTokensForUser(userId);
  if (!tokens) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google-calendar/callback`
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Fetch events from Google Calendar API
 */
export async function fetchCalendarEvents(
  userId: string,
  timeMin?: string,
  timeMax?: string,
  syncToken?: string
): Promise<{ events: any[]; nextSyncToken?: string } | null> {
  try {
    const calendar = await getCalendarClient(userId);
    if (!calendar) {
      return null;
    }

    const tokens = await getCalendarTokensForUser(userId);
    if (!tokens) {
      return null;
    }

    const params: any = {
      calendarId: tokens.calendar_id || 'primary',
      singleEvents: true,
      orderBy: 'startTime',
    };

    if (syncToken) {
      params.syncToken = syncToken;
    } else {
      // For initial sync, set time range
      params.timeMin = timeMin || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      params.timeMax = timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    const response = await calendar.events.list(params);
    
    return {
      events: response.data.items || [],
      nextSyncToken: response.data.nextSyncToken || undefined
    };
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    if (error.code === 410) {
      // Sync token is invalid, need to do full sync
      return fetchCalendarEvents(userId, timeMin, timeMax);
    }
    return null;
  }
}

/**
 * Parse Google Calendar event to our format
 */
export function parseCalendarEvent(googleEvent: any): CalendarEvent {
  const start = googleEvent.start?.dateTime || googleEvent.start?.date;
  const end = googleEvent.end?.dateTime || googleEvent.end?.date;
  const allDay = !!googleEvent.start?.date; // If date (not dateTime), it's all-day

  return {
    id: googleEvent.id,
    title: googleEvent.summary || 'No Title',
    description: googleEvent.description || undefined,
    location: googleEvent.location || undefined,
    start_time: start,
    end_time: end,
    all_day: allDay,
    timezone: googleEvent.start?.timeZone || undefined,
    event_link: googleEvent.htmlLink || undefined,
    attendees: googleEvent.attendees || [],
    recurrence: googleEvent.recurrence || undefined,
    status: googleEvent.status || 'confirmed',
  };
}

/**
 * Sync events from Google Calendar to database
 */
export async function syncCalendarEventsToDatabase(userId: string): Promise<{ success: boolean; eventCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Update sync status
    await supabase
      .from('google_calendar_tokens')
      .update({ sync_status: 'syncing', error_message: null })
      .eq('user_id', userId);

    // Get sync token for incremental sync
    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('sync_token, calendar_id')
      .eq('user_id', userId)
      .single();

    const result = await fetchCalendarEvents(
      userId,
      undefined,
      undefined,
      tokenData?.sync_token || undefined
    );

    if (!result || !result.events) {
      throw new Error('Failed to fetch events from Google Calendar');
    }

    const events = result.events;
    const calendarId = tokenData?.calendar_id || 'primary';

    // Upsert events into database
    for (const googleEvent of events) {
      const parsedEvent = parseCalendarEvent(googleEvent);
      
      const eventData = {
        user_id: userId,
        google_event_id: parsedEvent.id,
        calendar_id: calendarId,
        title: parsedEvent.title,
        description: parsedEvent.description || null,
        location: parsedEvent.location || null,
        start_time: parsedEvent.start_time,
        end_time: parsedEvent.end_time,
        all_day: parsedEvent.all_day,
        timezone: parsedEvent.timezone || null,
        event_link: parsedEvent.event_link || null,
        attendees: parsedEvent.attendees || [],
        recurrence: parsedEvent.recurrence || null,
        status: parsedEvent.status || 'confirmed',
        last_synced_at: new Date().toISOString(),
      };

      await supabase
        .from('google_calendar_events')
        .upsert(eventData, {
          onConflict: 'user_id,google_event_id,calendar_id',
        });
    }

    // Update sync token and status
    await supabase
      .from('google_calendar_tokens')
      .update({
        sync_status: 'completed',
        sync_token: result.nextSyncToken || null,
        last_sync_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('user_id', userId);

    return {
      success: true,
      eventCount: events.length,
    };
  } catch (error: any) {
    console.error('Error syncing calendar events:', error);
    
    const supabase = await createClient();
    await supabase
      .from('google_calendar_tokens')
      .update({
        sync_status: 'error',
        error_message: error.message || 'Unknown error',
      })
      .eq('user_id', userId);

    return {
      success: false,
      error: error.message || 'Failed to sync calendar events',
    };
  }
}

