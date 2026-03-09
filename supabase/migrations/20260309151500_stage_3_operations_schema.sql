-- Migration: Stage 3 Operations Schema Baseline

-- Documents (Vault Foundation)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  name text not null,
  category text, -- Simple one-level grouping (e.g., Financial, Legal, Technical)
  storage_path text not null, -- Path within the Supabase Storage bucket
  uploaded_by uuid references public.users(id) on delete restrict not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.documents enable row level security;
create policy "Documents are viewable by assigned deal users" on public.documents
  for select using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = documents.deal_id
      and users.id = auth.uid()
    )
  );
create policy "Documents are insertable by assigned deal users" on public.documents
  for insert with check (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = documents.deal_id
      and users.id = auth.uid()
    )
  );

-- Communications Log
create table public.communications (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id) on delete cascade not null,
  logged_by uuid references public.users(id) on delete restrict not null,
  type text not null, -- e.g., 'Email', 'Call', 'Meeting', 'Note'
  content text not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.communications enable row level security;
create policy "Communications are viewable by assigned deal users" on public.communications
  for select using (
    exists (
      select 1 from public.buyers
      join public.deals on deals.id = buyers.deal_id
      join public.users on users.organization_id = deals.organization_id
      where buyers.id = communications.buyer_id
      and users.id = auth.uid()
    )
  );
create policy "Communications are insertable by assigned deal users" on public.communications
  for insert with check (
    exists (
      select 1 from public.buyers
      join public.deals on deals.id = buyers.deal_id
      join public.users on users.organization_id = deals.organization_id
      where buyers.id = communications.buyer_id
      and users.id = auth.uid()
    )
  );

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade not null,
  created_by uuid references public.users(id) on delete restrict not null,
  title text not null,
  description text,
  status text not null default 'pending', -- 'pending' or 'completed'
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.tasks enable row level security;
create policy "Tasks are viewable by assigned deal users" on public.tasks
  for select using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = tasks.deal_id
      and users.id = auth.uid()
    )
  );
create policy "Tasks are insertable by assigned deal users" on public.tasks
  for insert with check (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = tasks.deal_id
      and users.id = auth.uid()
    )
  );
create policy "Tasks are updatable by assigned deal users" on public.tasks
  for update using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = tasks.deal_id
      and users.id = auth.uid()
    )
  );
create policy "Tasks are deletable by assigned deal users" on public.tasks
  for delete using (
    exists (
      select 1 from public.deals
      join public.users on users.organization_id = deals.organization_id
      where deals.id = tasks.deal_id
      and users.id = auth.uid()
    )
  );

-- Storage bucket definition and policies
insert into storage.buckets (id, name, public) values ('vault', 'vault', false) on conflict do nothing;

create policy "Vault files are viewable by authenticated users" on storage.objects
  for select using (bucket_id = 'vault' and auth.role() = 'authenticated');

create policy "Vault files are insertable by authenticated users" on storage.objects
  for insert with check (bucket_id = 'vault' and auth.role() = 'authenticated');

-- Timestamps
create trigger set_timestamp_documents
  before update on public.documents
  for each row execute procedure public.handle_updated_at();

create trigger set_timestamp_communications
  before update on public.communications
  for each row execute procedure public.handle_updated_at();

create trigger set_timestamp_tasks
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();
