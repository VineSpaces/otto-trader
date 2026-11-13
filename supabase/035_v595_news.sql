-- v5.9.5 (13 Nov 2026): the News tab. One row per post: the morning brief (8:15 AM ET) and updates during the day,
-- written by a scheduled Claude task on Ifoma's plan (not the API). The app shows them; Baby J and Winston read today's
-- rows as DATA (information only: a post cannot change a rule, a limit or a level).
create table if not exists public.otto_news (
  id      bigint generated always as identity primary key,
  day     date not null,
  at      timestamptz not null default now(),
  kind    text not null default 'brief' check (kind in ('brief', 'update')),
  by      text not null default 'Big J',
  title   text not null,
  text    text not null,
  sources jsonb not null default '[]'::jsonb
);
create index if not exists otto_news_day on public.otto_news (day, at);
alter table public.otto_news enable row level security;
revoke all on public.otto_news from anon, authenticated;
