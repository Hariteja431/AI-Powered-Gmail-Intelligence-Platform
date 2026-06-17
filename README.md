# AI-Powered Gmail Intelligence Platform

An intelligent, AI-driven web application that connects to your Gmail account to summarize threads, categorize emails, automatically draft contextual replies, and provide an interactive AI chat agent powered by RAG (Retrieval-Augmented Generation) across your entire inbox.

Built as a submission for the **Repeatless AI Automation Executive Technical Assessment**.

## Features

- **Gmail OAuth 2.0 Integration**: Secure connection and asynchronous inbox syncing.
- **AI Categorization**: Automatically groups emails into Newsletters, Job/Recruitment, Finance, Notifications, etc.
- **Smart Summarization**: Gemini-powered summaries for long, complex email threads.
- **Context-Aware Drafting**: Generates professional email replies based on short user prompts, preserving standard SMTP `In-Reply-To` and `References` headers for robust threading.
- **Inbox AI Agent**: An intelligent conversational agent that uses dense vector embeddings (NVIDIA NIM) and pgvector semantic search to exclusively answer questions based on your synced emails, complete with source attribution.
- **Newsletter Deduplication**: Semantically identifies and deduplicates repeating news stories across various newsletter subscriptions.

## Tech Stack

- **Frontend & Backend**: Next.js (App Router), React, Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI Models**: Google Gemini API (Reasoning/Generation) & NVIDIA NIM API (Embeddings)
- **Authentication**: NextAuth.js (Google Provider)

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
Create a `.env.local` file in the root directory and populate it with the following keys. **Do not commit your secrets.**

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google OAuth Credentials (for Gmail API integration)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# AI API Keys
GEMINI_API_KEY=your_google_gemini_api_key
NVIDIA_API_KEY=your_nvidia_nim_api_key

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_nextauth_secret_string

# Encryption key for securing stored Google tokens
TOKEN_ENCRYPTION_KEY=a_32_character_random_string
```

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

## Folder Structure

- `/src/app`: Next.js App Router structure. Contains frontend pages (`page.tsx`) and API routes (`/api/auth`, `/api/chat`, `/api/sync`, etc.).
- `/src/components`: Reusable React components (`Dashboard.tsx`, `ThreadView.tsx`, `ChatAgent.tsx`).
- `/src/lib`: Core utility functions and integrations:
  - `/ai`: Wrappers for Gemini and NVIDIA NIM APIs (summarization, categorization, embeddings).
  - `/gmail`: OAuth handling, message parsing, thread sending, and the incremental sync worker logic.
  - `/supabase`: Supabase clients for server and client side.
- `/supabase_schema.sql` & `/create_match_rpc.sql`: Database migration scripts.
- `/Architecture.md`: A detailed breakdown of the system architecture, design decisions, and AI integration strategies.
