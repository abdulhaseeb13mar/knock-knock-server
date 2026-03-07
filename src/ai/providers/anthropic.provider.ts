import { AiRewriteProvider } from './ai-rewrite.provider';

export class AnthropicProvider implements AiRewriteProvider {
  async rewriteEmail(input: string, userConfig: { apiKey: string }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': userConfig.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2024-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 400,
        messages: [{ role: 'user', content: input }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic request failed:', errorData);
      throw new Error(`Anthropic request failed: ${JSON.stringify(errorData)}`);
    }

    const json = await response.json();
    return json?.content?.[0]?.text ?? input;
  }
}
