-- CRM Demo — Supabase Schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to re-run: uses IF NOT EXISTS / DO blocks

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── practices ───────────────────────────────────────────────────────────────
create table if not exists practices (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  website text,
  notes   text,
  email   text,
  created_at timestamptz default now()
);

-- ─── practice_locations ──────────────────────────────────────────────────────
create table if not exists practice_locations (
  id               uuid primary key default gen_random_uuid(),
  practice_id      uuid references practices(id) on delete cascade,
  label            text,
  address          text,
  city             text,
  zip              text,
  phone            text,
  fax              text,
  office_hours     text,
  office_staff     text,
  receptionist_name text,
  best_days        text,
  practice_email   text,
  created_at       timestamptz default now()
);

-- ─── providers ───────────────────────────────────────────────────────────────
create table if not exists providers (
  id                  uuid primary key default gen_random_uuid(),
  first_name          text,
  last_name           text,
  degree              text,
  title               text,
  email               text,
  mobile_phone        text,
  specialty           text,
  priority            integer,
  academic_connection text,
  proj_vol            text,
  ss_vol              integer,
  general_notes       text,
  last_contact        date,
  is_target           boolean default false,
  created_at          timestamptz default now()
);

-- ─── provider_location_assignments ───────────────────────────────────────────
create table if not exists provider_location_assignments (
  id                   uuid primary key default gen_random_uuid(),
  provider_id          uuid references providers(id) on delete cascade,
  practice_location_id uuid references practice_locations(id) on delete cascade,
  is_primary           boolean default false,
  created_at           timestamptz default now(),
  unique(provider_id, practice_location_id)
);

-- ─── contact_logs ────────────────────────────────────────────────────────────
create table if not exists contact_logs (
  id                   uuid primary key default gen_random_uuid(),
  provider_id          uuid references providers(id) on delete cascade,
  contact_date         date,
  contact_time         text,
  author               text,
  notes                text,
  practice_location_id uuid references practice_locations(id) on delete set null,
  reminder_date        date,
  created_at           timestamptz default now()
);

-- ─── Row Level Security (open for demo — anon key can read/write) ─────────────
alter table practices                  enable row level security;
alter table practice_locations         enable row level security;
alter table providers                  enable row level security;
alter table provider_location_assignments enable row level security;
alter table contact_logs               enable row level security;

-- Allow anon full access (demo only — tighten for production)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'practices' and policyname = 'anon_all') then
    create policy anon_all on practices for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'practice_locations' and policyname = 'anon_all') then
    create policy anon_all on practice_locations for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'providers' and policyname = 'anon_all') then
    create policy anon_all on providers for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'provider_location_assignments' and policyname = 'anon_all') then
    create policy anon_all on provider_location_assignments for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'contact_logs' and policyname = 'anon_all') then
    create policy anon_all on contact_logs for all to anon using (true) with check (true);
  end if;
end $$;
