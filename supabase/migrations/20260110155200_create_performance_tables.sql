-- Create performance_sessions table
CREATE TABLE IF NOT EXISTS public.performance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id uuid, -- Scoped to a team, but teams table doesn't exist as a separate entity
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    date_of_call DATE,
    attendance JSONB DEFAULT '[]'::jsonb,
    achievements JSONB DEFAULT '[]'::jsonb,
    challenges JSONB DEFAULT '[]'::jsonb,
    general_discussion TEXT,
    efficiency_score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

-- Create performance_kpis table (Fixed Structure)
CREATE TABLE IF NOT EXISTS public.performance_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.performance_sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Financials
    revenue NUMERIC DEFAULT 0,
    revenue_status TEXT DEFAULT 'todo',
    ad_spend NUMERIC DEFAULT 0,
    ad_spend_status TEXT DEFAULT 'todo',
    
    -- Leads
    leads NUMERIC DEFAULT 0,
    leads_status TEXT DEFAULT 'todo',
    surveys_booked NUMERIC DEFAULT 0,
    surveys_booked_status TEXT DEFAULT 'todo',
    
    -- Jobs
    jobs_completed NUMERIC DEFAULT 0,
    jobs_completed_status TEXT DEFAULT 'todo',
    
    -- Calculated (Efficiency)
    avg_cost_per_lead NUMERIC DEFAULT 0,
    avg_cost_per_lead_status TEXT DEFAULT 'todo',
    avg_cost_per_job NUMERIC DEFAULT 0,
    avg_cost_per_job_status TEXT DEFAULT 'todo',
    
    -- Calculated (Conversions)
    lead_to_survey_rate NUMERIC DEFAULT 0,
    lead_to_survey_rate_status TEXT DEFAULT 'todo',
    survey_to_job_rate NUMERIC DEFAULT 0,
    survey_to_job_rate_status TEXT DEFAULT 'todo',
    lead_to_job_rate NUMERIC DEFAULT 0,
    lead_to_job_rate_status TEXT DEFAULT 'todo',
    
    -- ROI
    roas NUMERIC DEFAULT 0,
    roas_status TEXT DEFAULT 'todo',
    roi_pounds NUMERIC DEFAULT 0,
    roi_pounds_status TEXT DEFAULT 'todo',
    roi_percent NUMERIC DEFAULT 0,
    roi_percent_status TEXT DEFAULT 'todo',
    
    -- Reputation
    google_reviews NUMERIC DEFAULT 0,
    google_reviews_status TEXT DEFAULT 'todo',
    review_rating NUMERIC DEFAULT 0,
    review_rating_status TEXT DEFAULT 'todo',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance_tasks table
CREATE TABLE IF NOT EXISTS public.performance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.performance_sessions(id) ON DELETE CASCADE NOT NULL,
    task_type TEXT NOT NULL, -- 'client', 'team'
    description TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_performance_sessions_updated_at') THEN
        CREATE TRIGGER update_performance_sessions_updated_at
            BEFORE UPDATE ON public.performance_sessions
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_performance_kpis_updated_at') THEN
        CREATE TRIGGER update_performance_kpis_updated_at
            BEFORE UPDATE ON public.performance_kpis
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_performance_tasks_updated_at') THEN
        CREATE TRIGGER update_performance_tasks_updated_at
            BEFORE UPDATE ON public.performance_tasks
            FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.performance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_tasks ENABLE ROW LEVEL SECURITY;

-- Policies for performance_sessions
DROP POLICY IF EXISTS "Users can view their own performance sessions" ON public.performance_sessions;
CREATE POLICY "Users can view their own performance sessions"
    ON public.performance_sessions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own performance sessions" ON public.performance_sessions;
CREATE POLICY "Users can insert their own performance sessions"
    ON public.performance_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own performance sessions" ON public.performance_sessions;
CREATE POLICY "Users can update their own performance sessions"
    ON public.performance_sessions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own performance sessions" ON public.performance_sessions;
CREATE POLICY "Users can delete their own performance sessions"
    ON public.performance_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for children (cascade via session ownership)
DROP POLICY IF EXISTS "Users can manage kpis of their own sessions" ON public.performance_kpis;
CREATE POLICY "Users can manage kpis of their own sessions"
    ON public.performance_kpis FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.performance_sessions
        WHERE id = session_id AND user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can manage tasks of their own sessions" ON public.performance_tasks;
CREATE POLICY "Users can manage tasks of their own sessions"
    ON public.performance_tasks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.performance_sessions
        WHERE id = session_id AND user_id = auth.uid()
    ));
