begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60)
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'A quiet soul'), 60));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''), 'A quiet soul'), 60)
from auth.users on conflict (id) do nothing;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 10000),
  entry_date date not null default current_date,
  mood text not null default 'reflective' check (mood in ('reflective', 'heavy', 'hopeful', 'peaceful', 'unsettled')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  image_path text unique,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (title || ' ' || body) stored,
  constraint note_content check (length(trim(body)) > 0 or image_path is not null or image_url is not null),
  constraint note_one_image check (image_path is null or image_url is null),
  constraint note_image_url check (image_url is null or image_url ~ '^https://[^[:space:]]+$'),
  constraint note_image_owner check (image_path is null or split_part(image_path, '/', 1) = author_id::text)
);
create index notes_author_date on public.notes(author_id, entry_date desc);
create index notes_public_date on public.notes(entry_date desc) where visibility = 'public';

create function public.touch_note()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.author_id <> old.author_id or new.created_at <> old.created_at then
    raise exception 'Entry identity cannot be changed.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger notes_updated before update on public.notes
for each row execute procedure public.touch_note();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_note_date on public.comments(note_id, created_at);

create table public.bookmarks (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  primary key (user_id, note_id)
);

alter table public.profiles enable row level security;
alter table public.notes enable row level security;
alter table public.comments enable row level security;
alter table public.bookmarks enable row level security;

create policy "Public pen names" on public.profiles for select to anon, authenticated using (true);
create policy "Read published entries or your own journal" on public.notes
for select to anon, authenticated using (visibility = 'public' or author_id = (select auth.uid()));
create policy "Write your own entries" on public.notes for insert to authenticated
with check (author_id = (select auth.uid()));
create policy "Edit your own entries" on public.notes for update to authenticated
using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Delete your own entries" on public.notes for delete to authenticated
using (author_id = (select auth.uid()));

create policy "Read comments only on published entries" on public.comments for select to anon, authenticated
using (exists (select 1 from public.notes where notes.id = note_id and notes.visibility = 'public'));
create policy "Comment only on published entries" on public.comments for insert to authenticated
with check (author_id = (select auth.uid()) and exists (
  select 1 from public.notes where notes.id = note_id and notes.visibility = 'public'
));
create policy "Remove your own comments or moderate your entry" on public.comments for delete to authenticated
using (author_id = (select auth.uid()) or exists (
  select 1 from public.notes where notes.id = note_id and notes.author_id = (select auth.uid())
));

create policy "Read your bookmarks for accessible entries" on public.bookmarks for select to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.notes where notes.id = note_id));
create policy "Bookmark an accessible entry" on public.bookmarks for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.notes where notes.id = note_id));
create policy "Remove your bookmark" on public.bookmarks for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.profiles, public.notes, public.comments, public.bookmarks from anon, authenticated;
grant select on public.profiles, public.notes, public.comments to anon, authenticated;
grant insert, update, delete on public.notes to authenticated;
grant insert, delete on public.comments to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
revoke execute on function public.handle_new_user() from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-images', 'journal-images', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy "Upload images to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read images only with entry access" on storage.objects for select to anon, authenticated
using (bucket_id = 'journal-images' and ((storage.foldername(name))[1] = (select auth.uid())::text or exists (
  select 1 from public.notes where notes.image_path = name
  and (notes.visibility = 'public' or notes.author_id = (select auth.uid()))
)));
create policy "Remove your uploaded images" on storage.objects for delete to authenticated
using (bucket_id = 'journal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
