import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../integrations/gmail/gmail.service';
import { JobsEventsService } from './jobs-events.service';
import { AiService } from '../ai/ai.service';
import { JobStatus, RecipientStatus } from '@prisma/client';
import nodemailer from 'nodemailer';
import { basename } from 'path';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type ResumeAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

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

  async process(job: Job<{ jobId: string; userId: string; resumeId: string }>) {
    const { jobId, userId, resumeId } = job.data;
    const [user, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userSettings.findUnique({ where: { userId } }),
    ]);

    if (!user || !settings) {
      return;
    }

    const resume = await this.prisma.resumeFile.findFirst({
      where: { id: resumeId, userId },
    });

    if (!resume) {
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
      include: { companyEmail: true },
    });

    let sentCount = 0;
    let failedCount = 0;
    const attachment = await this.getDriveAttachment(resume.fileId);
    const shouldUseLinkOnly = !attachment;

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
        const bodyWithResume = shouldUseLinkOnly
          ? `${body}\n\nResume: ${resume.sharedUrl}`
          : body;

        // Design choice: use nodemailer with Gmail OAuth2 to ensure emails land in Sent folder.
        await transport.sendMail({
          from: user.email,
          to: recipient.companyEmail.email,
          subject: 'Hello from Knock Knock',
          text: bodyWithResume,
          attachments: attachment
            ? [
                {
                  filename: attachment.filename,
                  content: attachment.content,
                  contentType: attachment.contentType,
                },
              ]
            : undefined,
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
            recipientEmail: recipient.companyEmail.email,
            subject: 'Hello from Knock Knock',
            body: bodyWithResume,
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

  private async getDriveAttachment(
    fileId: string,
  ): Promise<ResumeAttachment | null> {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const headResponse = await fetch(downloadUrl, { method: 'HEAD' }).catch(
      () => null,
    );

    const contentLength = headResponse?.headers.get('content-length');
    if (!contentLength) {
      return null;
    }

    const size = Number(contentLength);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
      return null;
    }

    const response = await fetch(downloadUrl).catch(() => null);
    if (!response?.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const content = Buffer.from(arrayBuffer);
    if (content.length === 0 || content.length > MAX_ATTACHMENT_BYTES) {
      return null;
    }

    const disposition = response.headers.get('content-disposition') ?? '';
    const filename =
      this.extractFilename(disposition) ?? `resume-${fileId}.pdf`;
    const contentType =
      response.headers.get('content-type') ?? 'application/pdf';

    return {
      filename,
      content,
      contentType,
    };
  }

  private extractFilename(contentDisposition: string) {
    const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(
      contentDisposition,
    );
    if (!match?.[1]) {
      return null;
    }

    const decoded = decodeURIComponent(match[1]).replace(/^"|"$/g, '');
    const normalized = basename(decoded.trim());
    return normalized || null;
  }
}
