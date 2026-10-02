import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { db, mode, orderSources, policies } from './db';
import type { Order, Source, Passage } from './types';

export function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
}

export function isGemini(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function isOpenRouter(): boolean {
  if (isGemini()) return false;
  const key = getApiKey();
  return !!(process.env.OPENROUTER_API_KEY || (key && key.startsWith('sk-or-v1-')));
}

export function getModel(): string {
  if (isGemini()) {
    return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }
  if (isOpenRouter()) {
    return process.env.OPENROUTER_MODEL || (process.env.OPENAI_MODEL?.includes('/') ? process.env.OPENAI_MODEL : 'openai/gpt-4o-mini');
  }
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export function client() {
  const key = getApiKey();
  if (!key) {
    throw new Error('Live mode needs GEMINI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY in environment.');
  }

  if (isGemini()) {
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      timeout: 60000,
      maxRetries: 2
    });
  }

  if (isOpenRouter()) {
    return new OpenAI({
      apiKey: key,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://parcelproof-three.vercel.app',
        'X-Title': 'ParcelProof'
      },
      timeout: 60000,
      maxRetries: 2
    });
  }

  return new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: 60000,
    maxRetries: 2
  });
}

export const embeddingModel = () => process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

// Overlap preserves quotations at boundaries; source metadata stays on every chunk.
export function chunkText(text: string, size = 700, overlap = 120): string[] {
  if (size <= overlap || overlap < 0) throw new Error('Invalid chunk size');
  const out: string[] = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    out.push(text.slice(start, start + size));
    if (start + size >= text.length) break;
  }
  return out;
}

export function indexSource(s: Source) {
  const chunks = chunkText(s.text);
  const ids: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const id = `${s.id}:${i}:${createHash('sha256').update(chunks[i]).digest('hex').slice(0, 10)}`;
    ids.push(id);
    db().prepare('INSERT OR IGNORE INTO chunks(id,sourceId,text) VALUES(?,?,?)').run(id, s.id, chunks[i]);
  }
  const old = db().prepare('SELECT id FROM chunks WHERE sourceId=?').all(s.id);
  for (const r of old) {
    if (!ids.includes((r as any).id as string)) {
      db().prepare('DELETE FROM chunks WHERE id=?').run((r as any).id);
    }
  }
}

export async function ingest(live = mode() === 'live') {
  const all = db()
    .prepare("SELECT data FROM sources WHERE type IN ('support','courier','policy')")
    .all()
    .map(r => JSON.parse((r as any).data as string) as Source);
  all.forEach(indexSource);
  let embedded = 0;

  if (live && !isOpenRouter()) {
    try {
      const pending = db().prepare('SELECT id,text FROM chunks WHERE vector IS NULL OR model != ?').all(embeddingModel()) as any[];
      for (let i = 0; i < pending.length; i += 64) {
        const batch = pending.slice(i, i + 64);
        const result = await client().embeddings.create({
          model: embeddingModel(),
          input: batch.map(r => r.text as string)
        });
        for (const item of result.data) {
          db().prepare('UPDATE chunks SET vector=?,model=? WHERE id=?').run(
            JSON.stringify(item.embedding),
            embeddingModel(),
            batch[item.index].id
          );
          embedded++;
        }
      }
    } catch (e) {
      console.warn('Embeddings ingestion skipped or unsupported by provider:', e);
    }
  }

  return {
    sources: all.length,
    chunks: (db().prepare('SELECT count(*) AS n FROM chunks').get() as { n: number }).n,
    embedded,
    mode: live ? 'live semantic/lexical RAG' : 'fixture lexical index'
  };
}

export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) throw new Error('Embedding dimensions differ; run npm run ingest.');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return dot / (Math.sqrt(aa * bb) || 1);
}

export async function retrieve(o: Order, query: string): Promise<Passage[]> {
  // Scope BEFORE ranking: no other household order can enter candidate selection.
  const allowed = [...orderSources(o), ...policies(o)];
  allowed.forEach(indexSource);

  let vector: number[] | null = null;
  if (mode() === 'live' && !isOpenRouter()) {
    try {
      const r = await client().embeddings.create({ model: embeddingModel(), input: query });
      vector = r.data[0]?.embedding || null;
    } catch {
      vector = null;
    }
  }

  const words = new Set((query.toLowerCase().match(/[a-z0-9-]+/g) || []).filter(w => w.length > 2));

  const ranked = allowed.flatMap(source =>
    (db().prepare('SELECT * FROM chunks WHERE sourceId=?').all(source.id) as any[]).map(row => {
      const passage = row.text as string;
      const tokens = new Set(passage.toLowerCase().match(/[a-z0-9-]+/g) || []);
      const lexical = [...words].filter(w => tokens.has(w)).length / Math.max(words.size, 1);

      if (vector && (!row.vector || row.model !== embeddingModel())) {
        throw new Error('Live index is missing or outdated. Run AI_MODE=live npm run ingest before analyzing.');
      }
      const semantic = vector && row.vector ? cosine(vector, JSON.parse(row.vector as string)) : 0;

      const exact = passage.includes(o.id) ? 0.25 : 0;
      const score = (vector ? 0.7 * semantic : 0) + lexical * 1.5 + exact;

      return {
        chunkId: row.id as string,
        source,
        passage,
        method: vector ? 'semantic + lexical + exact ID' : 'lexical + exact ID; grounded index',
        score
      };
    })
  );

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ score, ...p }) => p);
}
