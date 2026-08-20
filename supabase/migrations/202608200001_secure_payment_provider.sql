-- Browser clients must never be able to unlock a paid relationship directly.
-- The function remains available to the service role for local-only fixtures.
revoke all on function public.unlock_relation_mock(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.unlock_relation_mock(uuid, uuid, uuid)
  to service_role;
