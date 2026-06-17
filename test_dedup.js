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
  const allExtractedItems = [
    { headline: "OpenAI releases GPT-4.5", summary: "OpenAI has announced the release of GPT-4.5 with better reasoning.", source: "TechCrunch Newsletter" },
    { headline: "New OpenAI Model: GPT-4.5", summary: "The AI startup OpenAI launched GPT-4.5 today, improving logic and reasoning.", source: "AI Weekly" },
    { headline: "Apple iPhone 16 Launch", summary: "Apple's new iPhone 16 features an AI button.", source: "TechCrunch Newsletter" },
    { headline: "Apple's iPhone 16 brings AI features", summary: "The new iPhone 16 includes Apple Intelligence built-in.", source: "The Verge Daily" }
  ];

  const textsToEmbed = allExtractedItems.map(i => `${i.headline}\n${i.summary}`);

  const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NVIDIA_NIM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: textsToEmbed,
      model: 'nvidia/nv-embedqa-e5-v5',
      input_type: 'passage',
      encoding_format: 'float',
      truncate: 'END'
    })
  });

  const data = await response.json();
  const embeddings = new Array(textsToEmbed.length);
  for (const item of data.data) {
    embeddings[item.index] = item.embedding;
  }

  const SIMILARITY_THRESHOLD = 0.80; 
  const clusters = [];

  for (let i = 0; i < allExtractedItems.length; i++) {
    const item = allExtractedItems[i];
    const vecA = embeddings[i];
    let addedToCluster = false;

    for (const cluster of clusters) {
      const representativeIndex = allExtractedItems.indexOf(cluster.items[0]);
      const vecB = embeddings[representativeIndex];
      const similarity = cosineSimilarity(vecA, vecB);
      
      console.log(`Sim between "${item.headline}" and "${cluster.items[0].headline}" = ${similarity.toFixed(3)}`);

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

  console.log("\n--- CLUSTERS ---");
  for (const cluster of clusters) {
    const sources = Array.from(new Set(cluster.items.map(i => i.source)));
    console.log(`Cluster with ${cluster.items.length} items. Sources: ${sources.join(', ')}`);
    for (const item of cluster.items) {
      console.log(` - ${item.headline}`);
    }
  }
}

run();
