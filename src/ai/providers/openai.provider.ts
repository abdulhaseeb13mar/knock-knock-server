import { AiRewriteProvider } from './ai-rewrite.provider';

export class OpenAiProvider implements AiRewriteProvider {
  async rewriteEmail(input: string, userConfig: { apiKey: string }) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Rewrite the email to be concise and professional.',
          },
          { role: 'user', content: input },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI request failed');
    }

    // TODO: Add proper type definitions for the response
    const json = await response.json();
    return json.choices?.[0]?.message?.content ?? input;
  }
}
