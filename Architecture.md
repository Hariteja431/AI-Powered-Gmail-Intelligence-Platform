# Architecture & Design Document

## 1. System Architecture

The AI-powered Gmail Intelligence Platform is built as a monolithic web application utilizing the **Next.js App Router** framework.

- **Frontend**: Next.js Server Components and Client Components, styled with Tailwind CSS. We use sandboxed `iframes` to render the raw HTML of emails safely without XSS vulnerabilities while preserving pixel-perfect Gmail rendering.
- **Backend (API Routes)**: Next.js API Routes handle all asynchronous tasks, such as authentication callbacks, Gmail API sync loops, and LLM orchestration.
- **Database**: Supabase (PostgreSQL) is the primary data store. We use `pgvector` for semantic search (RAG).
- **External APIs**:
  - **Google Gmail API**: Used for fetching emails, threads, and sending drafts via OAuth 2.0.
  - **Google Gemini API**: Used for generating email summaries, categorizing incoming emails, parsing newsletters, and answering complex agentic queries.
  - **NVIDIA NIM API (nv-embedqa-e5-v5)**: Used exclusively for generating dense vector embeddings of email chunks and queries for high-performance retrieval.

## 2. Database Schema

The database relies heavily on relational integrity and vector similarity capabilities provided by `pgvector`.

- **`users` table**: Stores OAuth access tokens and refresh tokens. `history_id` keeps track of the incremental sync watermark.
- **`threads` table**: Maps to Gmail threads (`gmail_thread_id`). Stores aggregate metadata, categorical classification, and thread-level summaries.
- **`messages` table**: Maps to individual emails (`gmail_message_id`). Belongs to a thread. Stores parsed HTML/Plaintext, senders, and actual SMTP headers (`In-Reply-To`, `References`) for robust thread continuity.
- **`email_chunks` table**: Used for RAG. It stores chunked representations of emails with a 1024-dimensional `vector` field holding embeddings. We use an HNSW index (`vector_cosine_ops`) for rapid approximate nearest neighbor (ANN) retrieval.
- **`chat_sessions` & `chat_messages`**: Stores conversation history for the AI Chat Agent to maintain session context.
- **`sync_state` table**: Manages the lock mechanism and status of background Gmail syncing.

## 3. AI Design

- **Email Summarization**: When rendering a thread, the application feeds the plain text of the entire thread into Google Gemini with a system prompt instructing it to synthesize the conversation arc. We use Gemini due to its massive context window, avoiding complex chunking for standard email threads.
- **RAG Pipeline (Chat Agent)**:
  - **Embedding**: When emails are synced, they are split into overlapping chunks and passed to the NVIDIA NIM embedder (`nv-embedqa-e5-v5`).
  - **Retrieval**: The user's query is embedded, and a custom Supabase Postgres RPC (`match_email_chunks`) executes a cosine similarity search, returning the top 50 chunks.
  - **Synthesis**: The top chunks are packed into a context prompt. Gemini is instructed to exclusively use the provided context and cite its sources.
- **Hallucination Prevention**: The system prompt explicitly forbids hallucination and forces a fallback ("I don't have enough information from the synced emails") if the context does not contain the answer.
- **Source Clarity**: The returned chunks include rich metadata (subject, date, sender) which is relayed back to the frontend so users can see exactly which emails informed the agent's answer.

## 4. Gmail API Strategy

- **Initial Sync**: When the user first connects, we pull the last 300 active threads using `messages.list`. We then parse and upsert them in batches. We also capture the user's `historyId`.
- **Incremental Sync**: Subsequent syncs query `history.list` starting from the `historyId`. This prevents us from endlessly paginating over thousands of unchanged emails, minimizing latency and API calls.
- **Rate Limiting**: We implemented a `withRetry` utility wrapper around all Google API calls. It detects `429 Too Many Requests` and `5xx` server errors, dynamically applying an exponential backoff algorithm with jitter to stay within quota limits gracefully.
- **Thread Handling**: When drafting a reply, we fetch the actual `Message-ID` of the latest email in the thread and correctly construct the `In-Reply-To` and `References` RFC 2822 headers so that Gmail perfectly nests the outgoing message in the recipient's inbox.

## 5. Tool & Technology Decisions

- **Next.js**: Allowed us to quickly spin up a full-stack application within a single repository, making frontend-backend communication seamless.
- **Supabase + pgvector**: A managed Postgres instance with vector capabilities means we don't have to run a separate vector database (like Pinecone). Relational metadata and embeddings live side-by-side.
- **NVIDIA NIM (Embeddings)**: High-quality E5-v5 embedding models provide incredible semantic density, drastically improving the accuracy of newsletter deduplication and RAG queries compared to standard lightweight models.
- **Google Gemini**: The primary reasoning engine, chosen for its speed, enormous context window (critical for long email chains), and robust instruction-following capabilities.

## 6. Trade-offs & Limitations

- **Sync Architecture**: The current sync runs asynchronously via an API route trigger. In a robust production environment, this should be offloaded to a dedicated message queue worker (like Inngest or BullMQ) to prevent serverless execution timeouts (e.g., Vercel's 10-60s limit).
- **Attachment Handling**: To keep the system performant and scope manageable within the timeframe, attachments (PDFs, images) are currently ignored. Future iterations should download, OCR/parse, and embed attachment text into the RAG pipeline.
- **Pagination during Initial Sync**: To avoid serverless timeouts, the initial sync is bounded to the 300 most recent active messages. A persistent background worker would be required to safely backfill an entire historical inbox spanning tens of thousands of emails.
