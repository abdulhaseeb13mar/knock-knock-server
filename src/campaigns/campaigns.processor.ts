import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from '../integrations/gmail/gmail.service';
import { CampaignsEventsService } from './campaigns-events.service';
import { AiService } from '../ai/ai.service';
import {
  AiProvider,
  CampaignStatus,
  Prisma,
  RecipientStatus,
} from '@prisma/client';
import nodemailer from 'nodemailer';
import { basename } from 'path';
import { NotFoundException } from '@nestjs/common';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type ResumeAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

@Processor('email-campaigns')
export class CampaignsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
    private readonly campaignsEvents: CampaignsEventsService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(
    job: Job<{ campaignId: string; userId: string; resumeId: string }>,
  ) {
    const { campaignId, userId, resumeId } = job.data;
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
      where: { campaignId, status: RecipientStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { companyEmail: true },
    });

    const appConfig = await this.prisma.appConfig.findUnique({
      where: { id: 'default' },
    });

    if (!appConfig) {
      throw new NotFoundException('User not found');
    }

    const knockCostPerEmail = this.getKnockCostPerEmailDecimal(
      appConfig.emailsPerKnock,
    );

    let sentCount = 0;
    let failedCount = 0;
    const attachment = await this.getDriveAttachment(resume.fileId);
    const shouldUseLinkOnly = !attachment;

    for (const [index, recipient] of recipients.entries()) {
      const campaignState = await this.prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        include: { emailPromptSet: true },
      });
      if (campaignState?.status === CampaignStatus.PAUSED) {
        this.campaignsEvents.emit(campaignId, {
          status: CampaignStatus.PAUSED,
        });
        return;
      }

      const configuredDailyLimit =
        campaignState?.dailyLimit ?? settings.dailyLimit;
      const dailyCount = await this.countDailySends(userId);
      if (dailyCount >= configuredDailyLimit) {
        await this.prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.PAUSED },
        });
        this.campaignsEvents.emit(campaignId, {
          status: CampaignStatus.PAUSED,
          reason: 'daily-limit',
        });
        return;
      }

      let emailSent = false;
      try {
        const reserved = await this.reserveKnockForEmail(
          userId,
          knockCostPerEmail,
        );
        if (!reserved) {
          await this.prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { status: CampaignStatus.PAUSED },
          });
          this.campaignsEvents.emit(campaignId, {
            status: CampaignStatus.PAUSED,
            reason: 'insufficient-knock',
          });
          return;
        }

        const subject = `Hello from, from Knock Knock`;
        const baseBody =
          'This is a placeholder email body. Replace with AI-generated content.';
        const shouldRewrite =
          settings.rewriteInterval > 0 &&
          (index + 1) % settings.rewriteInterval === 0;
        const body = shouldRewrite
          ? await this.safeRewrite(userId, baseBody, campaignState?.aiProvider)
          : baseBody;
        const bodyWithResume = shouldUseLinkOnly
          ? `${body}\n\nResume: ${resume.sharedUrl}`
          : body;

        // Design choice: use nodemailer with Gmail OAuth2 to ensure emails land in Sent folder.
        await transport.sendMail({
          from: user.email,
          to: recipient.companyEmail.email,
          subject,
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
        emailSent = true;

        sentCount += 1;
        await this.prisma.recipient.update({
          where: { id: recipient.id },
          data: { status: RecipientStatus.SENT, sentAt: new Date() },
        });

        await this.prisma.sentEmail.create({
          data: {
            userId,
            campaignId,
            emailPromptSetId: campaignState?.emailPromptSetId,
            recipientEmail: recipient.companyEmail.email,
            subject,
            body: bodyWithResume,
          },
        });

        await this.prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        });
      } catch (error) {
        if (!emailSent) {
          await this.refundKnockForEmail(userId, knockCostPerEmail);
        }
        failedCount += 1;
        await this.prisma.recipient.update({
          where: { id: recipient.id },
          data: {
            status: RecipientStatus.FAILED,
            error: (error as Error).message,
          },
        });

        await this.prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
      }

      this.campaignsEvents.emit(campaignId, { sentCount, failedCount });
      await this.sleep(settings.delayMs);
    }

    await this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
    });

    this.campaignsEvents.emit(campaignId, { status: CampaignStatus.COMPLETED });
    this.campaignsEvents.complete(campaignId);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async safeRewrite(
    userId: string,
    content: string,
    preferredProvider?: AiProvider | null,
  ) {
    try {
      return await this.aiService.rewriteEmail(
        userId,
        content,
        preferredProvider ?? undefined,
      );
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

  private getKnockCostPerEmailDecimal(emailsPerKnock: number) {
    if (!Number.isFinite(emailsPerKnock) || emailsPerKnock <= 0) {
      return new Prisma.Decimal(1);
    }

    return new Prisma.Decimal(1).dividedBy(emailsPerKnock);
  }

  private async reserveKnockForEmail(
    userId: string,
    knockCostPerEmail: Prisma.Decimal,
  ) {
    const updated = await this.prisma.user.update({
      where: {
        id: userId,
        knockBalance: { gte: knockCostPerEmail },
      },
      data: {
        knockBalance: { decrement: knockCostPerEmail },
      },
    });

    return updated ? true : false;
  }

  private async refundKnockForEmail(
    userId: string,
    knockCostPerEmail: Prisma.Decimal,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        knockBalance: { increment: knockCostPerEmail },
      },
    });
  }
}
