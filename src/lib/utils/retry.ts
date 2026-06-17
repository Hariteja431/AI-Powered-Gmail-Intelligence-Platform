export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const status = error?.code || error?.status;
      if (status === 429 || (status >= 500 && status < 600)) {
        if (attempt >= maxRetries) throw error;
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`[Rate Limit] Retrying in ${delay.toFixed(0)}ms (Attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Unreachable');
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
