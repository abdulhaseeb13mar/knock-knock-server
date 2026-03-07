import { AiRewriteProvider } from './ai-rewrite.provider';

export class GrokProvider implements AiRewriteProvider {
  async rewriteEmail(input: string, userConfig: { apiKey: string }) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: input }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Grok request failed:', errorData);
      throw new Error(`Grok request failed: ${JSON.stringify(errorData)}`);
    }

    // TODO: Add proper type definitions for the response
    const json = await response.json();
    return json.choices?.[0]?.message?.content ?? input;
  }
}
