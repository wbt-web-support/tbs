# Project Overview: Trades Business School (TBS)

## Project Summary

**Trades Business School (TBS)** is a comprehensive Next.js-based business management and coaching platform designed for trade businesses. It provides AI-powered insights, business planning tools, course management, team collaboration, and integrations with popular business tools like QuickBooks, Xero, ServiceM8, and Google Analytics.

## Technology Stack

### Core Framework
- **Next.js 15.4.10** (App Router)
- **React 19.2.2** with TypeScript 5.7.2
- **Tailwind CSS 3.4.17** for styling
- **shadcn/ui** components library

### Backend & Database
- **Supabase** (PostgreSQL database with Row Level Security and pgvector extension for vector embeddings)
- **NextAuth.js** for authentication

### AI & Integrations
- **Google Gemini AI** (`@google/generative-ai`) for AI chat and content generation
- **OpenAI API** for embeddings and AI features
- **Vector embeddings** for contextual memory and document search

### External Integrations
- **QuickBooks Online** - Financial data sync
- **Xero** - Accounting integration
- **ServiceM8** - Field service management
- **Google Analytics** - Web analytics with OAuth
- **Zapier** - Webhook integrations

### Key Libraries
- **TipTap** - Rich text editor
- **React Query** (`@tanstack/react-query`) - Data fetching
- **React DnD** - Drag and drop functionality
- **Recharts** - Data visualization
- **PDF processing** - `pdf-parse`, `jspdf`, `mammoth`, `docx`
- **Email** - `nodemailer` for email functionality

## Project Structure

```
tbs/
├── app/                          # Next.js App Router pages
│   ├── (auth-pages)/            # Authentication pages
│   ├── (dashboard)/              # Main dashboard pages (83 files)
│   │   ├── modules/             # Course modules page
│   │   ├── chat/                # AI chat interface
│   │   ├── dashboard/           # Main dashboard
│   │   ├── team/                # Team management
│   │   └── ...                  # Other dashboard pages
│   ├── admin/                    # Admin panel (25 files)
│   │   ├── courses/             # Course management
│   │   ├── users/               # User management
│   │   ├── instructions/        # AI instructions management
│   │   └── analytics/           # Analytics management
│   ├── api/                     # API routes (83 endpoints)
│   │   ├── gemini/              # Gemini AI endpoints
│   │   ├── quickbooks/           # QuickBooks integration
│   │   ├── xero/                # Xero integration
│   │   ├── servicem8/           # ServiceM8 integration
│   │   ├── analytics/           # Google Analytics
│   │   └── ...                  # Other API endpoints
│   └── onboarding/              # User onboarding flow
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components (36 files)
│   ├── realtime-chat-gemini.tsx # Main AI chat component
│   ├── sidebar.tsx              # Navigation sidebar
│   └── ...                      # Other components
├── lib/                          # Library functions
│   ├── supabase.ts              # Supabase client
│   ├── quickbooks-api.ts        # QuickBooks integration
│   ├── xero-api.ts              # Xero integration
│   ├── servicem8-api.ts         # ServiceM8 integration
│   ├── google-analytics.ts      # GA integration
│   ├── embeddings.ts            # Vector embeddings
│   └── contextual-llm.ts        # Contextual AI
├── utils/                        # Utility functions
│   └── supabase/                # Supabase utilities
├── supabase/
│   ├── migrations/              # Database migrations (71 files)
│   └── functions/               # Edge functions
├── scripts/                      # Utility scripts
└── docs/                         # Documentation files
```

## Core Features

### 1. User Management & Authentication
- **Supabase Auth** with email/password and Google OAuth
- **Role-based access control** (super_admin, admin, user)
- **Team-based permissions** and user management
- **Onboarding flow** for new users
- **WBT (Work-Based Training) onboarding** with PDF extraction

### 2. AI-Powered Features
- **Contextual AI Chat** with Google Gemini
  - Three chat groups: Innovation, Operations, Growth
  - Document context awareness
  - Chat history management
- **AI Content Generation**
  - Business plan generation
  - Playbook creation
  - Company overview generation
- **Vector embeddings** for semantic search
- **Contextual memory** using Supabase pgvector extension

### 3. Business Management Tools
- **Dashboard** - AI-powered business insights
- **Company Overview** - Business information management
- **Business Plan** - AI-generated business plans
- **Playbooks** - Process documentation and SOPs
- **Value Machines**:
  - Growth Machine - Growth strategy planning
  - Fulfillment Machine - Operations planning
- **Quarter Planning** - Quarterly goal planning
- **Key Initiatives** - Strategic initiative tracking

### 4. Course Management System
- **Course modules** with video lessons
- **Team-based progress tracking**
- **Video player** supporting Vimeo, Loom, YouTube
- **Progress tracking** and completion status
- **Gamification** with leaderboards and points
- **Last accessed lesson** tracking

### 5. Team Collaboration
- **Team directory** with roles and departments
- **Team calendar** and scheduling
- **Leave management** system
- **Team-based permissions**
- **Invite system** for team members

### 6. External Integrations

#### QuickBooks Integration
- OAuth connection
- Financial data sync (invoices, bills, payments, customers, vendors)
- KPI calculations
- Single-table JSON storage schema

#### Xero Integration
- OAuth connection
- Accounting data sync
- Dashboard metrics
- KPI tracking

#### ServiceM8 Integration
- OAuth connection
- Job and staff data sync
- Field service management data

#### Google Analytics
- OAuth-based connection
- Analytics data dashboard
- Property management
- Historical data storage

#### Zapier Webhooks
- Webhook management
- Data mapping
- External system integration

### 7. Admin Panel
- **User management** (create, update, delete users)
- **Course management**
- **AI instructions management** (chatbot context)
- **Analytics property assignments**
- **External API data management**
- **Prompt management** for AI responses

### 8. Document Management
- **PDF extraction** and processing
- **Document upload** and storage
- **Link extraction** (web content)
- **Loom video extraction**
- **DOCX export** functionality
- **Innovation documents** management

### 9. Analytics & Reporting
- **Google Analytics dashboard**
- **External API data storage** (caching system)
- **KPI tracking** for integrated services
- **Business health analysis**

## Database Schema (Key Tables)

### Core Tables
- `business_info` - Business information and settings
- `users` / `auth.users` - User authentication
- `teams` - Team management
- `company_onboarding` - Onboarding status
- `chat_history` - AI chat conversations
- `chat_instances` - Chat session management

### Course Tables
- `courses` - Course definitions
- `course_modules` - Course modules
- `course_lessons` - Individual lessons
- `course_enrollments` - User enrollments
- `lesson_progress` - Lesson completion tracking

### Integration Tables
- `quickbooks_data` - QuickBooks financial data (JSON storage)
- `xero_connections` - Xero OAuth tokens
- `servicem8_connections` - ServiceM8 OAuth tokens
- `google_analytics_tokens` - GA OAuth tokens
- `external_api_data` - Cached external API data

### Vector/Embedding Tables
- `chatbot_instructions` - AI instructions with vector embeddings (pgvector) for semantic search
- `embedding_queue` - Queue for processing embeddings

### Other Tables
- `playbooks` - Process playbooks
- `innovation_documents` - Innovation-related documents
- `gamification_points` - Points and leaderboard
- `zapier_webhooks` - Zapier integration
- `reviews_cache` - Google reviews cache

## Environment Variables Required

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### AI Services
```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

### Google Services
```env
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Optional
GOOGLE_PLACES_API_KEY=your_places_api_key  # Optional
```

### QuickBooks
```env
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
```

### Xero
```env
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback
```

### ServiceM8
```env
SERVICEM8_CLIENT_ID=your_servicem8_client_id
SERVICEM8_CLIENT_SECRET=your_servicem8_client_secret
SERVICEM8_REDIRECT_URI=http://localhost:3000/api/servicem8/callback
```

### Email (Optional)
```env
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase
1. Create a Supabase project at https://supabase.com
2. Enable the pgvector extension in your Supabase project (Database → Extensions → Enable pgvector)
3. Run all migrations from `supabase/migrations/`
4. Set up storage buckets (if needed)
5. Configure Row Level Security policies

### 3. Configure Environment Variables
Create `.env.local` file with all required environment variables (see above).

### 4. Run Development Server
```bash
npm run dev
```

## Key Documentation Files

- `README.md` - Basic setup guide
- `QUICKBOOKS_SETUP.md` - QuickBooks integration setup
- `EXTERNAL_API_DATA_SETUP.md` - External API data storage
- `CHAT_GROUPS_IMPLEMENTATION.md` - Chat groups feature
- `WBT_ONBOARDING_FEATURE.md` - WBT onboarding feature
- `README_GOOGLE_ANALYTICS_SETUP.md` - Google Analytics setup
- `REVIEWS_SETUP.md` - Google Reviews setup
- `IMPLEMENTATION_GUIDE.md` - QuickBooks implementation guide

## Important API Endpoints

### AI & Chat
- `POST /api/gemini` - Main Gemini AI chat endpoint
- `POST /api/innovation-chat` - Innovation-specific chat
- `POST /api/gemini/generate-content` - Content generation

### Integrations
- `GET/POST /api/quickbooks/connect` - QuickBooks OAuth
- `GET/POST /api/xero/connect` - Xero OAuth
- `GET/POST /api/servicem8/connect` - ServiceM8 OAuth
- `GET /api/analytics` - Google Analytics data

### Documents
- `POST /api/extract/pdf` - Extract PDF content
- `POST /api/extract/link` - Extract web content
- `POST /api/extract/loom` - Extract Loom video content

### Admin
- `POST /api/admin/create-user` - Create new user
- `GET /api/admin/users` - List users
- `POST /api/admin/update-prompt` - Update AI prompts

## Security Features

- **Row Level Security (RLS)** on all Supabase tables
- **OAuth 2.0** for all external integrations
- **Token encryption** and secure storage
- **Role-based access control** (RBAC)
- **Middleware-based route protection**
- **User data isolation** across all features

## Development Workflow

1. **Database Changes**: Create migration files in `supabase/migrations/`
2. **API Routes**: Add new routes in `app/api/`
3. **Components**: Add reusable components in `components/`
4. **Pages**: Add new pages in `app/` directory
5. **Library Functions**: Add utility functions in `lib/` or `utils/`

## Deployment

The project is configured for deployment on **Vercel** with Supabase integration. Environment variables should be set in Vercel dashboard.

## Notes for New Team Member

1. **Database Migrations**: Always test migrations locally before applying to production
2. **Environment Variables**: Many features require specific API keys - check documentation for each integration
3. **Vector Database**: Supabase pgvector extension is used for semantic search - ensure it's enabled in your Supabase project
4. **OAuth Flows**: All integrations use OAuth - redirect URIs must match exactly
5. **RLS Policies**: All database queries respect Row Level Security - test with different user roles
6. **Team-Based Features**: Many features are team-scoped - understand team_id relationships
7. **AI Context**: The AI chat uses contextual memory - embeddings are generated and stored in Supabase using pgvector

## Common Issues & Solutions

1. **pgvector Extension**: Ensure pgvector extension is enabled in Supabase (Database → Extensions)
2. **OAuth Redirects**: Check redirect URIs match exactly in OAuth provider settings
3. **RLS Policies**: If data access fails, check RLS policies in Supabase
4. **Environment Variables**: Use `components/env-checker.tsx` to verify all required vars are set
5. **Database Migrations**: Run migrations in order - check migration file timestamps
6. **Vector Embeddings**: If embeddings fail, verify pgvector is enabled and migration files include vector column setup

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase pgvector**: https://supabase.com/docs/guides/ai/vector-columns
- **Next.js Docs**: https://nextjs.org/docs
- **Google Gemini**: https://ai.google.dev/docs
- **QuickBooks API**: https://developer.intuit.com/app/developer/qbo/docs

