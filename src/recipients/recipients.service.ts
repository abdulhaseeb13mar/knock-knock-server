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

    // Ensure company + company email records exist, then attach per-user recipient rows
    const uniqueEmails = Array.from(new Set(emails));

    const companyEmails = await this.prisma.$transaction(async (tx) => {
      const bySlug = new Map<string, string>();
      const results = [] as Array<{ id: string; email: string }>;

      for (const email of uniqueEmails) {
        const companySlug = this.getCompanySlugFromEmail(email);
        let companyId: string | undefined;

        if (companySlug) {
          companyId = bySlug.get(companySlug);

          if (!companyId) {
            const company = await tx.company.upsert({
              where: { slug: companySlug },
              update: {},
              create: {
                slug: companySlug,
                name: this.slugToCompanyName(companySlug),
              },
            });

            companyId = company.id;
            bySlug.set(companySlug, companyId);
          }
        }

        const companyEmail = await tx.companyEmail.upsert({
          where: { email },
          update: {},
          create: {
            email,
            companyId: companyId ?? null,
          },
          select: {
            id: true,
            email: true,
          },
        });

        results.push(companyEmail);
      }

      return results;
    });

    await this.prisma.recipient.createMany({
      data: companyEmails.map((c) => ({
        userId,
        companyEmailId: c.id,
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
    const recipients = await this.prisma.recipient.findMany({
      where: { userId },
      include: {
        companyEmail: {
          include: {
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return recipients.map((recipient) => {
      const company = recipient.companyEmail.company;

      return {
        ...recipient,
        companyEmail: {
          ...recipient.companyEmail,
          companyName: company?.name ?? null,
          description: company?.description ?? null,
          logo: company?.logo ?? null,
          tags: company?.tags ?? [],
        },
      };
    });
  }

  private isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '');
  }

  private getCompanySlugFromEmail(email: string) {
    const domainPart = email.split('@')[1];
    if (!domainPart) {
      return null;
    }

    const rootDomain = domainPart.split('.')[0]?.toLowerCase();
    if (!rootDomain) {
      return null;
    }

    const genericDomains = new Set([
      'gmail',
      'yahoo',
      'outlook',
      'hotmail',
      'live',
      'aol',
      'icloud',
      'protonmail',
      'yandex',
      'zoho',
      'gmx',
      'qq',
      '126',
      '163',
      'sina',
      'msn',
      'verizon',
      'att',
      'comcast',
      'btinternet',
      'rocketmail',
      'rediffmail',
      'mail.ru',
    ]);
    return genericDomains.has(rootDomain) ? null : rootDomain;
  }

  private slugToCompanyName(slug: string) {
    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }
}
