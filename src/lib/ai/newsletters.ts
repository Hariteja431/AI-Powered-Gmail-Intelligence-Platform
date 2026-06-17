import { createClient } from '@supabase/supabase-js';
import { generateContentWithFallback } from './gemini';
import { generateEmbeddings } from './embeddings';
import { withRetry } from '../utils/retry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function generateNewsletterDigest(userId: string) {
  // 1. Fetch recent newsletter threads
  const { data: threads } = await supabase
    .from('threads')
    .select('id, subject, category')
    .eq('user_id', userId)
    .eq('category', 'Newsletters')
    .order('last_message_at', { ascending: false })
    .limit(10); // Max 10 recent newsletters

  if (!threads || threads.length === 0) return 'No recent newsletters found.';

  const threadIds = threads.map(t => t.id);
  
  // 2. Fetch the latest message body for each thread
  const { data: messages } = await supabase
    .from('messages')
    .select('thread_id, subject, from_name, body_plain')
    .in('thread_id', threadIds)
    .order('internal_date', { ascending: false });
  
  if (!messages || messages.length === 0) return 'No newsletter content found.';

  const latestMessages = [];
  const seenThreads = new Set();
  for (const msg of messages) {
    if (!seenThreads.has(msg.thread_id)) {
      seenThreads.add(msg.thread_id);
      latestMessages.push(msg);
    }
  }

  // 3. Extract news items using Gemini
  const allExtractedItems: { headline: string; summary: string; source: string }[] = [];

  for (const msg of latestMessages) {
    const prompt = `
You are an expert news extractor. Read the following newsletter and extract ONLY the top 2-3 most substantive, unique news stories or major announcements.
Do NOT extract minor updates, sponsor messages, or generic intros.
Respond ONLY with a valid JSON array of objects. Each object MUST represent exactly ONE distinct news story.
Each object should have 'headline' (string), 'summary' (string), and 'original_source' (string - the actual publication, company, or news outlet the story is from, e.g., "Wall Street Journal", "Apple Press Release". If none is specified in the text, use "${msg.from_name}"). Limit to a MAXIMUM of 3 items.

Newsletter Source: ${msg.subject} from ${msg.from_name}
Content:
${msg.body_plain?.substring(0, 4000) || ''}
`;
    
    try {
      const response = await withRetry(() => generateContentWithFallback(
        [{ role: 'user', parts: [{ text: prompt }] }]
      ), 2, 2000);
      
      let text = response.response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const items = JSON.parse(text);
      
      for (const item of items) {
        if (item.headline && item.summary) {
          allExtractedItems.push({
            headline: item.headline,
            summary: item.summary,
            source: item.original_source || msg.from_name || msg.subject || 'Newsletter'
          });
        }
      }
    } catch (e) {
      console.error('Failed to extract items from newsletter', e);
    }
  }

  if (allExtractedItems.length === 0) return 'Failed to extract news items from newsletters.';

  // 4. Embed each news item
  const textsToEmbed = allExtractedItems.map(i => `${i.headline}\n${i.summary}`);
  
  // Chunking for NVIDIA API limits (50 max)
  let embeddings: number[][] = [];
  for (let i = 0; i < textsToEmbed.length; i += 50) {
    const batch = textsToEmbed.slice(i, i + 50);
    const batchEmbeddings = await generateEmbeddings(batch, 'passage');
    embeddings = embeddings.concat(batchEmbeddings);
  }

  // 5. Cluster by cosine similarity
  // Adjust threshold if needed, but the user suggested 0.85 as a starting point.
  // NVIDIA e5 sometimes has lower similarity bounds, but we will start with 0.85.
  const SIMILARITY_THRESHOLD = 0.80; 
  const clusters: { items: typeof allExtractedItems }[] = [];

  for (let i = 0; i < allExtractedItems.length; i++) {
    const item = allExtractedItems[i];
    const vecA = embeddings[i];
    let addedToCluster = false;

    for (const cluster of clusters) {
      // Compare with the first item in the cluster (representative)
      const representativeIndex = allExtractedItems.indexOf(cluster.items[0]);
      const vecB = embeddings[representativeIndex];
      const similarity = cosineSimilarity(vecA, vecB);

      if (similarity > SIMILARITY_THRESHOLD) {
        cluster.items.push(item);
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      clusters.push({ items: [item] });
    }
  }

  // 6. Synthesize one clean entry per cluster
  let finalMarkdown = `## 📰 Deduplicated Newsletter Digest\n\n`;

  for (const cluster of clusters) {
    const sources = Array.from(new Set(cluster.items.map(i => i.source)));
    
    if (cluster.items.length === 1) {
      finalMarkdown += `### ${cluster.items[0].headline}\n`;
      finalMarkdown += `${cluster.items[0].summary}\n`;
      finalMarkdown += `*Source: ${sources.join(', ')}*\n\n`;
    } else {
      // Multiple items in cluster, ask LLM to merge them
      const mergePrompt = `
You are a news editor. Combine these highly related news snippets from different newsletters into one single cohesive summary (3-4 sentences max).
Write a strong, unified headline.
Respond ONLY with a JSON object: {"headline": "...", "summary": "..."}

Snippets:
${JSON.stringify(cluster.items, null, 2)}
      `;

      try {
        const response = await withRetry(() => generateContentWithFallback(
          [{ role: 'user', parts: [{ text: mergePrompt }] }]
        ), 2, 2000);
        let text = response.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const merged = JSON.parse(text);
        
        finalMarkdown += `### ${merged.headline}\n`;
        finalMarkdown += `${merged.summary}\n`;
        finalMarkdown += `*Sources: ${sources.join(', ')}*\n\n`;
      } catch (e) {
        // Fallback
        finalMarkdown += `### ${cluster.items[0].headline}\n`;
        finalMarkdown += `${cluster.items[0].summary}\n`;
        finalMarkdown += `*Sources: ${sources.join(', ')}*\n\n`;
      }
    }
  }

  return finalMarkdown;
}
