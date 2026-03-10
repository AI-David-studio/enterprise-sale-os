-- Migration: Initial Identity Schema

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.organizations enable row level security;


-- Users (Profiles)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  email text not null,
  first_name text,
  last_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.users enable row level security;
create policy "Users can view their own profile and people in their organization" on public.users
  for select using (
    auth.uid() = id or
    exists (
      select 1 from public.users as viewer
      where viewer.id = auth.uid()
      and viewer.organization_id = users.organization_id
    )
  );

create policy "Organizations are viewable by assigned users" on public.organizations
  for select using (
    exists (
      select 1 from public.users
      where users.organization_id = organizations.id
      and users.id = auth.uid()
    )
  );

-- Deal Roles
create table public.deal_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);
alter table public.deal_roles enable row level security;
create policy "Deal roles are globally viewable" on public.deal_roles
  for select using (auth.role() = 'authenticated');

-- Deal Members
create table public.deal_members (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null, -- references deals(id) to be added in stage 2
  user_id uuid references public.users(id) on delete cascade not null,
  role_id uuid references public.deal_roles(id) on delete restrict not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.deal_members enable row level security;
create policy "Users can view members of their own deals" on public.deal_members
  for select using (
    exists (
      select 1 from public.deal_members as viewer
      where viewer.deal_id = deal_members.deal_id
      and viewer.user_id = auth.uid()
    )
  );
