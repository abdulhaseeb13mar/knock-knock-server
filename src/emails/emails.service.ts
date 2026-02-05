import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSentEmails(userId: string) {
    return this.prisma.sentEmail.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    });
  }
}
