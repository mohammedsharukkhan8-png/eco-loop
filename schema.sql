-- Ecoloop Update 7: persistent database + per-user authentication
-- Run this entire script in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.waste_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('Wet Waste', 'Dry Waste')),
  amount numeric(12,2) not null check (amount > 0),
  collected_amount numeric(12,2) not null default 0 check (collected_amount >= 0 and collected_amount <= amount),
  status text not null default 'Pending' check (status in ('Pending', 'Partial', 'Collected')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.processors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  address text not null default '',
  method text not null,
  accepted_waste text[] not null default array['Wet Waste']::text[],
  created_at timestamptz not null default now(),
  check (cardinality(accepted_waste) > 0)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  waste_record_id uuid not null references public.waste_records(id) on delete restrict,
  waste_date date not null,
  waste_type text not null check (waste_type in ('Wet Waste', 'Dry Waste')),
  date date not null,
  amount numeric(12,2) not null check (amount > 0),
  collector text not null default '',
  reference text not null default '',
  processor_id uuid not null references public.processors(id) on delete restrict,
  processor_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  certificate_number text not null,
  issuer text not null,
  issue_date date not null,
  compliance_year integer not null check (compliance_year between 2000 and 2200),
  quantity numeric(12,2) not null check (quantity > 0),
  reference text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists certificates_user_number_unique
  on public.certificates (user_id, lower(certificate_number));

create index if not exists waste_records_user_date_idx on public.waste_records(user_id, date desc);
create index if not exists processors_user_idx on public.processors(user_id);
create index if not exists collections_user_date_idx on public.collections(user_id, date desc);
create index if not exists certificates_user_date_idx on public.certificates(user_id, issue_date desc);

-- Enable row-level security on every customer-data table.
alter table public.waste_records enable row level security;
alter table public.processors enable row level security;
alter table public.collections enable row level security;
alter table public.certificates enable row level security;

-- A signed-in user can access only rows belonging to their own account.
drop policy if exists "Users manage their own waste records" on public.waste_records;
create policy "Users manage their own waste records" on public.waste_records
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage their own processors" on public.processors;
create policy "Users manage their own processors" on public.processors
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage their own collections" on public.collections;
create policy "Users manage their own collections" on public.collections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users manage their own certificates" on public.certificates;
create policy "Users manage their own certificates" on public.certificates
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.waste_records to authenticated;
grant select, insert, update, delete on public.processors to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.certificates to authenticated;

-- Atomically records a pickup and updates the related waste log.
-- This prevents over-collection and keeps the pickup + collected total in sync.
create or replace function public.record_pickup(
  p_waste_record_id uuid,
  p_processor_id uuid,
  p_date date,
  p_amount numeric,
  p_collector text default '',
  p_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_record public.waste_records%rowtype;
  v_processor public.processors%rowtype;
  v_new_collected numeric(12,2);
  v_collection_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to record a pickup.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Pickup quantity must be greater than zero.';
  end if;

  select * into v_record
  from public.waste_records
  where id = p_waste_record_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Waste record not found in your workspace.';
  end if;

  select * into v_processor
  from public.processors
  where id = p_processor_id and user_id = v_user_id;

  if not found then
    raise exception 'Receiving processor not found in your workspace.';
  end if;
  if not (v_record.type = any(v_processor.accepted_waste)) then
    raise exception 'This processor does not accept the selected waste category.';
  end if;

  v_new_collected := coalesce(v_record.collected_amount, 0) + p_amount;
  if v_new_collected > v_record.amount then
    raise exception 'Pickup quantity exceeds the remaining waste quantity.';
  end if;

  insert into public.collections (
    user_id, waste_record_id, waste_date, waste_type, date, amount,
    collector, reference, processor_id, processor_name
  ) values (
    v_user_id, v_record.id, v_record.date, v_record.type, p_date, p_amount,
    coalesce(p_collector, ''), coalesce(p_reference, ''), v_processor.id, v_processor.name
  ) returning id into v_collection_id;

  update public.waste_records
  set collected_amount = v_new_collected,
      status = case when v_new_collected >= amount then 'Collected' else 'Partial' end
  where id = v_record.id and user_id = v_user_id;

  return v_collection_id;
end;
$$;

revoke all on function public.record_pickup(uuid, uuid, date, numeric, text, text) from public;
grant execute on function public.record_pickup(uuid, uuid, date, numeric, text, text) to authenticated;
