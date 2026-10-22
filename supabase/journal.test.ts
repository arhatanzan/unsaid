// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const privateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const publicId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

async function asRole(role: 'anon' | 'authenticated', userId: string, sql: string, params: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${role}`)
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    return tx.query(sql, params)
  })
}
beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1) - 1]
    $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
  `)
  await db.exec(readFileSync(new URL('./migrations/202610220001_journal.sql', import.meta.url), 'utf8'))
  await db.query('insert into auth.users values ($1, $2), ($3, $4)', [alice, { display_name: 'Alice' }, bob, { display_name: 'Bob' }])
  await asRole('authenticated', alice, `insert into public.notes (id, author_id, body, visibility, image_path) values
    ($1, $2, 'Private page', 'private', $3), ($4, $2, 'Public page', 'public', $5)`,
  [privateId, alice, `${alice}/private/image`, publicId, `${alice}/public/image`])
  await db.query('insert into storage.objects (bucket_id, name) values ($1, $2), ($1, $3), ($1, $4)', ['journal-images', `${alice}/private/image`, `${alice}/public/image`, `${alice}/unused/image`])
}, 30000)
afterAll(() => db.close())

describe('journal migration and database authorization', () => {
  it('creates profiles automatically without exposing account email', async () => {
    expect((await asRole('anon', '', 'select * from public.profiles order by display_name')).rows).toEqual([
      { id: alice, display_name: 'Alice' }, { id: bob, display_name: 'Bob' },
    ])
  })
  it('only exposes published notes to guests and other users', async () => {
    expect((await asRole('anon', '', 'select id from public.notes')).rows).toEqual([{ id: publicId }])
    expect((await asRole('authenticated', bob, 'select id from public.notes')).rows).toEqual([{ id: publicId }])
    expect((await asRole('authenticated', alice, 'select id from public.notes')).rows).toHaveLength(2)
  })
  it('rejects guest writing and author impersonation', async () => {
    await expect(asRole('anon', '', "insert into public.notes (body) values ('Guest')")).rejects.toThrow()
    await expect(asRole('authenticated', bob, "insert into public.notes (body, author_id) values ('Spoof', $1)", [alice])).rejects.toThrow()
  })
  it('defaults new entries to private', async () => {
    const result = await asRole('authenticated', bob, "insert into public.notes (body) values ('Bob journal') returning visibility")
    expect(result.rows).toEqual([{ visibility: 'private' }])
  })
  it('does not permit editing or deleting another author entry', async () => {
    expect((await asRole('authenticated', bob, "update public.notes set body='changed' where id=$1 returning id", [publicId])).rows).toEqual([])
    expect((await asRole('authenticated', bob, 'delete from public.notes where id=$1 returning id', [publicId])).rows).toEqual([])
  })
  it('protects note identity and image ownership', async () => {
    await expect(asRole('authenticated', alice, 'update public.notes set author_id=$1 where id=$2', [bob, privateId])).rejects.toThrow()
    await expect(asRole('authenticated', bob, "insert into public.notes (body, image_path) values ('Stolen image', $1)", [`${alice}/private/image`])).rejects.toThrow()
  })
  it('requires login and a published entry to post a comment', async () => {
    await expect(asRole('anon', '', "insert into public.comments (note_id,body) values ($1,'Hello')", [publicId])).rejects.toThrow()
    await expect(asRole('authenticated', bob, "insert into public.comments (note_id,body) values ($1,'Hello')", [privateId])).rejects.toThrow()
    await asRole('authenticated', bob, "insert into public.comments (note_id,body) values ($1,'A kind word')", [publicId])
    expect((await asRole('anon', '', 'select body from public.comments')).rows).toEqual([{ body: 'A kind word' }])
  })
  it('hides comments from everyone when an entry is made private', async () => {
    await asRole('authenticated', alice, "update public.notes set visibility='private' where id=$1", [publicId])
    expect((await asRole('anon', '', 'select * from public.comments')).rows).toEqual([])
    expect((await asRole('authenticated', bob, 'select * from public.comments')).rows).toEqual([])
    await asRole('authenticated', alice, "update public.notes set visibility='public' where id=$1", [publicId])
  })
  it('supports entry-owner comment moderation', async () => {
    expect((await asRole('authenticated', alice, 'delete from public.comments where note_id=$1 returning id', [publicId])).rows).toHaveLength(1)
  })
  it('stores bookmarks per account and cannot bookmark inaccessible notes', async () => {
    await expect(asRole('authenticated', bob, 'insert into public.bookmarks (note_id) values ($1)', [privateId])).rejects.toThrow()
    await asRole('authenticated', bob, 'insert into public.bookmarks (note_id) values ($1)', [publicId])
    expect((await asRole('authenticated', alice, 'select * from public.bookmarks')).rows).toEqual([])
    expect((await asRole('authenticated', bob, 'select * from public.bookmarks')).rows).toHaveLength(1)
  })
  it('keeps uploaded images private and permits owner orphan cleanup', async () => {
    const guest = await asRole('anon', '', 'select name from storage.objects')
    expect(guest.rows).toEqual([{ name: `${alice}/public/image` }])
    const own = await asRole('authenticated', alice, 'select name from storage.objects')
    expect(own.rows).toHaveLength(3)
    expect((await asRole('authenticated', bob, 'delete from storage.objects where name=$1 returning name', [`${alice}/private/image`])).rows).toEqual([])
    expect((await asRole('authenticated', alice, 'delete from storage.objects where name=$1 returning name', [`${alice}/unused/image`])).rows).toHaveLength(1)
  })
  it('revokes new image reads when a published entry is made private', async () => {
    await asRole('authenticated', alice, "update public.notes set visibility='private' where id=$1", [publicId])
    expect((await asRole('anon', '', 'select name from storage.objects')).rows).toEqual([])
    await asRole('authenticated', alice, "update public.notes set visibility='public' where id=$1", [publicId])
  })
  it('cascades note comments/bookmarks and still allows image cleanup after deletion', async () => {
    await asRole('authenticated', bob, "insert into public.comments (note_id,body) values ($1,'A comment')", [publicId])
    await asRole('authenticated', alice, 'delete from public.notes where id=$1', [publicId])
    expect((await asRole('authenticated', bob, 'select * from public.bookmarks')).rows).toEqual([])
    expect((await asRole('anon', '', 'select * from public.comments')).rows).toEqual([])
    expect((await asRole('authenticated', alice, 'delete from storage.objects where name=$1 returning name', [`${alice}/public/image`])).rows).toHaveLength(1)
  })
})
