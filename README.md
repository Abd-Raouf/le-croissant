# le croissant

A Discord-style chat app with Supabase Auth, realtime messages, and WebRTC voice + screen sharing.

## Features

- Supabase email/password authentication
- Profiles with display name, real name, and avatar storage
- Realtime 1:1 chat with file attachments
- WebRTC voice calling and screen share with quality settings

## Local setup

1. Create a `.env.local` file with:

	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. Run the SQL in `schema.sql` inside your Supabase project.
3. Create two public Supabase Storage buckets:

	- `avatars`
	- `attachments`

4. Install dependencies and run the dev server:

```
npm install
npm run dev
```

## Deployment

- Vercel: add the same environment variables during deployment.
- Supabase: apply `schema.sql` and configure the storage buckets.
