-- v5.9.3 (12 Nov 2026): usage stamps for the Otto side of the API bill (checklist: "Measure the whole API bill").
-- One row per Claude answer that passes through otto-proxy: which feature asked (tag), the model, and the token counts
-- Anthropic reported. Nothing in the app reads this table; it is for the bill check. Winston stamps his own in winston_log.
create table if not exists public.otto_ai_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  tag     text not null,
  model   text,
  owner   text,
  tin     integer not null default 0,
  tout    integer not null default 0,
  cache_w integer not null default 0,
  cache_r integer not null default 0
);
create index if not exists otto_ai_log_at on public.otto_ai_log (at);
alter table public.otto_ai_log enable row level security;
revoke all on public.otto_ai_log from anon, authenticated;
