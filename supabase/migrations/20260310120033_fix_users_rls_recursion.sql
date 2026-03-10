-- Fix infinite recursion on public.users
-- The original policy queries public.users inside the policy for public.users, causing an infinite loop.
-- We use a security definer function to bypass RLS for the lookup.

drop policy if exists "Users can view their own profile and people in their organization" on public.users;

create or replace function public.get_auth_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id from public.users where id = auth.uid();
$$;

create policy "Users can view their own profile and people in their organization" on public.users
  for select using (
    auth.uid() = id or
    organization_id = public.get_auth_user_organization_id()
  );
