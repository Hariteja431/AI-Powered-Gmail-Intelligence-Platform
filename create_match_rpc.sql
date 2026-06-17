-- This script creates the Postgres function needed for Vector Similarity Search (RAG).
-- Run this directly in the Supabase SQL Editor.

create or replace function match_email_chunks (
  query_embedding vector(1024),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  message_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    email_chunks.id,
    email_chunks.message_id,
    email_chunks.chunk_text,
    email_chunks.metadata,
    1 - (email_chunks.embedding <=> query_embedding) as similarity
  from email_chunks
  -- SECURITY: Strictly enforce multitenant isolation by user_id
  where email_chunks.user_id = p_user_id
  and 1 - (email_chunks.embedding <=> query_embedding) > match_threshold
  order by email_chunks.embedding <=> query_embedding
  limit match_count;
$$;
