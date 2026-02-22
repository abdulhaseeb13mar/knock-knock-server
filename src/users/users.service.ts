import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async saveDriveResume(userId: string, sharedUrl: string) {
    const fileId = this.extractGoogleDriveFileId(sharedUrl);
    const record = await this.prisma.resumeFile.create({
      data: {
        userId,
        sharedUrl,
        fileId,
      },
    });
    await this.audit.log({
      userId,
      action: 'users.resume.linked',
      metadata: { resumeId: record.id, fileId, sharedUrl },
    });
    return record;
  }

  async listResumes(userId: string) {
    return this.prisma.resumeFile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteResume(userId: string, id: string) {
    const existing = await this.prisma.resumeFile.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Resume not found');
    }

    await this.prisma.resumeFile.delete({
      where: { id },
    });

    await this.audit.log({
      userId,
      action: 'users.resume.deleted',
      metadata: { resumeId: id, fileId: existing.fileId },
    });

    return { success: true };
  }

  private extractGoogleDriveFileId(sharedUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(sharedUrl);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (
      parsed.hostname !== 'drive.google.com' &&
      parsed.hostname !== 'docs.google.com'
    ) {
      throw new BadRequestException('Google Drive URL is required');
    }

    const idFromQuery = parsed.searchParams.get('id');
    if (idFromQuery) {
      return idFromQuery;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    const fileIndex = parts.indexOf('file');
    if (
      fileIndex >= 0 &&
      parts[fileIndex + 1] === 'd' &&
      parts[fileIndex + 2]
    ) {
      return parts[fileIndex + 2];
    }

    throw new BadRequestException('Could not extract Drive file id from URL');
  }
}
