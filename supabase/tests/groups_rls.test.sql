begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

select has_type('public', 'animal_group', 'animal_group enum exists');
select enum_has_labels('public', 'animal_group', array['MOON', 'EARTH', 'SUN'], 'animal_group labels are exact');
select has_type('public', 'unlock_status', 'unlock_status enum exists');
select enum_has_labels('public', 'unlock_status', array['pending', 'unlocked', 'failed'], 'unlock_status labels are exact');
select has_table('public', 'groups', 'groups table exists');
select has_table('public', 'group_members', 'group_members table exists');
select has_table('public', 'relation_unlocks', 'relation_unlocks table exists');
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.groups'::regclass and contype = 'u' and conkey = array[(select attnum from pg_attribute where attrelid = 'public.groups'::regclass and attname = 'invite_token_hash')]::smallint[]),
  'invite token digest is unique'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.group_members'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (group_id, user_id)'),
  'membership is unique per group and user'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.relation_unlocks'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (group_id, member_low_id, member_high_id)'),
  'relation unlock is unique per canonical pair'
);
select ok(
  not exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'invite_token'
  ),
  'raw invite tokens are never stored'
);
select has_column('public', 'groups', 'invite_token_hash', 'only an invite token digest column exists');
select has_function('public', 'is_group_member', array['uuid'], 'membership helper exists');
select has_function('public', 'create_group_and_join', array['text','text','text','text','text','jsonb'], 'create RPC accepts animal group as validated text');
select has_function('public', 'join_group', array['text','text','text','text','text','jsonb'], 'join RPC accepts animal group as validated text');
select ok(
  not exists(
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('create_group_and_join', 'join_group')
      and 'public.animal_group'::regtype::oid = any(proargtypes::oid[])
  ),
  'no ambiguous enum RPC overloads remain'
);
select has_function('public', 'unlock_relation_mock', array['uuid','uuid','uuid'], 'mock unlock RPC exists');

select ok((select relrowsecurity from pg_class where oid = 'public.groups'::regclass), 'groups has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.group_members'::regclass), 'group_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.relation_unlocks'::regclass), 'relation_unlocks has RLS enabled');

set local role anon;
select throws_ok(
  $$select * from public.create_group_and_join('Team', 'Owner', 'fawn', 'MOON', null, '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  '42501', 'permission denied for function create_group_and_join', 'anon cannot execute create RPC'
);
select throws_ok(
  $$select * from public.join_group('token', 'Joiner', 'wolf', 'EARTH', null, '{"version":1,"animalId":"wolf","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  '42501', 'permission denied for function join_group', 'anon cannot execute join RPC'
);
select throws_ok(
  $$select * from public.unlock_relation_mock('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012')$$,
  '42501', 'permission denied for function unlock_relation_mock', 'anon cannot execute unlock RPC'
);
select throws_ok(statement, '42501', 'permission denied for table ' || table_name, 'anon direct ' || operation || ' denied on ' || table_name)
from (values
  ('groups', 'INSERT', 'insert into public.groups default values'),
  ('groups', 'UPDATE', 'update public.groups set name = name'),
  ('groups', 'DELETE', 'delete from public.groups'),
  ('group_members', 'INSERT', 'insert into public.group_members default values'),
  ('group_members', 'UPDATE', 'update public.group_members set nickname = nickname'),
  ('group_members', 'DELETE', 'delete from public.group_members'),
  ('relation_unlocks', 'INSERT', 'insert into public.relation_unlocks default values'),
  ('relation_unlocks', 'UPDATE', 'update public.relation_unlocks set status = status'),
  ('relation_unlocks', 'DELETE', 'delete from public.relation_unlocks')
) denied(table_name, operation, statement);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(statement, '42501', 'permission denied for table ' || table_name, 'authenticated direct ' || operation || ' denied on ' || table_name)
from (values
  ('groups', 'INSERT', 'insert into public.groups default values'),
  ('groups', 'UPDATE', 'update public.groups set name = name'),
  ('groups', 'DELETE', 'delete from public.groups'),
  ('group_members', 'INSERT', 'insert into public.group_members default values'),
  ('group_members', 'UPDATE', 'update public.group_members set nickname = nickname'),
  ('group_members', 'DELETE', 'delete from public.group_members'),
  ('relation_unlocks', 'INSERT', 'insert into public.relation_unlocks default values'),
  ('relation_unlocks', 'UPDATE', 'update public.relation_unlocks set status = status'),
  ('relation_unlocks', 'DELETE', 'delete from public.relation_unlocks')
) denied(table_name, operation, statement);
reset role;

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.unlock_relation_mock('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012')$$,
  'P0001', 'UNAUTHENTICATED', 'unlock rejects unauthenticated callers with a stable error'
);

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
select id, 'authenticated', 'authenticated', email, '', now(), now()
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'creator@example.test'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'joiner@example.test'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'outsider@example.test'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'other-owner@example.test')
) users(id, email);

select throws_ok(
  $$select * from public.create_group_and_join('Team', 'Owner', 'fawn', 'MOON', null, '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'UNAUTHENTICATED', 'create rejects unauthenticated callers with a stable error'
);
select throws_ok(
  $$select * from public.join_group('missing', 'Joiner', 'wolf', 'EARTH', null, '{"version":1,"animalId":"wolf","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'UNAUTHENTICATED', 'join rejects unauthenticated callers with a stable error'
);

create temporary table created_group(group_id uuid, member_id uuid, invite_token text);
grant select, insert on created_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into created_group
select * from public.create_group_and_join('  Best Friends  ', '  Owner  ', 'fawn', 'MOON', 'INFP', '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":"INFP","calculationMode":"date-time"}'::jsonb);
reset role;

select throws_ok(
  $$insert into public.groups(name, invite_token_hash, created_by) values (' padded', 'bad-trim', '00000000-0000-0000-0000-000000000001')$$,
  '23514', 'new row for relation "groups" violates check constraint "groups_name_check"', 'table rejects untrimmed group names'
);
select throws_ok(
  $$insert into public.groups(name, invite_token_hash, created_by) values (repeat('x', 31), 'bad-length', '00000000-0000-0000-0000-000000000001')$$,
  '23514', 'new row for relation "groups" violates check constraint "groups_name_check"', 'table rejects group names longer than 30'
);
select throws_ok(
  $$insert into public.groups(name, invite_token_hash, created_by, max_members) values ('Bad max', 'bad-max', '00000000-0000-0000-0000-000000000001', 31)$$,
  '23514', 'new row for relation "groups" violates check constraint "groups_max_members_check"', 'table enforces fixed max_members of 30'
);

select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003',' padded','fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_nickname_check"', 'table rejects untrimmed nicknames'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003',repeat('x',21),'fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_nickname_check"', 'table rejects nicknames longer than 20'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Invalid animal','dragon','MOON',null,'{"version":1,"animalId":"dragon","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_animal_id_check"', 'table enforces the animal whitelist'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Invalid MBTI','fawn','MOON','XXXX','{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":"XXXX","calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_mbti_check"', 'table enforces the MBTI whitelist'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Extra payload','fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only","secret":"x"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table enforces exact derived-only profile JSON'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Null mode','fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":null}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table rejects an explicit null calculation mode'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Missing mode','fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table rejects a missing calculation mode'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Null version','fawn','MOON',null,'{"version":null,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table rejects a null profile version'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Null animal','fawn','MOON',null,'{"version":1,"animalId":null,"animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table rejects a null payload animal'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Null group','fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":null,"mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table rejects a null payload animal group'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Null MBTI','fawn','MOON','INFP','{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_profile_payload_check"', 'table rejects null payload MBTI when scalar MBTI is non-null'
);
select throws_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Wrong mapping','fawn','EARTH',null,'{"version":1,"animalId":"fawn","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  '23514', 'new row for relation "group_members" violates check constraint "group_members_animal_group_check"', 'table rejects a valid animal paired with the wrong group'
);
delete from public.group_members where user_id = '00000000-0000-0000-0000-000000000003';
select lives_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Valid moon','fawn','MOON',null,'{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  'table accepts a representative MOON mapping'
);
delete from public.group_members where user_id = '00000000-0000-0000-0000-000000000003';
select lives_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Valid earth','wolf','EARTH',null,'{"version":1,"animalId":"wolf","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  'table accepts a representative EARTH mapping'
);
delete from public.group_members where user_id = '00000000-0000-0000-0000-000000000003';
select lives_ok(
  format($sql$insert into public.group_members(group_id,user_id,nickname,animal_id,animal_group,mbti,profile_payload) values (%L,'00000000-0000-0000-0000-000000000003','Valid sun','lion','SUN',null,'{"version":1,"animalId":"lion","animalGroup":"SUN","mbti":null,"calculationMode":"date-only"}')$sql$, (select group_id from created_group)),
  'table accepts a representative SUN mapping'
);
delete from public.group_members where user_id = '00000000-0000-0000-0000-000000000003';

select is((select name from public.groups where id = (select group_id from created_group)), 'Best Friends', 'create trims group name');
select is((select nickname from public.group_members where id = (select member_id from created_group)), 'Owner', 'create trims nickname');
select isnt((select invite_token from created_group), null, 'create returns a raw invite token once');
select isnt(
  (select invite_token_hash from public.groups where id = (select group_id from created_group)),
  (select invite_token from created_group),
  'stored invite value is a digest, not the raw token'
);
select is(
  (select invite_token_hash from public.groups where id = (select group_id from created_group)),
  encode(extensions.digest((select invite_token from created_group), 'sha256'), 'hex'),
  'stored invite digest resolves deterministically'
);

create temporary table joined_group(group_id uuid, member_id uuid);
grant select, insert on joined_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
insert into joined_group
select * from public.join_group((select invite_token from created_group), '  Joiner  ', 'wolf', 'EARTH', 'ENTJ', '{"version":1,"animalId":"wolf","animalGroup":"EARTH","mbti":"ENTJ","calculationMode":"date-time"}'::jsonb);
insert into joined_group
select * from public.join_group((select invite_token from created_group), 'Ignored', 'lion', 'SUN', null, '{"version":1,"animalId":"lion","animalGroup":"SUN","mbti":null,"calculationMode":"date-only"}'::jsonb);
reset role;

select is((select count(*) from joined_group), 2::bigint, 'repeat join returns a result each time');
select is((select count(distinct member_id) from joined_group), 1::bigint, 'repeat join returns the original member');
select is(
  (select count(*) from public.group_members where group_id = (select group_id from created_group) and user_id = '00000000-0000-0000-0000-000000000002'),
  1::bigint,
  'repeat join does not duplicate membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.groups), 0::bigint, 'nonmember cannot read groups');
select is((select count(*) from public.group_members), 0::bigint, 'nonmember cannot read members');
reset role;

create temporary table other_group(group_id uuid, member_id uuid, invite_token text);
grant select, insert on other_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
insert into other_group
select * from public.create_group_and_join('Other', 'Other owner', 'lion', 'SUN', null, '{"version":1,"animalId":"lion","animalGroup":"SUN","mbti":null,"calculationMode":"date-only"}'::jsonb);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.groups), 1::bigint, 'member reads only their group');
select is((select count(*) from public.group_members), 2::bigint, 'member reads members in their group only');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select * from public.join_group('not-a-token', 'Nope', 'fawn', 'MOON', null, '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_INVITE', 'invalid invite returns a stable error'
);
select throws_ok(
  $$select * from public.create_group_and_join('Bad animal', 'Nope', 'dragon', 'MOON', null, '{"version":1,"animalId":"dragon","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'invalid animal is rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Bad group', 'Nope', 'fawn', 'STARS', null, '{"version":1,"animalId":"fawn","animalGroup":"STARS","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'invalid animal group returns the stable profile error'
);
select throws_ok(
  format($sql$select * from public.join_group(%L, 'Bad group', 'fawn', 'STARS', null, '{"version":1,"animalId":"fawn","animalGroup":"STARS","mbti":null,"calculationMode":"date-only"}'::jsonb)$sql$, (select invite_token from created_group)),
  'P0001', 'INVALID_PROFILE', 'join invalid animal group returns the stable profile error'
);
select throws_ok(
  $$select * from public.create_group_and_join('Bad MBTI', 'Nope', 'fawn', 'MOON', 'XXXX', '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":"XXXX","calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'invalid MBTI is rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Raw arbitrary', 'Nope', 'fawn', 'MOON', null, '{"version":1,"date":"2000-01-01","time":"12:30","secret":"x"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'arbitrary raw and secret profile fields are rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('No keys', 'Nope', 'fawn', 'MOON', null, '{"version":1}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'missing derived profile keys are rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Wrong version', 'Nope', 'fawn', 'MOON', null, '{"version":2,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'derived profile version must be exactly 1'
);
select throws_ok(
  $$select * from public.create_group_and_join('Extra', 'Nope', 'fawn', 'MOON', null, '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only","extra":true}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'extra derived profile keys are rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Wrong mode', 'Nope', 'fawn', 'MOON', null, '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"approximate"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'unknown calculation mode is rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Mismatch animal', 'Nope', 'fawn', 'MOON', null, '{"version":1,"animalId":"wolf","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'payload animal must match scalar animal'
);
select throws_ok(
  $$select * from public.create_group_and_join('Mismatch group', 'Nope', 'fawn', 'MOON', null, '{"version":1,"animalId":"fawn","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'payload group must match scalar group'
);
select throws_ok(
  $$select * from public.create_group_and_join('Mismatch MBTI', 'Nope', 'fawn', 'MOON', 'INFP', '{"version":1,"animalId":"fawn","animalGroup":"MOON","mbti":null,"calculationMode":"date-only"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'payload MBTI nullability and value must match scalar MBTI'
);
select throws_ok(
  format($sql$select * from public.join_group(%L, 'Extra', 'wolf', 'EARTH', 'ENTJ', '{"version":1,"animalId":"wolf","animalGroup":"EARTH","mbti":"ENTJ","calculationMode":"date-time","secret":"x"}'::jsonb)$sql$, (select invite_token from created_group)),
  'P0001', 'INVALID_PROFILE', 'join rejects non-derived profile fields'
);
reset role;
delete from public.groups where created_by = '00000000-0000-0000-0000-000000000003';

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'capacity-' || n || '@example.test', '', now(), now()
from generate_series(1, 29) n;

do $capacity$
declare
  n integer;
begin
  -- pgTAP runs this file in one session. The group row's FOR UPDATE lock serializes
  -- competing joins; the unique (group_id, user_id) constraint is the final guard.
  -- A test-only cross-session extension would broaden database privileges, so the
  -- suite verifies the same capacity and uniqueness invariants sequentially here.
  for n in 1..28 loop
    perform set_config('request.jwt.claim.sub', ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0')), true);
    perform * from public.join_group((select invite_token from created_group), 'Member ' || n, 'koala', 'EARTH', null, '{"version":1,"animalId":"koala","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}'::jsonb);
  end loop;
end
$capacity$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000029', true);
select throws_ok(
  format($sql$select * from public.join_group(%L, 'Thirty first', 'koala', 'EARTH', null, '{"version":1,"animalId":"koala","animalGroup":"EARTH","mbti":null,"calculationMode":"date-only"}'::jsonb)$sql$, (select invite_token from created_group)),
  'P0001', 'GROUP_FULL', '31st unique user is rejected'
);
reset role;
select is((select count(*) from public.group_members where group_id = (select group_id from created_group)), 30::bigint, 'capacity remains fixed at 30');

create temporary table unlock_result(id uuid, group_id uuid, member_low_id uuid, member_high_id uuid, status public.unlock_status, payment_provider text, payment_reference text, unlocked_by uuid, unlocked_at timestamptz);
grant select, insert on unlock_result to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into unlock_result select * from public.unlock_relation_mock(
  (select group_id from created_group),
  (select member_id from created_group),
  (select member_id from joined_group limit 1)
);
insert into unlock_result select * from public.unlock_relation_mock(
  (select group_id from created_group),
  (select member_id from joined_group limit 1),
  (select member_id from created_group)
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
insert into unlock_result select * from public.unlock_relation_mock(
  (select group_id from created_group),
  (select member_id from joined_group limit 1),
  (select member_id from created_group)
);
reset role;

select is((select count(distinct id) from unlock_result), 1::bigint, 'reversed unlock calls are idempotent');
select is((select count(*) from public.relation_unlocks where group_id = (select group_id from created_group)), 1::bigint, 'only one unlock row exists for a pair');
select is((select status::text from unlock_result limit 1), 'unlocked', 'mock unlock is immediately unlocked');
select is((select payment_provider from unlock_result limit 1), 'mock', 'mock provider is recorded');
select ok((select member_low_id < member_high_id from unlock_result limit 1), 'unlock pair is stored in canonical UUID order');
select is((select unlocked_by from unlock_result order by ctid limit 1), (select unlocked_by from unlock_result order by ctid desc limit 1), 'duplicate unlock preserves original unlocked_by');
select is((select unlocked_at from unlock_result order by ctid limit 1), (select unlocked_at from unlock_result order by ctid desc limit 1), 'duplicate unlock preserves original unlocked_at');
select is((select payment_provider from unlock_result order by ctid limit 1), (select payment_provider from unlock_result order by ctid desc limit 1), 'duplicate unlock preserves provider');
select is((select payment_reference from unlock_result order by ctid limit 1), (select payment_reference from unlock_result order by ctid desc limit 1), 'duplicate unlock preserves payment reference');
select is((select status from unlock_result order by ctid limit 1), (select status from unlock_result order by ctid desc limit 1), 'duplicate unlock preserves status');

select throws_ok(
  format($sql$insert into public.relation_unlocks(group_id,member_low_id,member_high_id,status,payment_provider,unlocked_by) values (%L,%L,%L,'unlocked','mock','00000000-0000-0000-0000-000000000001')$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from created_group)),
  '23514', 'new row for relation "relation_unlocks" violates check constraint "relation_unlocks_ordered_pair_check"', 'table rejects unordered or identical pairs'
);
select throws_ok(
  format($sql$insert into public.relation_unlocks(group_id,member_low_id,member_high_id,status,payment_provider,unlocked_by) values (%L,greatest(%L::uuid,%L::uuid),least(%L::uuid,%L::uuid),'unlocked','mock','00000000-0000-0000-0000-000000000001')$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from joined_group limit 1), (select member_id from created_group), (select member_id from joined_group limit 1)),
  '23514', 'new row for relation "relation_unlocks" violates check constraint "relation_unlocks_ordered_pair_check"', 'table rejects a distinct reversed pair'
);
select throws_ok(
  format($sql$insert into public.relation_unlocks(group_id,member_low_id,member_high_id,status,payment_provider,unlocked_by) values (%L,least(%L::uuid,%L::uuid),greatest(%L::uuid,%L::uuid),'unlocked','mock','00000000-0000-0000-0000-000000000001')$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from other_group), (select member_id from created_group), (select member_id from other_group)),
  '23503', null, 'composite foreign keys reject cross-group pairs at the table boundary'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format($sql$select * from public.unlock_relation_mock(%L, %L, %L)$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from other_group)),
  'P0001', 'INVALID_PAIR', 'cross-group unlock pair is rejected'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(
  format($sql$select * from public.unlock_relation_mock(%L, %L, %L)$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from joined_group limit 1)),
  'P0001', 'FORBIDDEN', 'unrelated user cannot unlock a relation'
);
select is((select count(*) from public.relation_unlocks), 0::bigint, 'unrelated user cannot read unlocks');
reset role;

select ok(
  exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'),
  'group_members is in the realtime publication'
);
select ok(
  exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relation_unlocks'),
  'relation_unlocks is in the realtime publication'
);

select * from finish();
rollback;
