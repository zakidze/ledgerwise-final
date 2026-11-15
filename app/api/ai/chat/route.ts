import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, model, temperature, purpose } = await req.json();

    const endpoint = process.env.BAZAARLINK_ENDPOINT || 'https://api.bazaarlink.ai/v1/chat/completions';
    const selectedModel = model || process.env.BAZAARLINK_MODEL || 'qwen/qwen3.7-flash:free';

    // 1. Primary Key: Dedicated for Lead Discovery & Analysis
    const primaryKey =
      process.env.BAZAARLINK_PRIMARY_KEY ||
      process.env.BAZAARLINK_LEAD_ANALYSIS_KEY ||
      process.env.BAZAARLINK_API_KEY ||
      'sk-bl-OYtAzp3Xolq6nauQnsorSLhngnI7VqFy24mA-eQ4KyUzFsKp';

    // 2. Secondary Key: Dedicated for Chatbot & Cold Email Crafting
    const secondaryKey =
      process.env.BAZAARLINK_SECONDARY_KEY ||
      process.env.BAZAARLINK_CHAT_EMAIL_KEY ||
      process.env.BAZAARLINK_API_KEY ||
      primaryKey;

    // Determine key order based on purpose
    let preferredKey: string;
    let fallbackKey: string;
    let preferredKeyLabel: string;
    let fallbackKeyLabel: string;

    if (purpose === 'lead_analysis') {
      preferredKey = primaryKey;
      fallbackKey = secondaryKey;
      preferredKeyLabel = 'Primary Key (Lead Analysis)';
      fallbackKeyLabel = 'Secondary Key (Backup Fallback)';
    } else if (purpose === 'chat_email') {
      preferredKey = secondaryKey;
      fallbackKey = primaryKey;
      preferredKeyLabel = 'Secondary Key (Chatbot & Email Craft)';
      fallbackKeyLabel = 'Primary Key (Backup Fallback)';
    } else {
      preferredKey = primaryKey;
      fallbackKey = secondaryKey;
      preferredKeyLabel = 'Primary Key';
      fallbackKeyLabel = 'Secondary Key';
    }

    const payload = JSON.stringify({
      model: selectedModel,
      temperature: temperature ?? 0.7,
      messages,
    });

    // Helper to make completion request
    const makeRequest = async (key: string) => {
      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      });
    };

    // Attempt 1: Preferred key
    let response = await makeRequest(preferredKey);
    let keyUsed = preferredKeyLabel;

    // If preferred key fails and a different fallback key is available, attempt fallback
    if (!response.ok && fallbackKey && fallbackKey !== preferredKey) {
      console.warn(`[AI Engine] ${preferredKeyLabel} failed with status ${response.status}. Automatically failing over to ${fallbackKeyLabel}...`);
      const fallbackResponse = await makeRequest(fallbackKey);
      if (fallbackResponse.ok) {
        response = fallbackResponse;
        keyUsed = fallbackKeyLabel;
      }
    }

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errText = await response.text().catch(() => '');
      }
      return NextResponse.json(
        { error: `BazaarLink HTTP ${response.status}${errText ? ': ' + errText : ''}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({
      content: rawContent,
      keyUsed,
      raw: data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
