import { AiRewriteProvider } from './ai-rewrite.provider';
import OpenAI from 'openai';

export class OpenAiProvider implements AiRewriteProvider {
  async rewriteEmail(input: string, userConfig: { apiKey: string }) {
    const client = new OpenAI({ apiKey: userConfig.apiKey });

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Rewrite the email to be concise and professional.',
          },
          { role: 'user', content: input },
        ],
      });

      return response.choices?.[0]?.message?.content ?? input;
    } catch (error) {
      console.error('OpenAI request failed:', error);
      throw error;
    }
  }
}
