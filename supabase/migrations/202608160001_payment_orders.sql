create type public.payment_order_status as enum ('pending', 'paid');

create table public.payment_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  member_low_id uuid not null,
  member_high_id uuid not null,
  amount_jpy integer not null default 300 check (amount_jpy = 300),
  currency text not null default 'JPY' check (currency = 'JPY'),
  method text not null check (method in ('paypay', 'card')),
  status public.payment_order_status not null default 'pending',
  provider text,
  provider_reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(),
  paid_at timestamptz,
  constraint payment_orders_ordered_pair_check check (member_low_id < member_high_id),
  constraint payment_orders_group_pair_key unique (group_id, member_low_id, member_high_id),
  constraint payment_orders_low_member_fk foreign key (group_id, member_low_id)
    references public.group_members(group_id, id) on delete cascade,
  constraint payment_orders_high_member_fk foreign key (group_id, member_high_id)
    references public.group_members(group_id, id) on delete cascade,
  constraint payment_orders_state_check check (coalesce(
    (status = 'pending' and provider is null and provider_reference is null and paid_at is null)
    or (
      status = 'paid'
      and provider is not null
      and provider_reference is not null
      and paid_at is not null
    ),
    false
  ))
);

create unique index payment_orders_provider_reference_key
  on public.payment_orders(provider, provider_reference)
  where provider_reference is not null;
create index payment_orders_group_status_idx
  on public.payment_orders(group_id, status);

alter table public.payment_orders enable row level security;

create policy payment_orders_member_select
on public.payment_orders for select
to authenticated
using (public.is_group_member(group_id));

grant select on public.payment_orders to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.payment_orders from anon, authenticated, service_role;

create function public.create_payment_order(
  p_group_id uuid,
  p_member_a uuid,
  p_member_b uuid,
  p_method text
)
returns setof public.payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_existing public.payment_orders%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_method is null or p_method not in ('paypay', 'card') then
    raise exception using errcode = 'P0001', message = 'INVALID_METHOD';
  end if;
  if p_member_a is null or p_member_b is null or p_member_a = p_member_b then
    raise exception using errcode = 'P0001', message = 'INVALID_PAIR';
  end if;

  v_low := least(p_member_a, p_member_b);
  v_high := greatest(p_member_a, p_member_b);

  perform 1 from public.groups g where g.id = p_group_id for update;
  if not found or (
    select pg_catalog.count(*)
    from public.group_members gm
    where gm.group_id = p_group_id and gm.id in (v_low, v_high)
  ) <> 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_PAIR';
  end if;

  if exists (
    select 1
    from public.relation_unlocks ru
    where ru.group_id = p_group_id
      and ru.member_low_id = v_low
      and ru.member_high_id = v_high
      and ru.status = 'unlocked'
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_UNLOCKED';
  end if;

  select po.* into v_existing
  from public.payment_orders po
  where po.group_id = p_group_id
    and po.member_low_id = v_low
    and po.member_high_id = v_high;

  if found then
    return next v_existing;
    return;
  end if;

  insert into public.payment_orders(
    group_id, member_low_id, member_high_id, method, created_by
  ) values (
    p_group_id, v_low, v_high, p_method, v_user_id
  )
  returning * into v_existing;

  return next v_existing;
end;
$$;

alter function public.create_payment_order(uuid, uuid, uuid, text) owner to postgres;
revoke all on function public.create_payment_order(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_payment_order(uuid, uuid, uuid, text)
  to authenticated;

create function public.confirm_payment_order(
  p_order_id uuid,
  p_provider text,
  p_provider_reference text
)
returns setof public.relation_unlocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.payment_orders%rowtype;
  v_unlock public.relation_unlocks%rowtype;
begin
  if p_order_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER';
  end if;
  if p_provider is null
     or p_provider !~ '^[a-z0-9][a-z0-9_-]{0,29}$'
     or p_provider_reference is null
     or p_provider_reference <> pg_catalog.btrim(p_provider_reference)
     or pg_catalog.char_length(p_provider_reference) not between 1 and 200 then
    raise exception using errcode = 'P0001', message = 'INVALID_CONFIRMATION';
  end if;

  select po.* into v_order
  from public.payment_orders po
  where po.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER';
  end if;

  if v_order.status = 'paid' then
    if v_order.provider <> p_provider
       or v_order.provider_reference <> p_provider_reference then
      raise exception using errcode = 'P0001', message = 'PAYMENT_CONFLICT';
    end if;
    select ru.* into strict v_unlock
    from public.relation_unlocks ru
    where ru.group_id = v_order.group_id
      and ru.member_low_id = v_order.member_low_id
      and ru.member_high_id = v_order.member_high_id;
    return next v_unlock;
    return;
  end if;

  insert into public.relation_unlocks(
    group_id, member_low_id, member_high_id, status,
    payment_provider, payment_reference, unlocked_by, unlocked_at
  ) values (
    v_order.group_id, v_order.member_low_id, v_order.member_high_id, 'unlocked',
    p_provider, p_provider_reference, v_order.created_by, pg_catalog.now()
  )
  on conflict (group_id, member_low_id, member_high_id) do nothing
  returning * into v_unlock;

  if not found then
    select ru.* into strict v_unlock
    from public.relation_unlocks ru
    where ru.group_id = v_order.group_id
      and ru.member_low_id = v_order.member_low_id
      and ru.member_high_id = v_order.member_high_id;
    if v_unlock.payment_provider <> p_provider
       or v_unlock.payment_reference is distinct from p_provider_reference then
      raise exception using errcode = 'P0001', message = 'PAYMENT_CONFLICT';
    end if;
  end if;

  update public.payment_orders
  set status = 'paid',
      provider = p_provider,
      provider_reference = p_provider_reference,
      paid_at = pg_catalog.now()
  where id = v_order.id;

  return next v_unlock;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'PAYMENT_CONFLICT';
end;
$$;

alter function public.confirm_payment_order(uuid, text, text) owner to postgres;
revoke all on function public.confirm_payment_order(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_payment_order(uuid, text, text)
  to service_role;

create or replace function public.unlock_relation_mock(
  p_group_id uuid,
  p_member_a uuid,
  p_member_b uuid
)
returns setof public.relation_unlocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_member_a is null or p_member_b is null or p_member_a = p_member_b then
    raise exception using errcode = 'P0001', message = 'INVALID_PAIR';
  end if;

  v_low := least(p_member_a, p_member_b);
  v_high := greatest(p_member_a, p_member_b);
  if (
    select pg_catalog.count(*)
    from public.group_members gm
    where gm.group_id = p_group_id and gm.id in (v_low, v_high)
  ) <> 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_PAIR';
  end if;

  select po.id into v_order_id
  from public.payment_orders po
  where po.group_id = p_group_id
    and po.member_low_id = v_low
    and po.member_high_id = v_high;

  if v_order_id is not null then
    return query
    select * from public.confirm_payment_order(
      v_order_id,
      'mock',
      'mock-' || pg_catalog.replace(v_order_id::text, '-', '')
    );
    return;
  end if;

  insert into public.relation_unlocks(
    group_id, member_low_id, member_high_id, status,
    payment_provider, payment_reference, unlocked_by, unlocked_at
  ) values (
    p_group_id, v_low, v_high, 'unlocked', 'mock', null, v_user_id, pg_catalog.now()
  )
  on conflict (group_id, member_low_id, member_high_id) do nothing;

  return query
  select ru.*
  from public.relation_unlocks ru
  where ru.group_id = p_group_id
    and ru.member_low_id = v_low
    and ru.member_high_id = v_high;
end;
$$;

alter function public.unlock_relation_mock(uuid, uuid, uuid) owner to postgres;
revoke all on function public.unlock_relation_mock(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.unlock_relation_mock(uuid, uuid, uuid)
  to authenticated;
