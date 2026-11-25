-- Billkit tenant schema. RLS is on for every public table.
-- The Next.js server uses the service role after an explicit membership check.
-- Direct Data API access is limited to the caller's workspaces.
-- Authorization never reads user_metadata. Superadmin is app_metadata.role.

create schema if not exists private;

create or replace function private.is_member(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where workspace_id = wid
      and user_id = auth.uid()
  );
$$;

create or replace function private.is_owner(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where workspace_id = wid
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin';
$$;

revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.is_owner(uuid) from public, anon;
revoke all on function private.is_superadmin() from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;
grant execute on function private.is_superadmin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  plan text not null check (plan in ('starter', 'pro')),
  subscription_status text not null check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'none')),
  trial_ends_at date,
  stripe_customer_id text,
  stripe_subscription_id text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  invoice_prefix text not null,
  next_number integer not null,
  address text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.clients (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  email text not null,
  company text not null,
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  number text not null,
  status text not null check (status in ('draft', 'sent', 'viewed', 'paid', 'overdue', 'void')),
  issue_date date not null,
  due_date date not null,
  currency text not null default 'USD',
  tax_rate_bps integer not null,
  discount_type text not null check (discount_type in ('none', 'percent', 'fixed')),
  discount_value integer not null default 0,
  notes text not null default '',
  public_token text not null unique,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create table public.invoice_lines (
  id uuid primary key,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null,
  unit_amount_cents integer not null,
  position integer not null
);

create table public.notifications (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text not null,
  invoice_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.emails (
  id uuid primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create table public.auth_tokens (
  id uuid primary key,
  user_id uuid,
  email text not null,
  token text not null unique,
  type text not null check (type in ('magic', 'reset', 'invite')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  workspace_id uuid,
  role text,
  created_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships (user_id);
create index clients_workspace_idx on public.clients (workspace_id);
create index invoices_workspace_idx on public.invoices (workspace_id, issue_date desc);
create index invoices_token_idx on public.invoices (public_token);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);
create index notifications_user_idx on public.notifications (user_id, workspace_id, created_at desc);
create index emails_workspace_idx on public.emails (workspace_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.notifications enable row level security;
alter table public.emails enable row level security;
alter table public.auth_tokens enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.id
  )
  or private.is_superadmin()
);

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy workspaces_select on public.workspaces
for select to authenticated
using (private.is_member(id) or private.is_superadmin());

create policy workspaces_update on public.workspaces
for update to authenticated
using (private.is_owner(id))
with check (private.is_owner(id));

create policy memberships_select on public.memberships
for select to authenticated
using (private.is_member(workspace_id) or private.is_superadmin());

create policy memberships_insert on public.memberships
for insert to authenticated
with check (private.is_owner(workspace_id));

create policy memberships_delete on public.memberships
for delete to authenticated
using (private.is_owner(workspace_id) and role = 'member');

create policy clients_select on public.clients
for select to authenticated
using (private.is_member(workspace_id) or private.is_superadmin());

create policy clients_insert on public.clients
for insert to authenticated
with check (private.is_member(workspace_id));

create policy clients_update on public.clients
for update to authenticated
using (private.is_member(workspace_id))
with check (private.is_member(workspace_id));

create policy clients_delete on public.clients
for delete to authenticated
using (private.is_member(workspace_id));

create policy invoices_select on public.invoices
for select to authenticated
using (private.is_member(workspace_id) or private.is_superadmin());

create policy invoices_insert on public.invoices
for insert to authenticated
with check (private.is_member(workspace_id));

create policy invoices_update on public.invoices
for update to authenticated
using (private.is_member(workspace_id))
with check (private.is_member(workspace_id));

create policy invoices_delete on public.invoices
for delete to authenticated
using (private.is_member(workspace_id) and status = 'draft');

create policy invoice_lines_all on public.invoice_lines
for all to authenticated
using (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_lines.invoice_id
      and (private.is_member(invoices.workspace_id) or private.is_superadmin())
  )
)
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_lines.invoice_id
      and private.is_member(invoices.workspace_id)
  )
);

create policy notifications_select on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_update on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notifications_insert on public.notifications
for insert to authenticated
with check (private.is_member(workspace_id));

create policy emails_select on public.emails
for select to authenticated
using (
  (workspace_id is not null and private.is_member(workspace_id))
  or to_email = (select email from public.profiles where id = auth.uid())
);

create policy emails_insert on public.emails
for insert to authenticated
with check (workspace_id is not null and private.is_member(workspace_id));

-- auth_tokens has RLS enabled and no policies, so clients cannot read magic links or invites.

create or replace function private.protect_billing()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.jwt() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if new.plan is distinct from old.plan
    or new.subscription_status is distinct from old.subscription_status
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.cancel_at_period_end is distinct from old.cancel_at_period_end
    or new.current_period_end is distinct from old.current_period_end
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.next_number is distinct from old.next_number
  then
    raise exception 'billing and numbering are managed by the server';
  end if;
  return new;
end;
$$;

create trigger workspaces_protect_billing
before update on public.workspaces
for each row execute function private.protect_billing();

create or replace function private.lock_profile_email()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.jwt() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if new.email is distinct from old.email then
    raise exception 'email changes go through auth';
  end if;
  return new;
end;
$$;

create trigger profiles_lock_email
before update on public.profiles
for each row execute function private.lock_profile_email();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
