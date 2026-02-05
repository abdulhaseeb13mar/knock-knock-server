import { AiRewriteProvider } from './ai-rewrite.provider';

export class AnthropicProvider implements AiRewriteProvider {
  async rewriteEmail(input: string, userConfig: { apiKey: string }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': userConfig.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{ role: 'user', content: input }],
      }),
    });

    if (!response.ok) {
      throw new Error('Anthropic request failed');
    }

    // TODO: Add proper type definitions for the response
    const json = await response.json();
    return json?.content?.[0]?.text ?? input;
  }
}
