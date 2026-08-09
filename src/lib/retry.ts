import { HttpError } from './errors.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof HttpError && (error.status === 429 || error.status >= 500);
      if (!retryable || attempt === attempts - 1) throw error;
      await wait(250 * 2 ** attempt + Math.floor(Math.random() * 100));
    }
  }
  throw lastError;
}
