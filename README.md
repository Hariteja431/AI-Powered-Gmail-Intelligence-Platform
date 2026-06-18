# AI-Powered Gmail Intelligence Platform

An intelligent, AI-driven web application that connects to your Gmail account to summarize threads, categorize emails, automatically draft contextual replies, and provide an interactive AI chat agent powered by RAG (Retrieval-Augmented Generation) across your entire inbox.

Built as a submission for the **Repeatless AI Automation Executive Technical Assessment**.

## Features

- **Gmail OAuth 2.0 Integration**: Secure connection and asynchronous inbox syncing.
- **AI Categorization**: Automatically groups emails into Newsletters, Job/Recruitment, Finance, Notifications, etc.
- **Smart Summarization**: Gemini-powered summaries for long, complex email threads.
- **Context-Aware Drafting**: Generates professional email replies based on short user prompts, preserving standard SMTP `In-Reply-To` and `References` headers for robust threading.
- **Inbox AI Agent**: An intelligent conversational agent that uses dense vector embeddings and pgvector semantic search to exclusively answer questions based on your synced emails, complete with source attribution.
- **Newsletter Deduplication**: Semantically identifies and deduplicates repeating news stories across various newsletter subscriptions.

## Tech Stack

- **Frontend & Backend**: Next.js 14 (App Router), React, Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI Models**: Google Gemini API (Reasoning/Generation)
- **Authentication**: Supabase Auth (Google Provider)

---

## Local Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/Hariteja431/AI-Powered-Gmail-Intelligence-Platform.git
cd AI-Powered-Gmail-Intelligence-Platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory and populate it based on the provided `.env.example` file. **Do not commit your actual secrets.**

**Required Environment Variables:**
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Your Google Cloud Console OAuth credentials required to request Gmail API scopes.
- `GOOGLE_REDIRECT_URI`: The callback URI for OAuth (e.g., `http://localhost:3000/api/auth/callback/google`).
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase public anonymous key for client-side Auth.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase secret service role key for bypassing RLS on server routes.
- `TOKEN_ENCRYPTION_KEY`: A completely random 32-character string. This is used strictly by the server to symmetrically encrypt/decrypt the sensitive Google OAuth Refresh Tokens before storing them in the Supabase database.
- `GEMINI_API_KEYS`: A comma-separated list of Google Gemini API keys used for generation, chunking, and reasoning workflows.

### 4. Database Setup
You need to set up the Supabase PostgreSQL database schema. 
1. Go to your Supabase SQL Editor.
2. Run the `supabase_schema.sql` script to create the necessary tables and pgvector indexes.
3. Run the `create_match_rpc.sql` script to create the `match_email_chunks` Postgres function required for the RAG pipeline.

### 5. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Folder Structure & Architecture

The application is built using a monolithic serverless pattern.

- `/src/app`: Next.js App Router structure. 
  - Contains frontend pages like `page.tsx` and `layout.tsx`.
  - `/api`: Contains all backend serverless functions acting securely between the client and external services (e.g., `/api/auth`, `/api/chat`, `/api/sync`, `/api/compose`).
- `/src/components`: Reusable React Client Components representing the UI. Notable files include `Dashboard.tsx` (the main layout), `ThreadView.tsx` (reading interface), and `ChatAgent.tsx` (the RAG interface).
- `/src/lib`: Core utility functions, SDK wrappers, and complex backend logic separated from route handlers:
  - `/ai`: Specialized wrappers around the Google Gemini APIs responsible for summarization, auto-categorization, generation, and embedding.
  - `/gmail`: Handlers for OAuth flows, fetching raw messages from the Gmail API, parsing MIME types, and managing incremental sync status.
  - `/supabase`: Configured Supabase clients specifically tailored for both server-side execution and client-side access.
- `/supabase_schema.sql` & `/create_match_rpc.sql`: The raw SQL migration scripts required to spin up the correct Postgres schemas.
- `/Architecture.md`: A deep-dive design document explicitly breaking down the system architecture, database modeling choices, RAG pipeline construction, and API scaling strategies.
