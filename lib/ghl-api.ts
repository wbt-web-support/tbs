import { createClient } from '@/utils/supabase/server'

// GHL API Configuration
const GHL_BASE_URL = 'https://services.leadconnectorhq.com'
const GHL_AUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation'
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

// Environment variables
const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET

export interface GHLTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
  refreshTokenId?: string
  userType: 'Company' | 'Location'
  companyId: string
  locationId?: string
  userId?: string
  isBulkInstallation?: boolean
  traceId?: string
}

export interface GHLContact {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  customFields?: Record<string, any>
  source?: string
  tags?: string[]
}


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

    // Simplified scope list as per user selection
    const scopes = [
      'oauth.readonly', 'oauth.write'
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

  async getContact(contactId: string): Promise<any> {
    return this.makeRequest(`/contacts/${contactId}`)
  }


  // Calendars
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
      // NOTE: GHL API for slots often varies, using standard one
      // startDate/endDate should be epoch milliseconds for some endpoints, or YYYY-MM-DD for others.
      // Assuming YYYY-MM-DD based on common usage or adapting if needed.
      // Reference 'nu-home-main' didn't show this explicit method in `ghl-api.ts` but `ghl-appointments.ts` used manual logic.
      // We will check standard GHL API patterns. standardized to /appointments/slots in newer API or specific construct.
      
      const endpoint = `/calendars/${calendarId}/free-slots?startDate=${startDate}&endDate=${endDate}`
      return this.makeRequest(endpoint)
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
