-- ============================================================
-- The Creator Podium — Supabase Schema
-- ============================================================
-- BIDDING WAR RULES (enforced in application logic + DB constraints):
--   1. Each creator has exactly 10 podium spots (positions 1–10).
--   2. Position 1 is the most prestigious (and most expensive) spot.
--   3. To claim a spot you must pay MORE than the current holder's amount_paid.
--   4. The displaced fan loses their spot with NO REFUND.
--   5. Messages are pre-moderated via OpenAI before any record is inserted.
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- creators
-- Stores one row per creator. Payments flow through Stripe Connect —
-- we store the creator's connected account ID (acct_xxxxx) and use
-- the platform secret key for charges with transfer_data.
-- ------------------------------------------------------------
create table if not exists creators (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,          -- public URL: /<slug>
  stripe_account_id text,                          -- Stripe Connect acct_xxx (null until connected)
  plan_type         text not null default 'starter',
  auth_user_id      uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

-- Drop legacy BYOS columns if they still exist (idempotent migration)
alter table creators drop column if exists stripe_secret_key;
alter table creators drop column if exists stripe_webhook_secret;

-- Indexes
create index if not exists creators_slug_idx on creators (slug);
create unique index if not exists creators_auth_user_id_idx on creators (auth_user_id);

-- ------------------------------------------------------------
-- podium_spots
-- Current occupant of each position per creator.
-- Only one row per (creator_id, position) at any time.
-- Displaced fans lose their spot with NO REFUND.
-- ------------------------------------------------------------
create table if not exists podium_spots (
  id                        uuid primary key default gen_random_uuid(),
  creator_id                uuid not null references creators(id) on delete cascade,
  position                  smallint not null check (position between 1 and 10),
  fan_handle                text not null,
  fan_avatar_url            text,
  message                   text,
  amount_paid               integer not null,           -- cents (USD)
  stripe_payment_intent_id  text not null unique,
  created_at                timestamptz not null default now(),
  unique (creator_id, position)
);

create index if not exists podium_spots_creator_position_idx
  on podium_spots (creator_id, position asc);

-- ------------------------------------------------------------
-- bids (Financial Ledger)
-- Immutable — rows are NEVER deleted or overwritten.
-- Source of truth for disputes and analytics.
-- ------------------------------------------------------------
create table if not exists bids (
  id                        uuid primary key default gen_random_uuid(),
  creator_id                uuid references creators(id) on delete cascade,
  fan_handle                text not null,
  fan_avatar_url            text,
  message                   text,
  amount_paid               integer not null,           -- cents (USD)
  stripe_payment_intent_id  text unique not null,
  created_at                timestamptz default now()
);

create index if not exists bids_creator_id_idx on bids (creator_id);
create index if not exists bids_creator_amount_idx
  on bids (creator_id, amount_paid desc);

-- ------------------------------------------------------------
-- site_settings
-- Single-row global config (id is always 1).
-- Controls whether new registrations are open (FOMO mode toggle).
-- ------------------------------------------------------------
create table if not exists site_settings (
  id                    integer primary key default 1,
  is_registration_open  boolean not null default true
);

insert into site_settings (id, is_registration_open)
  values (1, true)
  on conflict (id) do nothing;

-- ------------------------------------------------------------
-- waitlist
-- Collected when is_registration_open = false.
-- Creators/fans can apply for early access from the login page.
-- ------------------------------------------------------------
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table creators      enable row level security;
alter table podium_spots  enable row level security;
alter table bids          enable row level security;
alter table site_settings enable row level security;
alter table waitlist      enable row level security;

-- Podium spots: public read
create policy if not exists "Public can read podium spots"
  on podium_spots for select using (true);

-- Bids: public read
create policy if not exists "Public can read bids"
  on bids for select using (true);

-- site_settings: public read (login page checks this without auth)
create policy if not exists "Public can read site_settings"
  on site_settings for select using (true);

-- waitlist: anyone can insert (no auth required)
create policy if not exists "Anyone can join waitlist"
  on waitlist for insert with check (true);

-- Creators: own-row access only
create policy if not exists "Creators can read own row"
  on creators for select
  using (auth.uid() = auth_user_id);

create policy if not exists "Creators can insert own row"
  on creators for insert
  with check (auth.uid() = auth_user_id);

create policy if not exists "Creators can update own row"
  on creators for update
  using (auth.uid() = auth_user_id);

-- ------------------------------------------------------------
-- Supabase Realtime
-- ------------------------------------------------------------
alter publication supabase_realtime add table podium_spots;
alter publication supabase_realtime add table bids;

-- ------------------------------------------------------------
-- process_bid_and_update_podium
-- Atomic stored procedure that inserts a bid and rebuilds the
-- podium_spots table for a creator in a single transaction.
--
-- Idempotency: ON CONFLICT DO NOTHING on stripe_payment_intent_id
-- means duplicate Stripe webhook deliveries are safely ignored.
-- The podium is always rebuilt from the top-10 bids by amount_paid.
-- ------------------------------------------------------------
create or replace function process_bid_and_update_podium(
  p_creator_id    uuid,
  p_fan_handle    text,
  p_avatar        text,
  p_message       text,
  p_amount        integer,
  p_stripe_intent text
) returns void
language plpgsql
as $$
begin
  -- Insert the bid; silently skip duplicates (Stripe retry-safety)
  insert into bids (
    creator_id, fan_handle, fan_avatar_url,
    message, amount_paid, stripe_payment_intent_id
  ) values (
    p_creator_id, p_fan_handle, p_avatar,
    p_message, p_amount, p_stripe_intent
  )
  on conflict (stripe_payment_intent_id) do nothing;

  -- Atomically rebuild podium_spots: clear then re-insert top 10
  delete from podium_spots where creator_id = p_creator_id;

  insert into podium_spots (
    creator_id, position, fan_handle, fan_avatar_url,
    message, amount_paid, stripe_payment_intent_id
  )
  select
    p_creator_id,
    row_number() over (order by amount_paid desc)::smallint as position,
    fan_handle,
    fan_avatar_url,
    message,
    amount_paid,
    stripe_payment_intent_id
  from bids
  where creator_id = p_creator_id
  order by amount_paid desc
  limit 10;
end;
$$;
