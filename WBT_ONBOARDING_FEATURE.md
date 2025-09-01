# WBT Onboarding Feature

## Overview
This feature allows superadmins to collect WBT (Work-Based Training) onboarding data when creating new users. The data is extracted from PDF files and stored in the `business_info` table for AI training purposes.

## Database Changes
A new field `wbt_onboarding` has been added to the `business_info` table:

```sql
ALTER TABLE public.business_info 
ADD COLUMN IF NOT EXISTS wbt_onboarding TEXT DEFAULT '';
```

## Features

### 1. PDF File Upload
- Users can upload PDF files directly through the form
- PDF content is automatically extracted using the existing `/api/extract/pdf` endpoint
- Extracted text is stored in the `wbt_onboarding` field

### 2. PDF URL Input
- Users can provide a direct URL to a PDF file
- PDF content is fetched and extracted from the URL
- Extracted text is stored in the `wbt_onboarding` field

### 3. Form Validation
- WBT onboarding data type selection is required
- Appropriate data (file or URL) must be provided based on selection
- Form submission is blocked until valid data is provided

### 4. User Experience
- Loading states during PDF extraction
- Success messages when content is extracted
- Preview of extracted content (first 100 characters)
- Form fields are disabled during extraction

## Implementation Details

### Frontend Changes
- Added `wbt_onboarding` and `wbt_onboarding_type` fields to `NewUserForm` interface
- Added radio buttons for selecting data type (file or URL)
- Added file upload input for PDF files
- Added URL input for PDF links
- Added loading states and success indicators
- Added validation logic

### Backend Changes
- Updated `CreateUserRequest` interface to include new fields
- Modified `/api/admin/create-user` endpoint to handle `wbt_onboarding` field
- PDF content is stored as text in the database

### API Integration
- Uses existing `/api/extract/pdf` endpoint for content extraction
- Supports both file upload and URL-based extraction
- Handles errors gracefully with user feedback

## Usage

1. **Superadmin creates a new user**
2. **Selects WBT onboarding data type**:
   - PDF File: Upload a local PDF file
   - PDF URL: Provide a direct link to a PDF
3. **PDF content is automatically extracted** and stored
4. **User is created** with the extracted onboarding data

## Benefits

- **AI Training**: Extracted text can be used to train AI models on business processes
- **Data Consistency**: Standardized format for onboarding information
- **User Experience**: Seamless integration with existing user creation flow
- **Flexibility**: Supports both file upload and URL input methods

## Technical Notes

- PDF content is truncated to 100,000 characters if it exceeds the limit
- Extracted text is stored as plain text for easy processing
- The feature integrates with existing authentication and authorization systems
- Error handling includes cleanup of failed user creation attempts
