# The Unsaid

An atmospheric personal journal and opt-in community, built with React, TypeScript, Tailwind CSS, Vite, and Supabase. Hosted on Netlify at https://how-i-died.netlify.app.

## Local development

Use Node 24 or newer.

```sh
npm install
cp .env.example .env.local
```

Set these **public client** values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-or-anon-key
```

This is a Vite app: `NEXT_PUBLIC_*` variables are not used. Never put a Supabase service-role key, database password, or account access token in a `VITE_*` variable or source control.

```sh
npm run dev
npm test
npm run build
npm run preview
```

The app displays an explicit setup notice when client configuration is absent, and an error if the database migration is missing. It never substitutes browser storage for a failed cloud save.

## Supabase database setup

The Supabase CLI is included as a development dependency. Authenticate **in your own terminal**; the publishable client key cannot authorize schema changes.

```sh
npx supabase login
npx supabase link --project-ref ucsxupfbihmezkboosnj
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

The first migration already exists at [supabase/migrations/202610220001_journal.sql](supabase/migrations/202610220001_journal.sql). Do not create a second empty migration for initial setup. Review the dry run before pushing; this migration adds profiles, notes, comments, bookmarks, database access policies, and the private `journal-images` bucket. It does not replace existing tables. If these table names already exist, reconcile the schema before applying it.

Alternatively, run the migration in the Supabase project's SQL Editor. If you subsequently adopt CLI migrations, reconcile the applied migration history with `supabase migration repair` before pushing it again.

For a separate local Supabase stack (requires working Docker permissions):

```sh
npx supabase start
```

Use the local URL/public key printed by the CLI instead of the hosted project settings. The committed `supabase/config.toml` configures local development only; it does **not** change a hosted project's authentication settings.

## Hosted authentication configuration

In Supabase **Authentication → URL Configuration**:

- Site URL: `https://how-i-died.netlify.app`
- Redirect URLs:
  - `https://how-i-died.netlify.app`
  - `https://how-i-died.netlify.app/**`
  - `http://localhost:5173`
  - `http://localhost:5173/**`

Enable email/password authentication, email confirmation, and a minimum password length of 8. Configure production SMTP before launch; Supabase's default email service has recipient and rate limitations. Only add trusted preview URLs to the redirect allowlist, and preferably use a separate Supabase project for previews.

Registration and recovery emails must be opened in the browser that requested them because the app uses PKCE. Email/password login, account verification, password recovery, automatic session restoration/renewal, refreshing the current session, signing out locally, and signing out everywhere are implemented. Global sign-out revokes refresh tokens; already issued access tokens on other devices remain valid until expiry. No device inventory is claimed.

## Netlify

[netlify.toml](netlify.toml) supplies the build command (`npm run build`), output directory (`dist`), Node 24, security headers, and the single-page application redirect.

Set the same two `VITE_SUPABASE_*` variables in the site's **Environment variables**, scoped to **Builds**, then redeploy. These values are embedded into the frontend at build time; changing Netlify settings without a rebuild is insufficient. A site/team administrator may be needed to edit environment variables.

If authorized through the Netlify CLI:

```sh
netlify link --id b1a1d623-63e4-45db-b38d-022850c40b37
netlify env:set VITE_SUPABASE_URL https://ucsxupfbihmezkboosnj.supabase.co
netlify env:set VITE_SUPABASE_PUBLISHABLE_KEY YOUR_PUBLIC_KEY
netlify env:get VITE_SUPABASE_URL --context production
```

Deploy through the existing Git integration after the migration, authentication settings, and environment variables are ready. Check the deployment logs and test login, recovery, private journaling, publishing, and comments against the live project.

## Features and data behavior

- Guests can read published community fragments; posting entries, comments, and bookmarks requires login.
- New entries are **private by default**. Publishing is explicit. The personal journal includes both the author's private and published pages; the community includes published entries only.
- Entries support optional titles, text, a journal date, mood, images, editing, and confirmed permanent deletion.
- Upload JPG/PNG/WebP/GIF images up to 2 MB to private cloud storage, or link an HTTPS image. Uploaded images use five-minute signed access URLs. Owner access permits cleaning up unused uploads.
- Comments are public on published entries only. Comment authors and entry owners can remove them. Making a note private hides its comments without erasing them; republishing restores their visibility.
- Search titles/body and combine mood, visibility, date-range, image, and account bookmark filters. Sort by journal date in either direction or by latest update. Lists and comments are paginated, and calendar counts include all matching pages in the selected month.
- Fragments, timeline, and calendar views share the same filters. Select a calendar day to read or write its pages. Journal dates use local calendar dates, not UTC date truncation.
- Sessions persist on trusted devices. Notes, comments, bookmarks, and uploaded images live in Supabase and work across devices; only session credentials remain in browser storage.
- Existing browser-only journal data is not erased. Download its backup before explicitly importing into the current account as private entries. Import IDs are deterministic per account so retries do not duplicate successfully imported entries. The original data remains intact. HTTP-only legacy image URLs must be upgraded to HTTPS before import.
- Readability uses 15–16 px body copy, high-contrast muted colors, large controls, visible keyboard focus, native modal dialogs, and reduced-motion support.

Private entries are protected by database row-level access rules, **not end-to-end encryption**. The Supabase project administrator can access database content. Signed image links may remain usable for five minutes after an entry becomes private. Already downloaded content cannot be recalled. External image hosts and Google Fonts receive their respective resource requests.

## Verification

`npm test` includes component tests for writing, login/session actions, recovery, comments, and calendar interaction; API request tests for scoping, filters, sorting, pagination, edits, deletes, and bookmarks; and execution of the actual SQL migration in PGlite (PostgreSQL) to verify policies for guests and two accounts. The latter uses minimal stand-ins for the Supabase-managed `auth` and `storage` schemas, so it does not replace hosted authentication/email/storage integration testing.
