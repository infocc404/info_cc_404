-- ============================================================================
-- info cc 404 — كود إعداد قاعدة البيانات وتحديث الأفواج (Supabase SQL)
-- ============================================================================
-- نفذ هذا الكود في Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================================

-- 1. إضافة عمود رقم الفوج group_no (من 1 إلى 10، أو فارغ للكل) إلى جدول الملفات
alter table public.files add column if not exists group_no smallint check (group_no between 1 and 10);

-- 2. إنشاء الجداول الأساسية إن لم تكن موجودة مسبقاً
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

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

-- 3. تفعيل الحماية وسياسات الوصول (Row Level Security - RLS)
alter table public.admins enable row level security;
alter table public.files enable row level security;

-- دالة فحص صلاحية الأدمن الآمنة (SECURITY DEFINER)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

-- تنظيف وتحديث السياسات
drop policy if exists "members read files" on public.files;
drop policy if exists "admin adds files" on public.files;
drop policy if exists "admin deletes files" on public.files;
drop policy if exists "admin reads own row" on public.admins;
drop policy if exists "admins read all or own" on public.admins;

-- سياسات جدول admins
create policy "admins read all or own" on public.admins
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- سياسات جدول files
-- جميع الطلبة المسجلين يمكنهم قراءة الملفات
create policy "members read files" on public.files
  for select to authenticated
  using (true);

-- فقط المشرفون (Admins) يمكنهم رفع وحذف الملفات
create policy "admin adds files" on public.files
  for insert to authenticated
  with check (public.is_admin());

create policy "admin deletes files" on public.files
  for delete to authenticated
  using (public.is_admin());

-- 4. إعداد مساحة التخزين الخاصة (Storage: course-files)
insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;

drop policy if exists "members read storage" on storage.objects;
drop policy if exists "admin uploads storage" on storage.objects;
drop policy if exists "admin deletes storage" on storage.objects;

create policy "members read storage" on storage.objects
  for select to authenticated
  using (bucket_id = 'course-files');

create policy "admin uploads storage" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-files' and public.is_admin());

create policy "admin deletes storage" on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-files' and public.is_admin());

-- ============================================================================
-- لتعيين نفسك كأدمن بعد تسجيل حسابك:
-- ============================================================================
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'locoviber16@gmail.com'
-- on conflict do nothing;
