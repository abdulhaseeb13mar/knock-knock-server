import { Injectable } from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AiRewriteProvider } from './providers/ai-rewrite.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GrokProvider } from './providers/grok.provider';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiService {
  private readonly providers: Record<AiProvider, AiRewriteProvider> = {
    openai: new OpenAiProvider(),
    anthropic: new AnthropicProvider(),
    grok: new GrokProvider(),
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async saveApiKey(userId: string, provider: AiProvider, apiKey: string) {
    const encryptedKey = this.encryption.encrypt(apiKey);
    await this.prisma.aiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: { encryptedKey },
      create: { userId, provider, encryptedKey },
    });
    await this.audit.log({
      userId,
      action: 'ai.key.saved',
      metadata: { provider },
    });
  }

  listProviders() {
    return Object.values(AiProvider);
  }

  async getUserKeys(userId: string) {
    const keys = await this.prisma.aiKey.findMany({
      where: { userId },
      select: { provider: true, createdAt: true },
    });
    return keys;
  }

  async updateApiKey(userId: string, provider: AiProvider, apiKey: string) {
    const encryptedKey = this.encryption.encrypt(apiKey);
    await this.prisma.aiKey.update({
      where: { userId_provider: { userId, provider } },
      data: { encryptedKey },
    });
    await this.audit.log({
      userId,
      action: 'ai.key.updated',
      metadata: { provider },
    });
    return { success: true };
  }

  async deleteApiKey(userId: string, provider: AiProvider) {
    await this.prisma.aiKey.delete({
      where: { userId_provider: { userId, provider } },
    });
    await this.audit.log({
      userId,
      action: 'ai.key.deleted',
      metadata: { provider },
    });
    return { success: true };
  }

  async rewriteEmail(userId: string, input: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    const provider = settings?.defaultAiProvider ?? AiProvider.openai;
    const apiKeyRecord = await this.prisma.aiKey.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    if (!apiKeyRecord) {
      throw new Error('Missing API key for provider');
    }

    const apiKey = this.encryption.decrypt(apiKeyRecord.encryptedKey);
    return this.providers[provider].rewriteEmail(input, { apiKey });
  }
}
