import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, model, temperature } = await req.json();

    const apiKey = process.env.BAZAARLINK_API_KEY || 'sk-bl-OYtAzp3Xolq6nauQnsorSLhngnI7VqFy24mA-eQ4KyUzFsKp';
    const endpoint = process.env.BAZAARLINK_ENDPOINT || 'https://api.bazaarlink.ai/v1/chat/completions';
    const selectedModel = model || process.env.BAZAARLINK_MODEL || 'qwen/qwen3.7-flash:free';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        temperature: temperature ?? 0.7,
        messages,
      }),
    });

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

    return NextResponse.json({ content: rawContent, raw: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
