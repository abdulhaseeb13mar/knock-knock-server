import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus, Prisma, RecipientStatus } from '@prisma/client';
import { CampaignsEventsService } from './campaigns-events.service';
import { AuditService } from '../audit/audit.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsEvents: CampaignsEventsService,
    @InjectQueue('email-campaigns') private readonly queue: Queue,
    private readonly audit: AuditService,
  ) {}

  async createCampaign(userId: string, dto: CreateCampaignDto) {
    const uniqueRecipientIds = Array.from(new Set(dto.recipientIds));
    const selectedPromptSetId = dto.emailPromptSetId;

    if (selectedPromptSetId) {
      await this.getPromptSetForUser(userId, selectedPromptSetId);
    }

    const aiKey = await this.prisma.aiKey.findUnique({
      where: {
        userId_provider: { userId, provider: dto.aiProvider },
      },
      select: { id: true },
    });

    if (!aiKey) {
      throw new BadRequestException(
        `No API key saved for provider: ${dto.aiProvider}`,
      );
    }

    const recipients = await this.prisma.recipient.findMany({
      where: {
        id: { in: uniqueRecipientIds },
        userId,
        status: RecipientStatus.PENDING,
        campaignId: null,
      },
      select: { id: true },
    });

    if (recipients.length !== uniqueRecipientIds.length) {
      throw new BadRequestException(
        'Some recipients are invalid, already assigned, or not pending',
      );
    }

    const campaign = await this.prisma.$transaction(async (tx) => {
      const promptSetId = selectedPromptSetId
        ? selectedPromptSetId
        : (
            await tx.emailPromptSet.create({
              data: {
                userId,
                emailFormat: dto.emailFormat!,
                aiPrompt: dto.aiPrompt!,
              },
            })
          ).id;

      const createdCampaign = await tx.emailCampaign.create({
        data: {
          userId,
          emailPromptSetId: promptSetId,
          status: CampaignStatus.PAUSED,
          total: recipients.length,
          aiProvider: dto.aiProvider,
          dailyLimit: dto.dailyLimit,
        },
      });

      await tx.recipient.updateMany({
        where: { id: { in: uniqueRecipientIds } },
        data: { campaignId: createdCampaign.id },
      });

      return createdCampaign;
    });

    await this.audit.log({
      userId,
      action: 'campaigns.created',
      metadata: {
        campaignId: campaign.id,
        recipientCount: uniqueRecipientIds.length,
        emailPromptSetId: campaign.emailPromptSetId,
        usedExistingPromptSet: Boolean(selectedPromptSetId),
        aiProvider: dto.aiProvider,
        dailyLimit: dto.dailyLimit,
      },
    });

    this.campaignsEvents.emit(campaign.id, {
      status: campaign.status,
      total: campaign.total,
    });

    return campaign;
  }

  async startCampaign(userId: string, resumeId: string, promptSetId: string) {
    const resume = await this.prisma.resumeFile.findFirst({
      where: { id: resumeId, userId },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    await this.getPromptSetForUser(userId, promptSetId);

    const recipients = await this.prisma.recipient.findMany({
      where: { userId, status: RecipientStatus.PENDING },
      take: 10000,
    });

    if (recipients.length === 0) {
      return { message: 'No pending recipients' };
    }

    const campaign = await this.prisma.emailCampaign.create({
      data: {
        userId,
        emailPromptSetId: promptSetId,
        status: CampaignStatus.RUNNING,
        total: recipients.length,
      },
    });

    await this.prisma.recipient.updateMany({
      where: { id: { in: recipients.map((r) => r.id) } },
      data: { campaignId: campaign.id },
    });

    await this.queue.add('send-bulk-email', {
      campaignId: campaign.id,
      userId,
      resumeId,
    });

    this.campaignsEvents.emit(campaign.id, {
      status: campaign.status,
      total: campaign.total,
    });
    await this.audit.log({
      userId,
      action: 'campaigns.started',
      metadata: { campaignId: campaign.id, resumeId, promptSetId },
    });

    return campaign;
  }

  async updatePromptSet(
    userId: string,
    campaignId: string,
    promptSetId: string,
  ) {
    await this.getPromptSetForUser(userId, promptSetId);

    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot change prompt set for a completed campaign',
      );
    }

    const updatedCampaign = await this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { emailPromptSetId: promptSetId },
    });

    this.campaignsEvents.emit(campaignId, { emailPromptSetId: promptSetId });
    await this.audit.log({
      userId,
      action: 'campaigns.prompt-set.updated',
      metadata: { campaignId, promptSetId },
    });

    return updatedCampaign;
  }

  async pauseCampaign(userId: string, campaignId: string) {
    await this.prisma.emailCampaign.updateMany({
      where: { id: campaignId, userId },
      data: { status: CampaignStatus.PAUSED },
    });
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    this.campaignsEvents.emit(campaign.id, { status: campaign.status });
    await this.audit.log({
      userId,
      action: 'campaigns.paused',
      metadata: { campaignId },
    });
    return campaign;
  }

  async resumeCampaign(userId: string, campaignId: string) {
    const latestResume = await this.prisma.resumeFile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestResume) {
      throw new NotFoundException('Resume not found');
    }

    await this.prisma.emailCampaign.updateMany({
      where: { id: campaignId, userId },
      data: { status: CampaignStatus.RUNNING },
    });
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.queue.add('send-bulk-email', {
      campaignId: campaign.id,
      userId,
      resumeId: latestResume.id,
    });

    this.campaignsEvents.emit(campaign.id, { status: campaign.status });
    await this.audit.log({
      userId,
      action: 'campaigns.resumed',
      metadata: { campaignId },
    });
    return campaign;
  }

  async retryFailed(userId: string, campaignId: string) {
    const latestResume = await this.prisma.resumeFile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestResume) {
      throw new NotFoundException('Resume not found');
    }

    await this.prisma.recipient.updateMany({
      where: { userId, campaignId, status: RecipientStatus.FAILED },
      data: { status: RecipientStatus.PENDING, error: null },
    });

    await this.prisma.emailCampaign.updateMany({
      where: { id: campaignId, userId },
      data: { status: CampaignStatus.RUNNING },
    });
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.queue.add('send-bulk-email', {
      campaignId: campaign.id,
      userId,
      resumeId: latestResume.id,
    });
    this.campaignsEvents.emit(campaign.id, {
      status: campaign.status,
      retry: true,
    });
    await this.audit.log({
      userId,
      action: 'campaigns.retried',
      metadata: { campaignId },
    });
    return campaign;
  }

  async getStatus(userId: string, campaignId: string) {
    return this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
    });
  }

  async listCampaigns(userId: string, status?: CampaignStatus) {
    const where: Prisma.EmailCampaignWhereInput = { userId };
    if (status) {
      where.status = status;
    }

    return this.prisma.emailCampaign.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        emailPromptSet: { select: { id: true, emailFormat: true } },
        _count: { select: { recipients: true, sentEmails: true } },
      },
    });
  }

  async getCampaignDetails(userId: string, campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        emailPromptSet: true,
        recipients: {
          include: { companyEmail: { include: { company: true } } },
          orderBy: { createdAt: 'asc' },
        },
        sentEmails: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async getEmailCostConfig() {
    const config = await this.ensureAppConfig();
    return { emailsPerKnock: config.emailsPerKnock };
  }

  async updateEmailCostConfig(adminUserId: string, emailsPerKnock: number) {
    const updated = await this.prisma.appConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', emailsPerKnock },
      update: { emailsPerKnock },
    });

    await this.audit.log({
      userId: adminUserId,
      action: 'campaigns.knock-config.updated',
      metadata: { emailsPerKnock },
    });

    return { emailsPerKnock: updated.emailsPerKnock };
  }

  async grantTestingKnock(adminUserId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { knockBalance: { increment: new Prisma.Decimal(100) } },
      select: { id: true, knockBalance: true },
    });

    await this.audit.log({
      userId: adminUserId,
      action: 'campaigns.knock.granted',
      metadata: { targetUserId, amount: 100 },
    });

    return {
      userId: updatedUser.id,
      granted: 100,
      knockBalance: updatedUser.knockBalance,
    };
  }

  async recordProgress(
    campaignId: string,
    payload: { sentCount: number; failedCount: number },
  ) {
    await this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount: payload.sentCount,
        failedCount: payload.failedCount,
      },
    });
    this.campaignsEvents.emit(campaignId, payload);
  }

  private async getPromptSetForUser(userId: string, promptSetId: string) {
    const promptSet = await this.prisma.emailPromptSet.findFirst({
      where: { id: promptSetId, userId },
    });

    if (!promptSet) {
      throw new NotFoundException('Email prompt set not found');
    }

    return promptSet;
  }

  private async ensureAppConfig() {
    return this.prisma.appConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', emailsPerKnock: 1 },
      update: {},
    });
  }
}
