begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(58);

select has_table('public', 'payment_orders', 'payment orders table exists');
select has_type('public', 'payment_order_status', 'payment order status exists');
select enum_has_labels(
  'public',
  'payment_order_status',
  array['pending', 'paid'],
  'payment order statuses are exact'
);
select columns_are(
  'public',
  'payment_orders',
  array[
    'id', 'group_id', 'member_low_id', 'member_high_id', 'amount_jpy',
    'currency', 'method', 'status', 'provider', 'provider_reference',
    'created_by', 'created_at', 'paid_at'
  ],
  'payment order columns are exact'
);
select col_not_null('public', 'payment_orders', 'amount_jpy', 'amount is required');
select col_not_null('public', 'payment_orders', 'currency', 'currency is required');
select col_not_null('public', 'payment_orders', 'status', 'status is required');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.payment_orders'::regclass),
  'payment orders have RLS enabled'
);
select has_function(
  'public', 'create_payment_order', array['uuid', 'uuid', 'uuid', 'text'],
  'authenticated order creation RPC exists'
);
select has_function(
  'public', 'confirm_payment_order', array['uuid', 'text', 'text'],
  'server-only payment confirmation RPC exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.create_payment_order(uuid,uuid,uuid,text)'::regprocedure),
  true,
  'order creation is security definer'
);
select is(
  (select proconfig from pg_proc where oid = 'public.create_payment_order(uuid,uuid,uuid,text)'::regprocedure),
  array['search_path=""']::text[],
  'order creation fixes an empty search path'
);
select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.create_payment_order(uuid,uuid,uuid,text)'::regprocedure),
  'postgres',
  'order creation is owned by postgres'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.confirm_payment_order(uuid,text,text)'::regprocedure),
  true,
  'payment confirmation is security definer'
);
select is(
  (select proconfig from pg_proc where oid = 'public.confirm_payment_order(uuid,text,text)'::regprocedure),
  array['search_path=""']::text[],
  'payment confirmation fixes an empty search path'
);
select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.confirm_payment_order(uuid,text,text)'::regprocedure),
  'postgres',
  'payment confirmation is owned by postgres'
);
select ok(
  has_function_privilege('authenticated', 'public.create_payment_order(uuid,uuid,uuid,text)', 'EXECUTE'),
  'authenticated members can create orders'
);
select ok(
  not has_function_privilege('anon', 'public.create_payment_order(uuid,uuid,uuid,text)', 'EXECUTE'),
  'anon cannot execute order creation'
);
select ok(
  has_function_privilege('service_role', 'public.confirm_payment_order(uuid,text,text)', 'EXECUTE'),
  'service role can confirm payments'
);
select ok(
  not has_function_privilege('authenticated', 'public.confirm_payment_order(uuid,text,text)', 'EXECUTE'),
  'authenticated users cannot forge payment confirmation'
);
select ok(
  not has_function_privilege('anon', 'public.confirm_payment_order(uuid,text,text)', 'EXECUTE'),
  'anon cannot confirm payments'
);
select ok(
  has_table_privilege('authenticated', 'public.payment_orders', 'SELECT'),
  'authenticated members can select visible orders'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_orders', 'INSERT'),
  'authenticated users cannot insert orders directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.payment_orders', 'UPDATE'),
  'authenticated users cannot update orders directly'
);
select ok(
  not has_table_privilege('service_role', 'public.payment_orders', 'INSERT'),
  'service role is also forced through the confirmation RPC'
);
select throws_ok(
  $$select * from public.create_payment_order(
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    'paypay'
  )$$,
  'P0001', 'UNAUTHENTICATED',
  'order creation keeps a stable unauthenticated error'
);

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'payer-1@example.test', '', now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'payer-2@example.test', '', now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), now());

create temporary table payment_group(group_id uuid, member_id uuid, invite_token text);
create temporary table payment_member(group_id uuid, member_id uuid);
grant select, insert on payment_group, payment_member to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
insert into payment_group
select * from public.create_group_and_join(
  'Payment group', 'Payer one', 'rat', 'INFP',
  '{"version":1,"zodiacId":"rat","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
insert into payment_member
select * from public.join_group(
  (select invite_token from payment_group), 'Payer two', 'ox', null,
  '{"version":1,"zodiacId":"ox","mbti":null,"dayMaster":{"element":"EARTH","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":2,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format(
    'select * from public.create_payment_order(%L,%L,%L,%L)',
    (select group_id from payment_group),
    (select member_id from payment_group),
    (select member_id from payment_member),
    'cash'
  ),
  'P0001', 'INVALID_METHOD',
  'unsupported payment methods are rejected'
);
select throws_ok(
  format(
    'select * from public.create_payment_order(%L,%L,%L,%L)',
    (select group_id from payment_group),
    (select member_id from payment_group),
    (select member_id from payment_group),
    'paypay'
  ),
  'P0001', 'INVALID_PAIR',
  'identical members are rejected'
);

create temporary table created_order as
select * from public.create_payment_order(
  (select group_id from payment_group),
  (select member_id from payment_member),
  (select member_id from payment_group),
  'paypay'
);
reset role;

select is((select count(*) from created_order), 1::bigint, 'one pending order is returned');
select is((select amount_jpy from created_order), 300, 'server fixes the price at 300 JPY');
select is((select currency from created_order), 'JPY', 'server fixes the currency to JPY');
select is((select method from created_order), 'paypay', 'selected payment method is stored');
select is((select status::text from created_order), 'pending', 'new orders are pending');
select ok((select member_low_id < member_high_id from created_order), 'order pair is canonical');
select is(
  (select created_by from created_order),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'order creator is recorded'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is(
  (select id from public.create_payment_order(
    (select group_id from payment_group),
    (select member_id from payment_group),
    (select member_id from payment_member),
    'card'
  )),
  (select id from created_order),
  'reversed duplicate order creation is idempotent across group members'
);
reset role;
select is((select count(*) from public.payment_orders), 1::bigint, 'only one order exists for the pair');

select throws_ok(
  format(
    $sql$insert into public.payment_orders(
      group_id, member_low_id, member_high_id, amount_jpy, method, created_by
    ) values (%L, least(%L::uuid,%L::uuid), greatest(%L::uuid,%L::uuid), 301, 'paypay', %L)$sql$,
    (select group_id from payment_group),
    (select member_id from payment_group), (select member_id from payment_member),
    (select member_id from payment_group), (select member_id from payment_member),
    '20000000-0000-0000-0000-000000000001'
  ),
  '23514', null,
  'table constraint rejects a client-controlled amount'
);
select throws_ok(
  format(
    $sql$insert into public.payment_orders(
      group_id, member_low_id, member_high_id, method, created_by
    ) values (%L, greatest(%L::uuid,%L::uuid), least(%L::uuid,%L::uuid), 'paypay', %L)$sql$,
    (select group_id from payment_group),
    (select member_id from payment_group), (select member_id from payment_member),
    (select member_id from payment_group), (select member_id from payment_member),
    '20000000-0000-0000-0000-000000000001'
  ),
  '23514', null,
  'table constraint rejects a reversed pair'
);
select throws_ok(
  format(
    $sql$insert into public.payment_orders(
      group_id, member_low_id, member_high_id, method, status,
      provider, provider_reference, created_by
    ) values (%L, least(%L::uuid,%L::uuid), greatest(%L::uuid,%L::uuid),
      'paypay', 'pending', 'mock', 'forged', %L)$sql$,
    (select group_id from payment_group),
    (select member_id from payment_group), (select member_id from payment_member),
    (select member_id from payment_group), (select member_id from payment_member),
    '20000000-0000-0000-0000-000000000001'
  ),
  '23514', null,
  'pending orders cannot contain forged provider confirmation data'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select throws_ok(
  format(
    'select * from public.create_payment_order(%L,%L,%L,%L)',
    (select group_id from payment_group),
    (select member_id from payment_group),
    (select member_id from payment_member),
    'paypay'
  ),
  'P0001', 'FORBIDDEN',
  'nonmembers cannot create an order'
);
select is((select count(*) from public.payment_orders), 0::bigint, 'nonmembers cannot see group orders');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format(
    'select * from public.confirm_payment_order(%L,%L,%L)',
    (select id from created_order), 'mock', 'payment-ref-1'
  ),
  '42501', 'permission denied for function confirm_payment_order',
  'browser users cannot confirm their own payments'
);
reset role;

grant select on created_order to service_role;
create temporary table confirmed_unlock as
select * from public.relation_unlocks with no data;
grant select, insert on confirmed_unlock to service_role;
set local role service_role;
insert into confirmed_unlock
select * from public.confirm_payment_order(
  (select id from created_order), 'mock', 'payment-ref-1'
);
reset role;

select is((select count(*) from confirmed_unlock), 1::bigint, 'server confirmation returns one unlock');
select is((select status::text from public.payment_orders), 'paid', 'confirmed order becomes paid');
select is((select provider from public.payment_orders), 'mock', 'provider is recorded after confirmation');
select is((select provider_reference from public.payment_orders), 'payment-ref-1', 'provider reference is recorded');
select ok((select paid_at is not null from public.payment_orders), 'paid timestamp is recorded');
select is((select payment_provider from confirmed_unlock), 'mock', 'unlock records the payment provider');
select is((select payment_reference from confirmed_unlock), 'payment-ref-1', 'unlock records the payment reference');
set local role service_role;
select is(
  (select id from public.confirm_payment_order((select id from created_order), 'mock', 'payment-ref-1')),
  (select id from confirmed_unlock),
  'duplicate webhook confirmation is idempotent'
);
select throws_ok(
  format(
    'select * from public.confirm_payment_order(%L,%L,%L)',
    (select id from created_order), 'mock', 'different-reference'
  ),
  'P0001', 'PAYMENT_CONFLICT',
  'a conflicting duplicate webhook cannot rewrite payment audit data'
);
reset role;
select is((select count(*) from public.relation_unlocks), 1::bigint, 'confirmation creates only one group-wide unlock');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format(
    'select * from public.create_payment_order(%L,%L,%L,%L)',
    (select group_id from payment_group),
    (select member_id from payment_group),
    (select member_id from payment_member),
    'paypay'
  ),
  'P0001', 'ALREADY_UNLOCKED',
  'an unlocked pair cannot be charged again'
);
reset role;

create temporary table mock_payment_group(group_id uuid, member_id uuid, invite_token text);
create temporary table mock_payment_member(group_id uuid, member_id uuid);
grant select, insert on mock_payment_group, mock_payment_member to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
insert into mock_payment_group
select * from public.create_group_and_join(
  'Mock payment group', 'Mock one', 'rabbit', null,
  '{"version":1,"zodiacId":"rabbit","mbti":null,"dayMaster":{"element":"WOOD","polarity":"YIN"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
insert into mock_payment_member
select * from public.join_group(
  (select invite_token from mock_payment_group), 'Mock two', 'horse', null,
  '{"version":1,"zodiacId":"horse","mbti":null,"dayMaster":{"element":"FIRE","polarity":"YANG"},"fiveElements":{"WOOD":1,"FIRE":2,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select lives_ok(
  format(
    'select * from public.create_payment_order(%L,%L,%L,%L)',
    (select group_id from mock_payment_group),
    (select member_id from mock_payment_group),
    (select member_id from mock_payment_member),
    'card'
  ),
  'mock checkout first creates the same server-priced order'
);
select lives_ok(
  format(
    'select * from public.unlock_relation_mock(%L,%L,%L)',
    (select group_id from mock_payment_group),
    (select member_id from mock_payment_group),
    (select member_id from mock_payment_member)
  ),
  'explicit mock checkout confirms its pending order'
);
reset role;

select is(
  (select status::text from public.payment_orders where group_id = (select group_id from mock_payment_group)),
  'paid',
  'mock checkout also transitions its order to paid'
);
select matches(
  (select provider_reference from public.payment_orders where group_id = (select group_id from mock_payment_group)),
  '^mock-',
  'mock checkout records a deterministic confirmation reference'
);

select * from finish();
rollback;
