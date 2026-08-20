-- Pre-launch price reset: no live charges existed when the relation price changed.
-- Unlock history remains intact; only local/test payment attempts are discarded.
delete from public.payment_orders;

alter table public.payment_orders
  drop constraint if exists payment_orders_amount_jpy_check;

alter table public.payment_orders
  alter column amount_jpy set default 100;

alter table public.payment_orders
  add constraint payment_orders_amount_jpy_check check (amount_jpy = 100);
