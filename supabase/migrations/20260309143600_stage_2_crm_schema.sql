-- Migration: Stage 2 CRM Schema Baseline

-- Deals
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict not null,
  name text not null,
  description text,
  target_industry text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.deals enable row level security;
create policy "Deals are viewable by assigned organization users" on public.deals
  for all using (
    exists (
      select 1 from public.users
      where users.organization_id = deals.organization_id
      and users.id = auth.uid()
    )
  );

-- Buyers
create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  name text not null,
  description text,
  industry text,
  website text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.buyers enable row level security;
create policy "Buyers are viewable by assigned deal users" on public.buyers
  for all using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = buyers.deal_id
      and users.id = auth.uid()
    )
  );

-- Pipeline Stages (Canonical definitions)
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  name text not null, -- e.g. Preparation, Teaser, NDA, etc.
  sort_order integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.pipeline_stages enable row level security;
create policy "Pipeline stages are viewable by assigned deal users" on public.pipeline_stages
  for all using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = pipeline_stages.deal_id
      and users.id = auth.uid()
    )
  );

-- Buyer Pipeline States
create table public.buyer_pipeline_states (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade not null,
  stage_id uuid references public.pipeline_stages(id) on delete restrict not null,
  entered_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(buyer_id) -- Ensures a buyer is only in one active state at a time in this implementation
);
alter table public.buyer_pipeline_states enable row level security;
create policy "Buyer pipeline states are viewable by assigned deal users" on public.buyer_pipeline_states
  for all using (
    exists (
      select 1 from public.buyers
      join public.deals on deals.id = buyers.deal_id
      join public.users on users.organization_id = deals.organization_id
      where buyers.id = buyer_pipeline_states.buyer_id
      and users.id = auth.uid()
    )
  );

-- Function to automatically update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_timestamp_deals
  before update on public.deals
  for each row execute procedure public.handle_updated_at();

create trigger set_timestamp_buyers
  before update on public.buyers
  for each row execute procedure public.handle_updated_at();

create trigger set_timestamp_buyer_pipeline_states
  before update on public.buyer_pipeline_states
  for each row execute procedure public.handle_updated_at();
