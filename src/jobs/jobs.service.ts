import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus, RecipientStatus } from '@prisma/client';
import { JobsEventsService } from './jobs-events.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsEvents: JobsEventsService,
    @InjectQueue('email-jobs') private readonly queue: Queue,
    private readonly audit: AuditService,
  ) {}

  async startJob(userId: string, resumeId: string, promptSetId: string) {
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

    const job = await this.prisma.emailJob.create({
      data: {
        userId,
        emailPromptSetId: promptSetId,
        status: JobStatus.RUNNING,
        total: recipients.length,
      },
    });

    await this.prisma.recipient.updateMany({
      where: { id: { in: recipients.map((r) => r.id) } },
      data: { jobId: job.id },
    });

    await this.queue.add('send-bulk-email', {
      jobId: job.id,
      userId,
      resumeId,
    });

    this.jobsEvents.emit(job.id, { status: job.status, total: job.total });
    await this.audit.log({
      userId,
      action: 'jobs.start',
      metadata: { jobId: job.id, resumeId, promptSetId },
    });

    return job;
  }

  async updatePromptSet(userId: string, jobId: string, promptSetId: string) {
    await this.getPromptSetForUser(userId, promptSetId);

    const job = await this.prisma.emailJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new BadRequestException(
        'Cannot change prompt set for a completed job',
      );
    }

    const updatedJob = await this.prisma.emailJob.update({
      where: { id: jobId },
      data: { emailPromptSetId: promptSetId },
    });

    this.jobsEvents.emit(jobId, { emailPromptSetId: promptSetId });
    await this.audit.log({
      userId,
      action: 'jobs.prompt-set.updated',
      metadata: { jobId, promptSetId },
    });

    return updatedJob;
  }

  async pauseJob(userId: string, jobId: string) {
    await this.prisma.emailJob.updateMany({
      where: { id: jobId, userId },
      data: { status: JobStatus.PAUSED },
    });
    const job = await this.prisma.emailJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    this.jobsEvents.emit(job.id, { status: job.status });
    await this.audit.log({ userId, action: 'jobs.pause', metadata: { jobId } });
    return job;
  }

  async resumeJob(userId: string, jobId: string) {
    await this.prisma.emailJob.updateMany({
      where: { id: jobId, userId },
      data: { status: JobStatus.RUNNING },
    });
    const job = await this.prisma.emailJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    this.jobsEvents.emit(job.id, { status: job.status });
    await this.audit.log({
      userId,
      action: 'jobs.resume',
      metadata: { jobId },
    });
    return job;
  }

  async retryFailed(userId: string, jobId: string) {
    const latestResume = await this.prisma.resumeFile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestResume) {
      throw new NotFoundException('Resume not found');
    }

    await this.prisma.recipient.updateMany({
      where: { userId, jobId, status: RecipientStatus.FAILED },
      data: { status: RecipientStatus.PENDING, error: null },
    });

    await this.prisma.emailJob.updateMany({
      where: { id: jobId, userId },
      data: { status: JobStatus.RUNNING },
    });
    const job = await this.prisma.emailJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    await this.queue.add('send-bulk-email', {
      jobId: job.id,
      userId,
      resumeId: latestResume.id,
    });
    this.jobsEvents.emit(job.id, { status: job.status, retry: true });
    await this.audit.log({ userId, action: 'jobs.retry', metadata: { jobId } });
    return job;
  }

  async getStatus(userId: string, jobId: string) {
    return this.prisma.emailJob.findFirst({
      where: { id: jobId, userId },
    });
  }

  async recordProgress(
    jobId: string,
    payload: { sentCount: number; failedCount: number },
  ) {
    await this.prisma.emailJob.update({
      where: { id: jobId },
      data: {
        sentCount: payload.sentCount,
        failedCount: payload.failedCount,
      },
    });
    this.jobsEvents.emit(jobId, payload);
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
}
