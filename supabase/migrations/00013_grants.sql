-- ============================================================
-- Explicit privileges for the API roles.
--
-- Hosted Supabase projects grant these implicitly, so the app worked
-- without them; a local `supabase start` (and any Postgres whose default
-- privileges differ) does not, and every query fails with
-- "permission denied for table …" while RLS never even gets a say.
--
-- RLS remains the authorization boundary — these are only the table-level
-- privileges RLS is evaluated on top of.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Objects created by later migrations inherit the same privileges.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;
