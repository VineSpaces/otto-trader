-- v5.9.1 (11 Nov 2026): real intraday bars for the Winston 2 backtest (checklist item 1).
-- Filled by otto-proxy fn=bars_pull (admin only, Robinhood get_equity_historicals, read-only market data).
-- t = bar START (UTC). tf = '10minute' | '5minute'. Nothing in the app or in Winston reads this table.
create table if not exists public.otto_bars (
  symbol text not null,
  tf     text not null,
  t      timestamptz not null,
  o numeric not null, h numeric not null, l numeric not null, c numeric not null,
  v bigint not null default 0,
  primary key (symbol, tf, t)
);
alter table public.otto_bars enable row level security;
revoke all on public.otto_bars from anon, authenticated;
