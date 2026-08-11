-- ============================================================
-- UPLOG · Development seed data
--
-- Demo accounts (password for all: uplog-demo-2026):
--   alex@uplog.dev  — admin,   Senior Developer
--   sarah@uplog.dev — manager, UI Designer
--   john@uplog.dev  — member,  Backend Developer
--   mike@uplog.dev  — member,  DevOps Engineer
--
-- REMOVE ALL SEED DATA with:
--   delete from auth.users where email like '%@uplog.dev';
--   delete from public.projects where id in (
--     'aaaa1111-0000-0000-0000-000000000001','aaaa1111-0000-0000-0000-000000000002',
--     'aaaa1111-0000-0000-0000-000000000003','aaaa1111-0000-0000-0000-000000000004');
--   delete from public.labels where id like 'bbbb2222%';
-- ============================================================

do $$
declare
  u_alex  uuid := '11111111-1111-1111-1111-111111111111';
  u_sarah uuid := '22222222-2222-2222-2222-222222222222';
  u_john  uuid := '33333333-3333-3333-3333-333333333333';
  u_mike  uuid := '44444444-4444-4444-4444-444444444444';
  pwd text;
  r record;
begin
  pwd := crypt('uplog-demo-2026', gen_salt('bf'));

  -- ---------- auth users (profiles auto-created by trigger) ----------
  for r in
    select * from (values
      (u_alex,  'alex@uplog.dev',  'Alex Rivera'),
      (u_sarah, 'sarah@uplog.dev', 'Sarah Chen'),
      (u_john,  'john@uplog.dev',  'John Okafor'),
      (u_mike,  'mike@uplog.dev',  'Mike Novak')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email, pwd, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      now() - interval '90 days', now()
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text,
      jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict do nothing;
  end loop;

  -- ---------- roles / titles ----------
  update public.profiles set role = 'admin',   job_title = 'Senior Developer', department = 'Engineering' where id = u_alex;
  update public.profiles set role = 'manager', job_title = 'UI Designer',      department = 'Design'      where id = u_sarah;
  update public.profiles set role = 'member',  job_title = 'Backend Developer', department = 'Engineering' where id = u_john;
  update public.profiles set role = 'member',  job_title = 'DevOps Engineer',  department = 'Platform'    where id = u_mike;

  -- ---------- projects ----------
  insert into public.projects (id, name, description, status, owner_id, start_date, due_date) values
    ('aaaa1111-0000-0000-0000-000000000001', 'Mobile App',    'Customer-facing iOS/Android application.', 'active', u_sarah, current_date - 60, current_date + 45),
    ('aaaa1111-0000-0000-0000-000000000002', 'Internal ERP',  'Back-office resource planning tools.',      'active', u_alex,  current_date - 90, current_date + 120),
    ('aaaa1111-0000-0000-0000-000000000003', 'Website',       'Marketing site redesign and CMS.',          'paused', u_sarah, current_date - 30, null),
    ('aaaa1111-0000-0000-0000-000000000004', 'API Platform',  'Public API, auth, rate limiting, docs.',    'active', u_alex,  current_date - 20, current_date + 90);

  insert into public.project_members (project_id, user_id)
  select p, u from (values
    ('aaaa1111-0000-0000-0000-000000000001'::uuid, u_alex), ('aaaa1111-0000-0000-0000-000000000001'::uuid, u_sarah), ('aaaa1111-0000-0000-0000-000000000001'::uuid, u_john),
    ('aaaa1111-0000-0000-0000-000000000002'::uuid, u_alex), ('aaaa1111-0000-0000-0000-000000000002'::uuid, u_mike),
    ('aaaa1111-0000-0000-0000-000000000003'::uuid, u_sarah),
    ('aaaa1111-0000-0000-0000-000000000004'::uuid, u_alex), ('aaaa1111-0000-0000-0000-000000000004'::uuid, u_john), ('aaaa1111-0000-0000-0000-000000000004'::uuid, u_mike)
  ) as t(p, u);

  -- ---------- labels ----------
  insert into public.labels (id, name, color) values
    ('bbbb2222-0000-0000-0000-000000000001', 'bug',      '#E5484D'),
    ('bbbb2222-0000-0000-0000-000000000002', 'feature',  '#F8694A'),
    ('bbbb2222-0000-0000-0000-000000000003', 'design',   '#8E4EC6'),
    ('bbbb2222-0000-0000-0000-000000000004', 'infra',    '#0091FF'),
    ('bbbb2222-0000-0000-0000-000000000005', 'docs',     '#30A46C');

  -- ---------- tasks (varied statuses, priorities, dates) ----------
  insert into public.tasks (id, project_id, title, description, status, priority, assignee_id, creator_id, due_date, completed_at, position) values
    ('cccc3333-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'Implement payment API',
     'Integrate the payment gateway: tokenized cards, 3-D Secure, webhooks for async status.', 'in_progress', 'high', u_alex, u_sarah, current_date + 5, null, 1),
    ('cccc3333-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001', 'Login screen redesign',
     'New auth screens following the updated design system.', 'review', 'medium', u_sarah, u_sarah, current_date + 2, null, 2),
    ('cccc3333-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001', 'Fix crash on payment confirmation',
     'App crashes when the payment webhook responds slower than 10s.', 'done', 'urgent', u_john, u_alex, current_date - 1, now() - interval '6 hours', 3),
    ('cccc3333-0000-0000-0000-000000000004', 'aaaa1111-0000-0000-0000-000000000001', 'Push notification opt-in flow',
     null, 'todo', 'low', null, u_sarah, current_date + 14, null, 4),
    ('cccc3333-0000-0000-0000-000000000005', 'aaaa1111-0000-0000-0000-000000000002', 'Quarterly report exports',
     'CSV + PDF exports for finance.', 'todo', 'medium', u_mike, u_alex, current_date + 10, null, 5),
    ('cccc3333-0000-0000-0000-000000000006', 'aaaa1111-0000-0000-0000-000000000002', 'Migrate inventory tables',
     'Normalize legacy inventory schema; zero-downtime migration.', 'in_progress', 'high', u_mike, u_alex, current_date - 2, null, 6),
    ('cccc3333-0000-0000-0000-000000000007', 'aaaa1111-0000-0000-0000-000000000003', 'New landing page hero',
     'Hero section with product screenshot and CTA.', 'cancelled', 'low', u_sarah, u_sarah, null, null, 7),
    ('cccc3333-0000-0000-0000-000000000008', 'aaaa1111-0000-0000-0000-000000000004', 'Rate limiting middleware',
     'Token bucket per API key; Redis-backed.', 'in_progress', 'urgent', u_john, u_alex, current_date + 1, null, 8),
    ('cccc3333-0000-0000-0000-000000000009', 'aaaa1111-0000-0000-0000-000000000004', 'Publish API reference docs',
     'OpenAPI spec → hosted docs with examples.', 'todo', 'medium', u_john, u_john, current_date + 7, null, 9),
    ('cccc3333-0000-0000-0000-000000000010', 'aaaa1111-0000-0000-0000-000000000004', 'Set up staging environment',
     'Mirror production infra for the API platform.', 'done', 'high', u_mike, u_mike, current_date - 3, now() - interval '2 days', 10),
    ('cccc3333-0000-0000-0000-000000000011', null, 'Team onboarding checklist',
     'Living doc for new team members.', 'todo', 'low', u_alex, u_alex, null, null, 11),
    ('cccc3333-0000-0000-0000-000000000012', 'aaaa1111-0000-0000-0000-000000000001', 'Deep-link routing audit',
     'Overdue: verify all marketing deep links resolve.', 'todo', 'high', u_john, u_sarah, current_date - 4, null, 12);

  insert into public.task_labels (task_id, label_id) values
    ('cccc3333-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002'),
    ('cccc3333-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000003'),
    ('cccc3333-0000-0000-0000-000000000003', 'bbbb2222-0000-0000-0000-000000000001'),
    ('cccc3333-0000-0000-0000-000000000006', 'bbbb2222-0000-0000-0000-000000000004'),
    ('cccc3333-0000-0000-0000-000000000008', 'bbbb2222-0000-0000-0000-000000000004'),
    ('cccc3333-0000-0000-0000-000000000009', 'bbbb2222-0000-0000-0000-000000000005'),
    ('cccc3333-0000-0000-0000-000000000010', 'bbbb2222-0000-0000-0000-000000000004');

  -- ---------- comments ----------
  insert into public.task_comments (task_id, author_id, body) values
    ('cccc3333-0000-0000-0000-000000000001', u_alex,  'Started working on the API integration. Sandbox credentials are in the vault.'),
    ('cccc3333-0000-0000-0000-000000000001', u_sarah, 'I''ll review the checkout flow once the happy path works end-to-end.'),
    ('cccc3333-0000-0000-0000-000000000003', u_john,  'Root cause: webhook handler blocked the main thread. Fixed with a background queue.'),
    ('cccc3333-0000-0000-0000-000000000008', u_john,  'Going with a token bucket per key — sliding window was overkill for v1.');

  -- ---------- daily updates ----------
  insert into public.daily_updates (user_id, update_date, summary) values
    (u_alex,  current_date,     'Implemented payment API authentication and fixed the login redirect issue.'),
    (u_sarah, current_date,     'Finished the login redesign review notes; started dashboard v2 explorations.'),
    (u_john,  current_date - 1, 'Shipped the crash fix for payment confirmation. Started the rate limiter.'),
    (u_mike,  current_date - 1, 'Staging environment for API Platform is live. Continuing the inventory migration.'),
    (u_alex,  current_date - 1, 'Paired with John on the webhook crash; reviewed ERP export requirements.');

  insert into public.daily_update_tasks (daily_update_id, task_id)
  select d.id, t.task_id::uuid
  from public.daily_updates d
  join (values
    (current_date,     '11111111-1111-1111-1111-111111111111'::uuid, 'cccc3333-0000-0000-0000-000000000001'),
    (current_date - 1, '33333333-3333-3333-3333-333333333333'::uuid, 'cccc3333-0000-0000-0000-000000000003'),
    (current_date - 1, '33333333-3333-3333-3333-333333333333'::uuid, 'cccc3333-0000-0000-0000-000000000008'),
    (current_date - 1, '44444444-4444-4444-4444-444444444444'::uuid, 'cccc3333-0000-0000-0000-000000000010'),
    (current_date - 1, '44444444-4444-4444-4444-444444444444'::uuid, 'cccc3333-0000-0000-0000-000000000006')
  ) as t(d_date, u_id, task_id)
    on d.update_date = t.d_date and d.user_id = t.u_id;
end;
$$;
