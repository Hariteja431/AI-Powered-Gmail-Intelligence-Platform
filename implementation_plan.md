# Phase 7: Newsletter Deduplication

This phase focuses on aggregating and deduplicating news stories from various newsletters. Instead of reading 5 different newsletters covering the same tech news, the LLM will cluster overlapping stories and synthesize a single, clean "Newsletter Digest".

## User Review Required

> [!IMPORTANT]  
> Are you okay with replacing the current "Daily Digest" with a dual-tab or dual-button approach?
> - **Inbox Digest**: Summarizes action items, personal emails, and work updates.
> - **Newsletter Digest**: Focuses *only* on deduplicating news stories across your `Newsletters` category.

## Proposed Changes

### 1. Update AI Summarization Logic

#### [MODIFY] `src/lib/ai/summarize.ts`
- Modify `generateDailyDigest` to accept a `type: 'inbox' | 'newsletters'` argument.
- When `type === 'newsletters'`:
  - Fetch threads categorized as `Newsletters`.
  - Fetch the `body_plain` of the *latest message* in each of these threads. (The current digest only uses subject/snippet, which isn't enough to deduplicate actual news stories).
  - Use a specialized Gemini prompt to extract distinct news stories, merge duplicates across different newsletters, and output a clean Markdown digest.
- When `type === 'inbox'`:
  - Retain the current behavior (summarizing subjects/snippets of non-newsletter emails).

### 2. Update the API Endpoint

#### [MODIFY] `src/app/api/digest/route.ts`
- Accept a JSON body `{ type: 'inbox' | 'newsletters' }`.
- Pass the type to the `generateDailyDigest` function.

### 3. Enhance the Dashboard UI

#### [MODIFY] `src/components/Dashboard.tsx`
- Replace the single "Generate Digest" button with two buttons:
  - **Generate Inbox Digest** (Action items & personal)
  - **Generate Newsletter Digest** (Deduplicated news)
- Display a loading state specific to which digest is being generated.
- Render the resulting Markdown digest beautifully in the UI.

## Verification Plan
### Automated Tests
- None required for this phase.

### Manual Verification
1. I will deploy the changes to your local environment.
2. You will click "Generate Newsletter Digest" in the Dashboard.
3. You will verify that the LLM successfully reads the bodies of your newsletters, groups overlapping stories, and presents a cohesive summary without repeating the same news twice.
