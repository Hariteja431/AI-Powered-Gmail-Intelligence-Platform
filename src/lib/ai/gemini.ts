import { GoogleGenerativeAI } from '@google/generative-ai';

const getKeys = () => {
  if (process.env.GEMINI_API_KEYS) {
    return process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  }
  return [process.env.GEMINI_API_KEY!].filter(Boolean);
};

const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-8b',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-1.0-pro'
];

export async function generateContentWithFallback(contents: any, generationConfig?: any) {
  const keys = getKeys();
  if (keys.length === 0) throw new Error('No Gemini API keys configured');

  let lastError: any = null;

  for (const key of keys) {
    const genAI = new GoogleGenerativeAI(key);
    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const request: any = { contents };
        if (generationConfig) request.generationConfig = generationConfig;
        
        console.log(`[Gemini] Trying model ${modelName} with key ending in ...${key.slice(-4)}`);
        const response = await model.generateContent(request);
        return response;
      } catch (error: any) {
        console.warn(`[Gemini] Failed with model ${modelName} and key ...${key.slice(-4)}: ${error.message}`);
        lastError = error;
      }
    }
  }

  throw new Error(`All API keys and models failed. Last error: ${lastError?.message}`);
}
