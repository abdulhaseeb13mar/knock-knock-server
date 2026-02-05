import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProvider } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(params: { email: string; passwordHash: string }) {
    return this.prisma.user.create({
      data: {
        email: params.email,
        passwordHash: params.passwordHash,
        settings: {
          create: {
            dailyLimit: 50,
            delayMs: 1000,
            rewriteInterval: 1,
            defaultAiProvider: AiProvider.openai,
          },
        },
      },
      include: { settings: true },
    });
  }

  async saveResumePath(userId: string, path: string) {
    const record = await this.prisma.resumeFile.create({
      data: { userId, path },
    });
    await this.audit.log({
      userId,
      action: 'users.resume.uploaded',
      metadata: { path },
    });
    return record;
  }
}
