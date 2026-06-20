import { useState } from 'react';
import { AI_API_URL, API_KEY } from '../config';

interface RAGResponse {
  answer: string;
  sources: string[];
  model: string;
  tokens: number | null;
  chunks_retrieved: number;
}

export function useRAG() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (question: string): Promise<RAGResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (API_KEY) headers['X-API-Key'] = API_KEY;
      const res = await fetch(`${AI_API_URL}/api/rag/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, top_k: 5 }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return (await res.json()) as RAGResponse;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { ask, loading, error };
}
