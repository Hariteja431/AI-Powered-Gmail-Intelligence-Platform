-- Enable pgvector extension
create extension if not exists vector;

-- 1. users table
create table public.users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  google_access_token text,
  google_refresh_token text,
  token_expiry timestamp with time zone,
  history_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. threads table
create table public.threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  gmail_thread_id text unique not null,
  subject text,
  snippet text,
  category text,
  thread_summary text,
  last_message_at timestamp with time zone,
  message_count integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. messages table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  thread_id uuid references public.threads(id) on delete cascade not null,
  gmail_message_id text unique not null,
  from_email text,
  from_name text,
  to_emails text[],
  subject text,
  body_plain text,
  body_html text,
  snippet text,
  internal_date timestamp with time zone,
  in_reply_to text,
  references_header text[],
  label_ids text[],
  email_summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. email_chunks table (for RAG)
create table public.email_chunks (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  chunk_text text not null,
  embedding vector(1024), -- NVIDIA NIM embedqa-e5-v5 is 1024 dimensions
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. chat_sessions table
create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. chat_messages table
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb, -- To store attribution
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. sync_state table
create table public.sync_state (
  user_id uuid references public.users(id) on delete cascade primary key,
  last_history_id text,
  last_synced_at timestamp with time zone,
  status text default 'idle'
);

-- Indexes for performance
create index idx_threads_user_id on public.threads(user_id);
create index idx_messages_thread_id on public.messages(thread_id);
create index idx_messages_user_id on public.messages(user_id);
create index idx_messages_internal_date on public.messages(internal_date);
create index idx_threads_category on public.threads(category);

-- HNSW index for pgvector (cosine distance: vector_cosine_ops)
create index idx_email_chunks_embedding on public.email_chunks using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);
