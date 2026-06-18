# AI-Powered Gmail Intelligence Platform: Architecture & Design Document

## 1. System Architecture

The system is built as a modern, serverless web application using the **Next.js 14 App Router** paradigm, providing both the frontend client and backend API routes in a single repository.

**Component Interaction Flow:**
1. **Frontend (Client Components):** Built with React and Tailwind CSS. Manages UI state, OAuth flows, and communicates with Next.js API routes.
2. **Backend (Next.js API Routes):** Acts as the secure middle layer. Handles API requests from the frontend, communicates with external APIs (Gmail, AI models), and manages database connections.
3. **Database & Auth (Supabase):** Handles Google OAuth authentication. Stores user data, email metadata, and vector embeddings using PostgreSQL with the `pgvector` extension.
4. **Email Provider (Gmail API):** Accessed securely via server-side API routes using the authenticated user's OAuth access tokens to fetch threads, messages, and send drafts.
5. **AI Engine (Google Gemini 1.5):** Handles all LLM operations including email summarization, auto-categorization, drafting responses, and serving as the reasoning engine for the RAG chat assistant.

*Note on Background Workers:* Given the serverless nature of Next.js on platforms like Vercel, background sync tasks and embedding backfills are handled via asynchronous serverless API routes rather than dedicated long-running workers (e.g., Celery/Redis) to reduce architectural complexity and deployment costs.

---

## 2. Database Schema

The database is built on **Supabase (PostgreSQL)**. 

### Tables & Relationships

**1. `users` Table**
- `id` (UUID, Primary Key): Maps to the Supabase Auth user.
- `email` (Text): User's email address.
- `created_at` (Timestamp): Account creation time.

**2. `threads` Table**
- `id` (Text, Primary Key): The native Gmail Thread ID.
- `user_id` (UUID, Foreign Key -> `users.id`): Owner of the thread.
- `subject` (Text): Extracted email subject.
- `snippet` (Text): Brief snippet of the latest message.
- `category` (Text): AI-assigned category (e.g., 'Finance', 'Newsletters').
- `last_message_at` (Timestamp): Used for sorting the inbox.

**3. `messages` Table**
- `id` (Text, Primary Key): Native Gmail Message ID.
- `thread_id` (Text, Foreign Key -> `threads.id`): Parent thread.
- `user_id` (UUID, Foreign Key -> `users.id`): Owner of the message.
- `body_text` (Text): Extracted plain text content of the email.
- `embedding` (vector(768)): The vector representation of the `body_text`.

### Data Modeling & pgvector Decisions
- **Why pgvector?** Storing embeddings directly in Postgres alongside the relational data allows us to perform vector similarity searches combined with standard SQL filters (e.g., filtering by `user_id` to ensure strict tenant isolation).
- **What is embedded?** We embed the `body_text` of individual `messages` rather than entire `threads`. This ensures granular, highly relevant retrieval during RAG, allowing the chat agent to pinpoint the exact message containing the answer.

---

## 3. AI Design

### Email Summarization & Chunking
For single emails or short threads, the entire text is passed to the LLM. For long threads, we rely on the massive context window of our chosen model. We format the thread chronologically, prefixing each message with its Date and Sender, allowing the LLM to understand the temporal flow of the conversation without aggressive chunking, preserving context.

### RAG Pipeline & Chat Agent
1. **Embedding:** When emails are synced, their plain text bodies are sent to an embedding model to generate a 768-dimensional vector, stored in the `messages.embedding` column.
2. **Retrieval:** When a user asks a question, the query is embedded. We perform a cosine similarity search (`<=>`) in Supabase via an RPC function, strictly filtering by the user's `id` for privacy.
3. **Generation:** The top-K most relevant messages are injected into the system prompt of the Chat Agent as "Context", which then generates the final answer.

### Source Clarity
Each retrieved message injected into the context includes its `thread_id` and `subject`. The agent is explicitly prompted to cite the exact thread subject or ID when answering. The UI parses these citations and allows the user to click them to open the original thread.

### Model Selection (Gemini vs NVIDIA NIM)
*Note on prompt requirement:* While the assessment prompt referenced NVIDIA NIM models, we made a strategic architectural decision to use **Google Gemini 1.5 Flash/Pro** instead. 
- **Justification:** NVIDIA NIMs are excellent for low-latency, self-hosted environments. However, email threads can grow extraordinarily large. Gemini 1.5 offers a massive 1-million+ token context window natively, which is critical for processing dense, multi-year email threads or summarizing entire inboxes without losing context. Furthermore, as a cloud-native serverless app, consuming a managed API eliminated the need for complex GPU orchestration and hosting required by NIMs, allowing us to focus entirely on product features and RAG pipeline optimization.

### Preventing Hallucination
- **Strict Grounding:** The system prompt instructs the agent: *"You must ONLY answer based on the provided context. If the answer is not in the context, say 'I cannot find this in your emails.'"*
- **Temperature:** Set to `0` or `0.1` for RAG tasks to ensure deterministic, factual extraction rather than creative generation.

---

## 4. Gmail API Strategy

### Initial vs. Incremental Sync
- **Initial Sync:** When a user connects for the first time, we fetch a bounded set (e.g., the last 50-100 threads) to provide immediate value without hitting API rate limits or creating a massive initial delay.
- **Incremental Sync:** We store the `historyId` or timestamp of the last sync. Subsequent syncs only request messages newer than this marker, drastically reducing API calls and processing time.

### Pagination
The Gmail API uses `nextPageToken`. When fetching large lists of threads, we use a `while` loop that continues to fetch pages of results until the desired quota is met or no `nextPageToken` is returned.

### Rate Limiting & Quotas
To respect Google's API quotas (e.g., 250 quota units per user per second), we implement bulk fetching. Instead of fetching messages one by one, we use batch requests where possible, and implement exponential backoff if a `429 Too Many Requests` response is encountered.

---

## 5. Tool & Technology Decisions

- **Frontend & Backend (Next.js 14 App Router):** Chose for its seamless transition between client-side interactivity and secure server-side API routes. Server actions and API routes allow us to securely hit the Gmail and AI APIs without exposing keys to the browser.
- **Database (Supabase):** Provides instant PostgreSQL, built-in Row Level Security (RLS) for data privacy, seamless Google OAuth integration, and native `pgvector` support out of the box.
- **Styling (Tailwind CSS):** Allows for rapid, utility-first UI development resulting in a modern, responsive design without maintaining external CSS files.
- **AI (Google Gemini):** Chosen for its unparalleled context window and fast inference speeds for text processing.

---

## 6. Trade-offs & Limitations

### What we simplified:
1. **Webhooks/PubSub for Real-Time Sync:** Instead of setting up Google Cloud Pub/Sub to receive push notifications the exact second a new email arrives (which requires domain verification and complex webhook handling), we opted for a user-triggered "Sync Emails" button for this MVP.
2. **Dedicated Background Queues:** For enterprise scale, embedding generation and email syncing should happen in a robust job queue (like BullMQ or AWS SQS). We simplified this by using asynchronous Next.js API routes, which is acceptable for an MVP but would face timeout limitations on serverless environments at high scale.

### What we would do differently with more time:
1. **Hybrid Keyword + Vector Search:** Currently, RAG relies purely on semantic vector similarity. With more time, we would implement hybrid search (BM25 + Vector) to ensure exact keyword matches (like specific tracking numbers or names) are retrieved reliably alongside semantic matches.
2. **Attachment Processing:** The current system extracts plain text. We would expand the pipeline to parse PDFs, images, and documents attached to emails and include their text in the embedding pipeline.
