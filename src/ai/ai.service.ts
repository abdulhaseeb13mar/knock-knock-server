import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.aiKey.findUnique({
        where: { userId_provider: { userId, provider } },
      });

      if (existing) {
        await tx.aiKey.update({
          where: { userId_provider: { userId, provider } },
          data: { encryptedKey },
        });
        return;
      }

      const maxPriorityResult = await tx.aiKey.aggregate({
        where: { userId },
        _max: { priority: true },
      });

      const nextPriority = (maxPriorityResult._max.priority ?? 0) + 1;

      await tx.aiKey.create({
        data: { userId, provider, encryptedKey, priority: nextPriority },
      });
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
      select: { provider: true, priority: true, createdAt: true },
      orderBy: { priority: 'asc' },
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
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.aiKey.findUnique({
        where: { userId_provider: { userId, provider } },
      });

      if (!existing) {
        throw new NotFoundException('AI key not found for provider');
      }

      await tx.aiKey.delete({
        where: { userId_provider: { userId, provider } },
      });

      const remainingKeys = await tx.aiKey.findMany({
        where: { userId },
        orderBy: { priority: 'asc' },
        select: { id: true },
      });

      await Promise.all(
        remainingKeys.map((key, index) =>
          tx.aiKey.update({
            where: { id: key.id },
            data: { priority: index + 1 },
          }),
        ),
      );
    });

    await this.audit.log({
      userId,
      action: 'ai.key.deleted',
      metadata: { provider },
    });
    return { success: true };
  }

  async updateApiKeyPriority(
    userId: string,
    prioritiesByProvider: Record<AiProvider, number>,
  ): Promise<{ success: true }> {
    await this.prisma.$transaction(async (tx) => {
      const keys = await tx.aiKey.findMany({
        where: { userId },
        orderBy: { priority: 'asc' },
      });

      if (keys.length === 0) {
        throw new NotFoundException('No AI keys found for user');
      }

      if (
        !prioritiesByProvider ||
        typeof prioritiesByProvider !== 'object' ||
        Array.isArray(prioritiesByProvider)
      ) {
        throw new BadRequestException(
          'Request body must be an object of { provider: priority }',
        );
      }

      const existingProviders = keys.map((key) => key.provider);
      const providedProviders = Object.keys(
        prioritiesByProvider,
      ) as AiProvider[];

      const missingProviders = existingProviders.filter(
        (provider) => !(provider in prioritiesByProvider),
      );
      if (missingProviders.length > 0) {
        throw new BadRequestException(
          `Missing priorities for providers: ${missingProviders.join(', ')}`,
        );
      }

      const extraProviders = providedProviders.filter(
        (provider) => !existingProviders.includes(provider),
      );
      if (extraProviders.length > 0) {
        throw new BadRequestException(
          `Unknown providers in payload: ${extraProviders.join(', ')}`,
        );
      }

      const priorities = existingProviders.map(
        (provider) => prioritiesByProvider[provider],
      );
      const hasInvalidPriority = priorities.some(
        (priority) => !Number.isInteger(priority) || priority < 1,
      );
      if (hasInvalidPriority) {
        throw new BadRequestException(
          'All priorities must be positive integers',
        );
      }

      const sortedPriorities = [...priorities].sort((a, b) => a - b);
      const isContinuous = sortedPriorities.every(
        (priority, index) => priority === index + 1,
      );
      if (!isContinuous) {
        throw new BadRequestException(
          `Priorities must be unique and cover 1 through ${keys.length}`,
        );
      }

      await Promise.all(
        keys.map((key) =>
          tx.aiKey.update({
            where: { id: key.id },
            data: { priority: prioritiesByProvider[key.provider] },
          }),
        ),
      );
    });

    await this.audit.log({
      userId,
      action: 'ai.key.priority.updated',
      metadata: {
        prioritiesByProvider,
      },
    });

    return { success: true };
  }

  async rewriteEmail(userId: string, input: string) {
    const apiKeyRecord = await this.prisma.aiKey.findFirst({
      where: { userId },
      orderBy: { priority: 'asc' },
    });

    if (!apiKeyRecord) {
      throw new Error('No API keys configured for user');
    }

    const provider = apiKeyRecord.provider;
    const apiKey = this.encryption.decrypt(apiKeyRecord.encryptedKey);
    return this.providers[provider].rewriteEmail(input, { apiKey });
  }
}
