const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length > 0) acc[key.trim()] = rest.join('=').trim();
  return acc;
}, {});

function cosineSimilarity(vecA, vecB) {
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

async function run() {
  const texts = [
    "Apple announces new iPhone 16 with AI features.",
    "The new iPhone 16 from Apple includes advanced artificial intelligence capabilities.",
    "A massive earthquake just struck the coast of Japan, causing a tsunami warning."
  ];

  const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NVIDIA_NIM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: texts,
      model: 'nvidia/nv-embedqa-e5-v5',
      input_type: 'passage',
      encoding_format: 'float',
      truncate: 'END'
    })
  });

  const data = await response.json();
  const embeddings = [
    data.data[0].embedding,
    data.data[1].embedding,
    data.data[2].embedding
  ];

  console.log("Sim 1 vs 2 (Identical news):", cosineSimilarity(embeddings[0], embeddings[1]));
  console.log("Sim 1 vs 3 (Unrelated news):", cosineSimilarity(embeddings[0], embeddings[2]));
}

run();
