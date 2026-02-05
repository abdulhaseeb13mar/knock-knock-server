import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RecipientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async importFromCsv(userId: string, fileBuffer: Buffer) {
    const records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const emails = records
      .map((row: Record<string, string>) => row.email ?? row.Email ?? row.EMAIL)
      .filter((email: string) => this.isValidEmail(email));

    if (emails.length === 0) {
      return { imported: 0 };
    }

    await this.prisma.recipient.createMany({
      data: emails.map((email: string) => ({
        userId,
        email,
      })),
      skipDuplicates: true,
    });

    await this.audit.log({
      userId,
      action: 'recipients.import',
      metadata: { count: emails.length },
    });

    return { imported: emails.length };
  }

  async listRecipients(userId: string) {
    return this.prisma.recipient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '');
  }
}
