import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../integrations/gmail/gmail.service';
import { JobsEventsService } from './jobs-events.service';
import { AiService } from '../ai/ai.service';
import { JobStatus, RecipientStatus } from '@prisma/client';
import nodemailer from 'nodemailer';

@Processor('email-jobs')
export class JobsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
    private readonly jobsEvents: JobsEventsService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string; userId: string }>) {
    const { jobId, userId } = job.data;
    const [user, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userSettings.findUnique({ where: { userId } }),
    ]);

    if (!user || !settings) {
      return;
    }

    const tokens = await this.gmailService.refreshAccessToken(userId);

    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: user.email,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
      },
    });

    const recipients = await this.prisma.recipient.findMany({
      where: { jobId, status: RecipientStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const [index, recipient] of recipients.entries()) {
      const jobState = await this.prisma.emailJob.findUnique({
        where: { id: jobId },
      });
      if (jobState?.status === JobStatus.PAUSED) {
        this.jobsEvents.emit(jobId, { status: JobStatus.PAUSED });
        return;
      }

      const dailyCount = await this.countDailySends(userId);
      if (dailyCount >= settings.dailyLimit) {
        await this.prisma.emailJob.update({
          where: { id: jobId },
          data: { status: JobStatus.PAUSED },
        });
        this.jobsEvents.emit(jobId, {
          status: JobStatus.PAUSED,
          reason: 'daily-limit',
        });
        return;
      }

      try {
        const baseBody =
          'This is a placeholder email body. Replace with AI-generated content.';
        const shouldRewrite =
          settings.rewriteInterval > 0 &&
          (index + 1) % settings.rewriteInterval === 0;
        const body = shouldRewrite
          ? await this.safeRewrite(userId, baseBody)
          : baseBody;

        // Design choice: use nodemailer with Gmail OAuth2 to ensure emails land in Sent folder.
        await transport.sendMail({
          from: user.email,
          to: recipient.email,
          subject: 'Hello from Knock Knock',
          text: body,
        });

        sentCount += 1;
        await this.prisma.recipient.update({
          where: { id: recipient.id },
          data: { status: RecipientStatus.SENT, sentAt: new Date() },
        });

        await this.prisma.sentEmail.create({
          data: {
            userId,
            jobId,
            recipientEmail: recipient.email,
            subject: 'Hello from Knock Knock',
            body,
          },
        });

        await this.prisma.emailJob.update({
          where: { id: jobId },
          data: { sentCount: { increment: 1 } },
        });
      } catch (error) {
        failedCount += 1;
        await this.prisma.recipient.update({
          where: { id: recipient.id },
          data: {
            status: RecipientStatus.FAILED,
            error: (error as Error).message,
          },
        });

        await this.prisma.emailJob.update({
          where: { id: jobId },
          data: { failedCount: { increment: 1 } },
        });
      }

      this.jobsEvents.emit(jobId, { sentCount, failedCount });
      await this.sleep(settings.delayMs);
    }

    await this.prisma.emailJob.update({
      where: { id: jobId },
      data: { status: JobStatus.COMPLETED, completedAt: new Date() },
    });

    this.jobsEvents.emit(jobId, { status: JobStatus.COMPLETED });
    this.jobsEvents.complete(jobId);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async safeRewrite(userId: string, content: string) {
    try {
      return await this.aiService.rewriteEmail(userId, content);
    } catch {
      return content;
    }
  }

  private async countDailySends(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.sentEmail.count({
      where: {
        userId,
        sentAt: { gte: start },
      },
    });
  }
}
