export function stripThinking(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function extractJsonString(rawText: string): string {
  const clean = stripThinking(rawText.trim());
  const s = clean.indexOf('{');
  const e = clean.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) return clean.substring(s, e + 1);
  return clean;
}

export function extractEmailJson(rawText: string): { subject: string; body: string } {
  const clean = stripThinking(rawText.trim());
  try {
    const parsed = JSON.parse(clean);
    if (parsed.subject && parsed.body) return parsed;
  } catch {}

  const s = clean.indexOf('{');
  const e = clean.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    try {
      const parsed = JSON.parse(clean.substring(s, e + 1));
      if (parsed.subject && parsed.body) return parsed;
    } catch {}
  }
  return { subject: 'Quick question on your monthly close', body: clean };
}

export function extractJsonArray(rawText: string): unknown[] {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('No response text received from model.');
  }
  const clean = stripThinking(rawText);

  function findArray(parsed: unknown): unknown[] | null {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      for (const key of ['companies', 'leads', 'results', 'data', 'items', 'brands', 'prospects']) {
        if (Array.isArray(obj[key])) return obj[key];
      }
      if (obj.company_name || obj.brand || obj.name) {
        return [obj];
      }
      for (const val of Object.values(obj)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          return val;
        }
      }
    }
    return null;
  }

  // 1. Direct parse
  try {
    const parsed = JSON.parse(clean);
    const arr = findArray(parsed);
    if (arr) return arr;
  } catch {}

  // 2. Markdown code fences
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = fenceRegex.exec(clean)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const arr = findArray(parsed);
      if (arr) return arr;
    } catch {
      try {
        const repaired = match[1].trim().replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(repaired);
        const arr = findArray(parsed);
        if (arr) return arr;
      } catch {}
    }
  }

  // 3. Between outer [ ... ]
  const s = clean.indexOf('[');
  const e = clean.lastIndexOf(']');
  if (s !== -1 && e !== -1 && e > s) {
    const sub = clean.substring(s, e + 1);
    try {
      const parsed = JSON.parse(sub);
      const arr = findArray(parsed);
      if (arr) return arr;
    } catch {
      try {
        const repaired = sub.replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(repaired);
        const arr = findArray(parsed);
        if (arr) return arr;
      } catch {}
    }
  }

  // 4. Between outer { ... }
  const sObj = clean.indexOf('{');
  const eObj = clean.lastIndexOf('}');
  if (sObj !== -1 && eObj !== -1 && eObj > sObj) {
    const sub = clean.substring(sObj, eObj + 1);
    try {
      const parsed = JSON.parse(sub);
      const arr = findArray(parsed);
      if (arr) return arr;
    } catch {
      try {
        const repaired = sub.replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(repaired);
        const arr = findArray(parsed);
        if (arr) return arr;
      } catch {}
    }
  }

  throw new Error('Unable to parse structured JSON array from model output.');
}

export async function callAiCompletion(
  messages: Array<{ role: string; content: string }>,
  model = 'qwen/qwen3.7-flash:free',
  temperature = 0.7,
  purpose: 'lead_analysis' | 'chat_email' = 'lead_analysis'
): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, temperature, purpose }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content || '';
}
