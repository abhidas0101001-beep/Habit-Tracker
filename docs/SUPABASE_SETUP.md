# Setting up sync (Supabase, free plan)

About 10 minutes, once. Until this is done the app works exactly as before,
storing everything on each device.

Supabase's dashboard changes now and then, so a menu name may differ slightly
from what's written here.

## 1. Create the project

1. Sign in at <https://supabase.com/dashboard> and click **New project**.
2. Name it `habit-tracker`, set a database password (save it in your password
   manager; the app never needs it), pick the region closest to you, and keep
   the **Free** plan.
3. Wait a minute or two for it to finish setting up.

## 2. Create the tables

1. Open **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) and click **Run**.
   You should see "Success. No rows returned".

This creates the `habits` and `entries` tables, locks each row to its owner
(Row Level Security), allows only **one** account to ever exist, and turns on
live updates between devices. Running it again is harmless.

## 3. Sign-in emails

1. **Authentication → Sign In / Providers**: make sure **Email** is enabled.
2. **Authentication → Emails → Templates**: edit **both** "Confirm signup" and
   "Magic Link" so the email contains the 6-digit code. Replace the body with:

   ```html
   <h2>Your Habit Tracker sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">sign in with this link</a> (open it in the same browser).</p>
   ```

   The code matters on phones: an installed app can't receive links opened from
   your email app, but you can always type the code.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://abhidas0101001-beep.github.io/Habit-Tracker/`
   - **Redirect URLs**: add `https://abhidas0101001-beep.github.io/Habit-Tracker/`
     and `http://localhost:5173/`

Supabase's built-in email service only sends a few emails per hour. That's
plenty for one person, but if a code doesn't arrive, wait a bit before asking again.

## 4. Copy the keys into GitHub

In Supabase, open **Project Settings → API Keys** (the project URL is under
**Project Settings → Data API**, or the **Connect** button). Then in GitHub
open the repository → **Settings → Secrets and variables → Actions → New
repository secret** and add:

| Secret name | Value | Used by |
|---|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` | app, keep-alive, backup |
| `SUPABASE_ANON_KEY` | **Publishable** key (`sb_publishable_…`), or the legacy **anon** key | app, keep-alive |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** key (`sb_secret_…`), or the legacy **service_role** key | nightly backup only |
| `BACKUP_PASSPHRASE` | A long passphrase you make up. **Save it in your password manager**: without it the backups can't be opened. | nightly backup |

The publishable key ends up in the app's JavaScript; that's how Supabase is
designed, and Row Level Security keeps the data private. The secret key and
passphrase never leave GitHub's secret storage.

## 5. Redeploy and sign in

1. GitHub → **Actions → Deploy to GitHub Pages → Run workflow**. When it
   finishes, the app has sync built in.
2. Open the app on the device that has your habits → **Settings → Sync** →
   enter your email → type the code. Your habits are uploaded.
3. Do the same on your other devices. They download everything.

If another device already has its *own* habits, they're merged in too, as
separate habits. Delete any duplicates you don't want.

## 6. Lock sign-ups

After you've signed in once: **Authentication → Sign In / Providers →** turn
off **Allow new users to sign up**. Signing in on more devices still works,
because that's the same account. (The database also refuses a second account,
so this is a second lock.)

## 7. Check the background jobs

In GitHub **Actions**, run each once by hand (**Run workflow**):

- **Keep Supabase awake**: runs every 2 days so the free project never pauses
  after 7 idle days. It should print a timestamp.
- **Nightly backup**: exports your data every night, encrypted with your
  passphrase, and keeps 90 days of backups under the run's **Artifacts**.

GitHub turns off scheduled jobs in a public repository after 60 days with no
commits, and emails you first. One click on **Enable workflow** turns them back
on. Even if the project does pause, nothing is lost: every device keeps its own
copy and syncs again once you click **Restore** in the Supabase dashboard.

## Restoring a backup

1. Download a backup artifact from a **Nightly backup** run and unzip it.
2. Decrypt it: `gpg --decrypt habit-tracker-backup.json.gpg > backup.json`
   (it asks for your passphrase).
3. In the app: **Settings → Import JSON** → choose `backup.json`. Newer
   records win, so importing never undoes newer edits.

## Local development with sync

Create `.env.local` (never committed) in the project folder:

```bash
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

then `npm run dev`.
