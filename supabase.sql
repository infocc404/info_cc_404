-- ============================================================================
-- info cc 404 — كود إعداد قاعدة البيانات وتحديث الرتب (Supabase SQL v3)
-- ============================================================================
-- نفذ هذا الكود في Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================================

-- 1. جدول المشرفين الأساسيين (admins)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- 2. جدول رافعي الملفات المفوضين (uploaders) لكل فوج أو للكل
create table if not exists public.uploaders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  group_no smallint check (group_no between 1 and 10),
  created_at timestamptz not null default now()
);

-- 3. جدول الملفات (files)
create table if not exists public.files (
  id bigint generated always as identity primary key,
  title text not null,
  semester text not null,
  subject text not null,
  kind text not null,
  group_no smallint check (group_no between 1 and 10),
  path text not null,
  created_at timestamptz not null default now()
);

-- إضافة عمود group_no إن لم يكن موجوداً مسبقاً
alter table public.files add column if not exists group_no smallint check (group_no between 1 and 10);

-- 4. تفعيل سياسات الأمان (Row Level Security - RLS)
alter table public.admins enable row level security;
alter table public.uploaders enable row level security;
alter table public.files enable row level security;

-- 5. دالة فحص وتحديد رتبة المستخدم الحالي (my_role)
create or replace function public.my_role()
returns text
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return 'anon';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- فحص المالك (Owner) والمشرفين (Admins)
  if exists (select 1 from public.admins where user_id = v_uid) then
    if v_email = 'locoviber16@gmail.com' then
      return 'owner';
    end if;
    return 'admin';
  end if;

  -- فحص رافعي الملفات (Uploaders)
  if exists (select 1 from public.uploaders where user_id = v_uid) then
    return 'uploader';
  end if;

  return 'student';
end;
$$;

-- 6. دالة استعراض قائمة المستخدمين للمالك والمشرفين (owner_list_users)
create or replace function public.owner_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text,
  group_no smallint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- التحقق من صلاحية الاستدعاء (المشرف أو المالك فقط)
  if auth.uid() is null or not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'غير مصرح لك باستعراض قائمة المستخدمين.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    case
      when u.email = 'locoviber16@gmail.com' then 'owner'
      when a.user_id is not null then 'admin'
      when up.user_id is not null then 'uploader'
      else 'student'
    end as role,
    up.group_no
  from auth.users u
  left join public.admins a on a.user_id = u.id
  left join public.uploaders up on up.user_id = u.id
  order by u.created_at desc;
end;
$$;

-- 7. دالة تعيين رافع ملفات (owner_set_uploader)
create or replace function public.owner_set_uploader(p_user uuid, p_group smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'غير مصرح لك بتعيين رافعي الملفات.';
  end if;

  insert into public.uploaders (user_id, group_no)
  values (p_user, p_group)
  on conflict (user_id) do update set group_no = excluded.group_no;
end;
$$;

-- 8. دالة إزالة رافع ملفات (owner_remove_uploader)
create or replace function public.owner_remove_uploader(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'غير مصرح لك بإزالة رافعي الملفات.';
  end if;

  delete from public.uploaders where user_id = p_user;
end;
$$;

-- ============================================================================
-- 9. سياسات الوصول (RLS Policies)
-- ============================================================================

-- تنظيف السياسات القديمة
drop policy if exists "admins read all or own" on public.admins;
drop policy if exists "uploaders read own" on public.uploaders;
drop policy if exists "members read files" on public.files;
drop policy if exists "admin adds files" on public.files;
drop policy if exists "admin deletes files" on public.files;
drop policy if exists "uploaders or admin adds files" on public.files;
drop policy if exists "uploaders or admin deletes files" on public.files;

-- سياسة جدول admins
create policy "admins read all or own" on public.admins
  for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('admin', 'owner'));

-- سياسة جدول uploaders
create policy "uploaders read own" on public.uploaders
  for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('admin', 'owner'));

-- سياسة جدول files (القراءة متاحة لجميع المسجلين)
create policy "members read files" on public.files
  for select to authenticated
  using (true);

-- سياسة رفع الملفات: الأدمن والمالك للكل، ورافع الملفات لفوزه أو الملفات العامة
create policy "uploaders or admin adds files" on public.files
  for insert to authenticated
  with check (
    public.my_role() in ('admin', 'owner')
    or (
      public.my_role() = 'uploader'
      and (
        group_no is null
        or group_no = (select up.group_no from public.uploaders up where up.user_id = auth.uid())
      )
    )
  );

-- سياسة حذف الملفات: الأدمن والمالك فقط (أو رافع الملف لملفات فوجه)
create policy "uploaders or admin deletes files" on public.files
  for delete to authenticated
  using (
    public.my_role() in ('admin', 'owner')
    or (
      public.my_role() = 'uploader'
      and group_no = (select up.group_no from public.uploaders up where up.user_id = auth.uid())
    )
  );

-- ============================================================================
-- 10. إعداد مساحة التخزين الخاصة (Storage: course-files)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;

drop policy if exists "members read storage" on storage.objects;
drop policy if exists "admin uploads storage" on storage.objects;
drop policy if exists "admin deletes storage" on storage.objects;
drop policy if exists "authorized uploads storage" on storage.objects;
drop policy if exists "authorized deletes storage" on storage.objects;

create policy "members read storage" on storage.objects
  for select to authenticated
  using (bucket_id = 'course-files');

create policy "authorized uploads storage" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-files'
    and public.my_role() in ('admin', 'owner', 'uploader')
  );

create policy "authorized deletes storage" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-files'
    and public.my_role() in ('admin', 'owner', 'uploader')
  );

-- ============================================================================
-- لتعيين نفسك كـ Owner / Admin بعد تسجيل حسابك:
-- ============================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'locoviber16@gmail.com'
-- on conflict do nothing;
