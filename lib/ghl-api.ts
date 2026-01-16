import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { GHLTokenResponse, GHLContact, GHLOpportunity, GHLPipeline, GHLCalendar, GHLAppointment, GHLSlot, GHLContactResponse } from './ghl-types'

// Use service role for backend operations that need to bypass RLS (like caching)
// Check for required environment variables early
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing!');
} else {
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY is present (length:', SERVICE_ROLE_KEY.length, ')');
}

if (!SUPABASE_URL) {
  console.error('❌ CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing!');
} else {
  console.log('✅ NEXT_PUBLIC_SUPABASE_URL is present:', SUPABASE_URL);
}

const supabaseAdmin = createAdminClient(
  SUPABASE_URL || '',
  SERVICE_ROLE_KEY || ''
)

// GHL API Configuration
const GHL_BASE_URL = 'https://services.leadconnectorhq.com'
const GHL_AUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation'
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

// Environment variables
const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET

export interface GHLIntegration {
  integration_id: string
  user_id: string
  team_id?: string
  location_id: string | null
  company_id: string
  user_type: 'Company' | 'Location'
  access_token: string
  refresh_token: string
  token_expires_at: string
  scope: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export class GHLAPIService {
  public accessToken: string
  private refreshToken: string
  private companyId: string
  public locationId?: string
  public userType: 'Company' | 'Location'

  constructor(accessToken: string, refreshToken: string, companyId: string, locationId?: string, userType: 'Company' | 'Location' = 'Location') {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.companyId = companyId
    this.locationId = locationId
    this.userType = userType
  }

  async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${GHL_BASE_URL}${endpoint}`
    // console.log(`🔄 Making GHL API request to: ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ GHL API Error: ${response.status} - ${errorText}`)
      
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      
      const error = new Error(`GHL API Error: ${response.status} - ${errorText}`)
      ;(error as any).errorData = errorData
      ;(error as any).status = response.status
      throw error
    }

    const data = await response.json()
    return data
  }

  // --- Auth Methods ---

  static getAuthorizationUrl(redirectUri: string, state?: string): string {
    if (!GHL_CLIENT_ID) {
      throw new Error('GHL_CLIENT_ID environment variable is not set')
    }

    // Targeted list of scopes to avoid "Invalid scope" errors
    const scopes = [
      'contacts.write', 
      'contacts.readonly', 
      'opportunities.readonly', 
      'opportunities.write', 
      'locations/customFields.readonly', 
      'calendars.readonly', 
      'calendars.write', 
      'calendars/events.readonly', 
      'calendars/events.write', 
      'calendars/groups.readonly', 
      'calendars/groups.write', 
      'calendars/resources.readonly', 
      'calendars/resources.write', 
      'invoices.write',  
      'users.readonly', 
      'oauth.readonly', 
      'oauth.write', 
      'locations/templates.readonly', 
      'locations/tags.write', 
      'locations/tags.readonly', 
      'locations/tasks.write', 
      'locations/tasks.readonly', 
      'locations/customValues.write', 
      'locations/customValues.readonly',  
      'locations/customFields.write'
    ].join(' ')

    const params = new URLSearchParams({
      client_id: GHL_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      ...(state && { state }),
    })

    // Add version_id if available (required by GHL for app versioning)
    if (process.env.GHL_VERSION_ID) {
      params.append('version_id', process.env.GHL_VERSION_ID)
    }

    return `${GHL_AUTH_URL}?${params.toString()}`
  }

  static async exchangeCodeForToken(code: string, redirectUri: string): Promise<GHLTokenResponse> {
    if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
      throw new Error('GHL_CLIENT_ID and GHL_CLIENT_SECRET environment variables must be set')
    }

    const response = await fetch(GHL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: GHL_CLIENT_ID,
        client_secret: GHL_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        user_type: 'Location',
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async refreshAccessToken(): Promise<GHLTokenResponse> {
    if (!GHL_CLIENT_ID || !GHL_CLIENT_SECRET) {
      throw new Error('GHL_CLIENT_ID and GHL_CLIENT_SECRET environment variables must be set')
    }

    const response = await fetch(GHL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: GHL_CLIENT_ID,
        client_secret: GHL_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        user_type: this.userType,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()
    this.accessToken = tokenData.access_token
    this.refreshToken = tokenData.refresh_token
    return tokenData
  }

  async getLocationToken(locationId: string): Promise<GHLTokenResponse> {
    const response = await this.makeRequest('/oauth/locationToken', {
      method: 'POST',
      body: JSON.stringify({
        companyId: this.companyId,
        locationId: locationId,
      }),
    })
    return response
  }

  // --- Start of Core Features for Port ---

  // Contacts
  async createContact(contact: GHLContact): Promise<any> {
    const contactData: any = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      address1: contact.address1,
      city: contact.city,
      state: contact.state,
      postalCode: contact.postalCode,
      country: contact.country || 'United Kingdom',
      customFields: contact.customFields || [],
      source: contact.source || 'TBS Integration',
      tags: contact.tags || ['TBS Lead'],
    }
    
    if (contact.address2) contactData.address2 = contact.address2

    let endpoint = '/contacts'
    if (this.userType === 'Location' && this.locationId) {
      contactData.locationId = this.locationId
    }

    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(contactData),
    })
  }

  async updateContact(contactId: string, contact: Partial<GHLContact>): Promise<any> {
    let endpoint = `/contacts/${contactId}`
    const contactData: any = { ...contact }
    
    if (!contactData.address2) delete contactData.address2
    delete contactData.locationId
    
    if (contactData.customFields && !Array.isArray(contactData.customFields)) {
      contactData.customFields = []
    }
    
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    })
  }

  async deleteContact(contactId: string): Promise<any> {
    return this.makeRequest(`/contacts/${contactId}`, {
      method: 'DELETE',
    })
  }

  async getContact(contactId: string): Promise<any> {
    return this.makeRequest(`/contacts/${contactId}`)
  }

  async getContacts(params: { limit?: number; offset?: number; query?: string } = {}): Promise<{ contacts: GHLContactResponse[]; meta: any }> {
    let endpoint = '/contacts'
    const queryParams = new URLSearchParams()
    
    if (this.locationId) {
      queryParams.append('locationId', this.locationId)
    } else if (this.userType === 'Location') {
      console.warn('⚠️ GHLAPIService: locationId is missing for Location-level request')
    }

    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    if (params.query) queryParams.append('query', params.query)

    const url = `${endpoint}?${queryParams.toString()}`
    console.log(`🔍 GHL getContacts: fetching from ${url}`)
    return this.makeRequest(url)
  }

  async searchContacts(query: string): Promise<GHLContactResponse[]> {
    const response = await this.getContacts({ query })
    return response.contacts
  }

  // --- Pipelines & Opportunities ---

  async getPipelines(): Promise<any[]> {
    let endpoint = '/pipelines'
    if (this.locationId) {
      endpoint += `?locationId=${this.locationId}`
    }
    const response = await this.makeRequest(endpoint)
    return response.pipelines || []
  }

  async createOpportunity(data: {
    pipelineId: string
    pipelineStageId: string
    name: string
    contactId: string
    status?: 'open' | 'won' | 'lost' | 'abandoned'
    monetaryValue?: number
  }): Promise<any> {
    const payload = {
      ...data,
      locationId: this.locationId,
      status: data.status || 'open'
    }
    return this.makeRequest('/opportunities', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  async getOpportunities(params: { pipelineId?: string; limit?: number; query?: string } = {}): Promise<any> {
    const queryParams = new URLSearchParams()
    if (this.locationId) queryParams.append('locationId', this.locationId)
    if (params.pipelineId) queryParams.append('pipelineId', params.pipelineId)
    if (params.limit) queryParams.append('limit', params.limit.toString())
    
    const endpoint = `/opportunities?${queryParams.toString()}`
    return this.makeRequest(endpoint)
  }

  // --- Calendars & Appointments ---

  async getCalendars(): Promise<any[]> {
    try {
      let endpoint = '/calendars'
      if (this.userType === 'Location' && this.locationId) {
        endpoint += `?locationId=${this.locationId}`
      }
      const response = await this.makeRequest(endpoint)
      return response.calendars || response.data || []
    } catch (error) {
       console.warn('Could not fetch calendars:', error)
       return []
    }
  }

  async getCalendarSlots(calendarId: string, startDate: string, endDate: string): Promise<any> {
      // Use the public free-slots endpoint for better compatibility
      const params = new URLSearchParams({
        startDate,
        endDate
      })
      const endpoint = `/calendars/${calendarId}/free-slots?${params.toString()}`
      return this.makeRequest(endpoint)
  }

  async getAppointments(params: { startDate?: string; endDate?: string } = {}): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (this.locationId) queryParams.append('locationId', this.locationId)
    if (params.startDate) queryParams.append('startDate', params.startDate)
    if (params.endDate) queryParams.append('endDate', params.endDate)

    const endpoint = `/appointments?${queryParams.toString()}`
    const response = await this.makeRequest(endpoint)
    return response.appointments || []
  }

  /*
   * Create Appointment
   * Merged from ghl-appointments.ts reference
   */
  async createAppointment(params: {
    calendarId: string
    startTime: string // ISO String
    endTime: string   // ISO String
    title: string
    description?: string
    contactId: string // Explicitly linking to a contact ID we likely already created
    email?: string    // Fallback if needed by API
    phone?: string    // Fallback if needed by API
  }): Promise<any> {
     const data = {
        calendarId: params.calendarId,
        locationId: this.locationId,
        contactId: params.contactId,
        startTime: params.startTime,
        endTime: params.endTime,
        title: params.title,
        notes: params.description,
        // status: 'confirmed' // Optional defaults
     }

     return this.makeRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(data)
     })
  }

}

// --- Database Helper Functions ---

/**
 * Save GHL integration to Supabase (User-centric)
 */
export async function saveGHLIntegration(
  userId: string,
  tokenData: GHLTokenResponse,
  teamId?: string
): Promise<void> {
  const supabase = await createClient()
  
  console.log('💾 saveGHLIntegration called with:', {
    userId,
    companyId: tokenData.companyId,
    locationId: tokenData.locationId,
    userType: tokenData.userType,
    teamId
  })
  
  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

  // tbs schema uses user_id, team_id
  const payload: any = {
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      company_id: tokenData.companyId,
      location_id: tokenData.locationId || null,
      user_type: tokenData.userType || 'Company',
      scope: tokenData.scope || '',
      is_active: true,
      updated_at: new Date().toISOString()
  }

  if (teamId) payload.team_id = teamId

  console.log('📦 Prepared payload:', {
    ...payload,
    access_token: '***',
    refresh_token: '***'
  })

  // First check if one exists for this user/location combo to update it
  let query = supabase.from('ghl_integrations').select('integration_id').eq('user_id', userId)
  if (tokenData.locationId) {
      query = query.eq('location_id', tokenData.locationId)
  } else {
      query = query.eq('company_id', tokenData.companyId)
  }
  
  console.log('🔍 Checking for existing integration...')
  const { data: existing, error: queryError } = await query.maybeSingle()
  
  if (queryError) {
    console.error('❌ Error querying for existing integration:', queryError)
    throw new Error(`Failed to query existing integration: ${queryError.message}`)
  }

  if (existing) {
      console.log('🔄 Updating existing integration:', existing.integration_id)
      const { error } = await supabase
          .from('ghl_integrations')
          .update(payload)
          .eq('integration_id', existing.integration_id)
      
      if (error) {
        console.error('❌ Update failed:', error)
        throw new Error(`Failed to update integration: ${error.message}`)
      }
      console.log('✅ Integration updated successfully')
  } else {
      console.log('➕ Inserting new integration')
      const { data: inserted, error } = await supabase
          .from('ghl_integrations')
          .insert(payload)
          .select()
      
      if (error) {
        console.error('❌ Insert failed:', error)
        throw new Error(`Failed to insert integration: ${error.message}`)
      }
      console.log('✅ Integration inserted successfully:', inserted)
  }
}

/**
 * Get GHL Integration for a User
 */
export async function getGHLIntegration(userId: string): Promise<GHLIntegration | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ghl_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Database error fetching GHL integration:', error)
    return null
  }

  return data
}

/**
 * Get GHL Service for a User (Handles auto-refresh)
 */
export async function getGHLService(userId: string): Promise<GHLAPIService | null> {
  const integration = await getGHLIntegration(userId)
  if (!integration) return null

  // Check Expiry
  const now = new Date()
  const expiresAt = new Date(integration.token_expires_at)
  
  if (now >= expiresAt) {
      return await refreshGHLIntegration(integration)
  }

  const service = new GHLAPIService(
      integration.access_token,
      integration.refresh_token,
      integration.company_id,
      integration.location_id ?? undefined,
      integration.user_type
  )
  return service
}

/**
 * Refresh Integration Helper
 */
export async function refreshGHLIntegration(integration: GHLIntegration): Promise<GHLAPIService | null> {
    const service = new GHLAPIService(
        integration.access_token,
        integration.refresh_token,
        integration.company_id,
        integration.location_id ?? undefined,
        integration.user_type
    )

    try {
        const newTokenData = await service.refreshAccessToken()
        
        // Save new tokens
        const supabase = await createClient()
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in)

        await supabase.from('ghl_integrations').update({
            access_token: newTokenData.access_token,
            refresh_token: newTokenData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
        }).eq('integration_id', integration.integration_id)

        return service
    } catch (e) {
        console.error('Failed to refresh GHL token:', e)
        return null
    }
}

/**
 * Save GHL Contact to Cache
 */
export async function saveGHLContactCache(
  userId: string,
  contact: GHLContactResponse,
  teamId?: string
): Promise<void> {
  if (!contact || !contact.id) {
    console.error('❌ Error caching GHL contact: Invalid contact data provided', contact)
    throw new Error('Invalid contact data provided to saveGHLContactCache')
  }

  const payload = {
    user_id: userId,
    team_id: teamId || null,
    ghl_contact_id: contact.id,
    first_name: contact.firstName,
    last_name: contact.lastName,
    contact_name: contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed Contact',
    email: contact.email,
    phone: contact.phone,
    type: contact.type || 'lead',
    source: contact.source,
    assigned_to: contact.assignedTo,
    address1: contact.address1,
    city: contact.city,
    state: contact.state,
    country: contact.country,
    postal_code: contact.postalCode,
    custom_fields: contact.customFields || [],
    tags: contact.tags || [],
    date_added: contact.dateAdded,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Aggressive logging for debug
  console.log(`--- Sync Heart-beat for ${userId} ---`)
  console.log('ENV URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('ENV ROLE KEY LENGTH:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 'MISSING')
  
  try {
    // 1. Verify admin connectivity
    const { data: test, error: testErr } = await supabaseAdmin.from('users').select('id').limit(1)
    if (testErr) {
      console.error('❌ Admin client connectivity test FAILED!')
      console.error('Test Error:', testErr.message, testErr.code)
    } else {
      console.log('✅ Admin client connectivity test PASSED')
    }

    // 2. Perform the upsert
    const response = await supabaseAdmin
      .from('ghl_contacts_cache')
      .upsert(payload, { 
        onConflict: 'user_id,ghl_contact_id' 
      })

    if (response.error) {
      console.error('❌ Supabase Upsert Error Detected!')
      console.error('Type of error object:', typeof response.error)
      console.error('Error constructor:', response.error?.constructor?.name)
      
      // Force reveal all properties
      const errorKeys = Object.getOwnPropertyNames(response.error)
      const errorObj: any = {}
      errorKeys.forEach(key => errorObj[key] = (response.error as any)[key])
      console.error('Detailed Error Object:', errorObj)
      
      throw response.error
    } else {
      console.log(`✅ Successfully cached contact: ${contact.id}`)
    }
  } catch (err: any) {
    console.error('❌ Exception caught during upsert:', err?.name || 'Error', err?.message || 'No message')
    const errKeys = err ? Object.getOwnPropertyNames(err) : []
    const detailedErr: any = {}
    errKeys.forEach(key => detailedErr[key] = err[key])
    console.error('Detailed caught error:', detailedErr)
    throw err
  }
}

/**
 * Save GHL Appointment to Local DB
 */
export async function saveGHLAppointment(
  userId: string,
  appointment: any,
  teamId?: string
): Promise<void> {
  const supabase = await createClient()
  
  const payload = {
    user_id: userId,
    team_id: teamId,
    ghl_appointment_id: appointment.id || appointment.appointmentId,
    ghl_calendar_id: appointment.calendarId,
    ghl_contact_id: appointment.contactId,
    title: appointment.title,
    description: appointment.notes || appointment.description,
    start_time: appointment.startTime,
    end_time: appointment.endTime,
    status: appointment.status,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('ghl_appointments')
    .upsert(payload, { onConflict: 'ghl_appointment_id' })

  if (error) {
    console.error('Error saving GHL appointment:', error)
    throw error
  }
}

/**
 * Get GHL Calendar Settings
 */
export async function getGHLCalendarSettings(userId: string): Promise<any[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ghl_calendar_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching GHL calendar settings:', error)
    return []
  }
  return data
}

/**
 * Save GHL Calendar setting
 */
export async function saveGHLCalendarSetting(
  userId: string,
  setting: { ghl_calendar_id: string; name: string; description?: string; purpose?: string; team_id?: string }
): Promise<void> {
  const supabase = await createClient()
  const payload = {
    user_id: userId,
    ...setting,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('ghl_calendar_settings')
    .upsert(payload)

  if (error) {
    console.error('Error saving GHL calendar setting:', error)
    throw error
  }
}

/**
 * Get GHL Field Mappings
 */
export async function getGHLFieldMappings(userId: string): Promise<any[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ghl_field_mappings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching GHL field mappings:', error)
    return []
  }
  return data
}
