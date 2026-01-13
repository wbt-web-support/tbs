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

export interface GHLContactResponse {
  id: string
  firstName: string
  lastName: string
  contactName: string
  email: string
  phone?: string
  type?: string
  source?: string
  assignedTo?: string
  address1?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  tags?: string[]
  customFields?: any[]
  dateAdded: string
}

export interface GHLOpportunity {
  id: string
  name: string
  pipelineId: string
  pipelineStageId: string
  status: string
  monetaryValue?: number
}

export interface GHLPipeline {
  id: string
  name: string
  stages: { id: string; name: string }[]
}

export interface GHLCalendar {
  id: string
  name: string
  description?: string
}

export interface GHLAppointment {
  id: string
  calendarId: string
  contactId: string
  title: string
  startTime: string
  endTime: string
  status: string
  notes?: string
}

export interface GHLSlot {
  startTime: string
  endTime: string
}
