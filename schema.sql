create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  real_name text not null,
  avatar_url text,
  status text default 'online',
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists status_message text;

create unique index if not exists profiles_display_name_unique
  on public.profiles (lower(display_name));

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  constraint friends_no_self check (user_id <> friend_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz default now(),
  constraint friend_requests_no_self check (sender_id <> recipient_id),
  constraint friend_requests_status check (status in ('pending', 'accepted', 'declined'))
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  file_url text,
  created_at timestamptz default now()
);

create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);

create unique index if not exists friends_unique_pair on public.friends (
  least(user_id, friend_id),
  greatest(user_id, friend_id)
);

create index if not exists friends_user_idx on public.friends (user_id);
create index if not exists friends_friend_idx on public.friends (friend_id);

create unique index if not exists friend_requests_unique_pair on public.friend_requests (
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id)
);

create index if not exists friend_requests_sender_idx on public.friend_requests (sender_id);
create index if not exists friend_requests_recipient_idx on public.friend_requests (recipient_id);

alter table public.profiles enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;

create policy "Profiles are viewable by authenticated users" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Friends are viewable by participants" on public.friends
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can add friends" on public.friends
  for insert with check (auth.uid() = user_id);

create policy "Users can remove friends" on public.friends
  for delete using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Friend requests are viewable by participants" on public.friend_requests
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send friend requests" on public.friend_requests
  for insert with check (auth.uid() = sender_id);

create policy "Recipients can update friend requests" on public.friend_requests
  for update using (auth.uid() = recipient_id);

create policy "Participants can delete friend requests" on public.friend_requests
  for delete using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Messages are viewable by sender or recipient" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);
