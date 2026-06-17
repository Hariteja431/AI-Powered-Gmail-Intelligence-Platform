const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export async function generateEmbeddings(texts: string[], inputType: 'passage' | 'query'): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];
  
  const response = await fetch(`${NIM_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      input: texts,
      model: 'nvidia/nv-embedqa-e5-v5',
      input_type: inputType,
      encoding_format: 'float',
      truncate: 'END'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA NIM Error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const embeddings = new Array(texts.length);
  for (const item of data.data) {
    embeddings[item.index] = item.embedding;
  }
  return embeddings;
}

export function chunkText(text: string, maxTokens: number = 512): string[] {
  // Rough approximation: 1 token ~ 4 characters
  const maxLength = maxTokens * 4;
  const chunks: string[] = [];
  
  if (!text) return chunks;

  let currentChunk = '';
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    if ((currentChunk.length + paragraph.length) > maxLength) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // If a single paragraph is still too long, split by sentences
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > maxLength) {
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
      let subChunk = '';
      for (const sentence of sentences) {
        if ((subChunk.length + sentence.length) > maxLength) {
          if (subChunk.trim().length > 0) finalChunks.push(subChunk.trim());
          subChunk = sentence;
        } else {
          subChunk += subChunk.length > 0 ? ' ' + sentence : sentence;
        }
      }
      if (subChunk.trim().length > 0) finalChunks.push(subChunk.trim());
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks;
}
