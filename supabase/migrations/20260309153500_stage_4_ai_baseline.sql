-- Migration: Stage 4 AI Baseline Schema

-- ai_jobs: Tracks background processing state
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  created_by uuid references public.users(id) on delete restrict not null,
  action_type text not null, -- e.g., 'document_summarization', 'email_drafting'
  status text not null default 'pending', -- 'pending', 'processing', 'completed', 'failed'
  context jsonb not null default '{}'::jsonb, -- Store the input parameters/IDs needed for the job
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.ai_jobs enable row level security;

-- Users can view jobs in their deal
create policy "AI Jobs are viewable by assigned deal users" on public.ai_jobs
  for select using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = ai_jobs.deal_id
      and users.id = auth.uid()
    )
  );

-- Users can insert jobs into their deal
create policy "AI Jobs are insertable by assigned deal users" on public.ai_jobs
  for insert with check (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = ai_jobs.deal_id
      and users.id = auth.uid()
    )
  );

-- Only authenticated users (or the server via service key) should update the status
create policy "AI Jobs are updatable by assigned deal users" on public.ai_jobs
  for update using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = ai_jobs.deal_id
      and users.id = auth.uid()
    )
  );


-- ai_outputs: Staging area for human review
create table public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ai_jobs(id) on delete restrict not null, -- Required tie-back to the request
  deal_id uuid references public.deals(id) on delete cascade not null, -- Included for easier RLS joins
  generated_text text not null,
  status text not null default 'pending_review', -- 'pending_review', 'approved', 'discarded'
  reviewed_by uuid references public.users(id) on delete restrict,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.ai_outputs enable row level security;

create policy "AI Outputs are viewable by assigned deal users" on public.ai_outputs
  for select using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = ai_outputs.deal_id
      and users.id = auth.uid()
    )
  );

-- Allow users to update to 'approved' or 'discarded'
create policy "AI Outputs are updatable by assigned deal users" on public.ai_outputs
  for update using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = ai_outputs.deal_id
      and users.id = auth.uid()
    )
  );

-- Timestamps
create trigger set_timestamp_ai_jobs
  before update on public.ai_jobs
  for each row execute procedure public.handle_updated_at();

create trigger set_timestamp_ai_outputs
  before update on public.ai_outputs
  for each row execute procedure public.handle_updated_at();
