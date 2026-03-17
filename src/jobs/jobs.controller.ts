import {
  Body,
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Patch,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { JobsEventsService } from './jobs-events.service';
import { StartJobDto } from './dto/start-job.dto';
import { UpdateJobPromptSetDto } from './dto/update-job-prompt-set.dto';
import { UpdateEmailsPerKnockDto } from './dto/update-emails-per-knock.dto';
import { GrantKnockBalanceDto } from './dto/grant-knock-balance.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobsEvents: JobsEventsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListJobsQueryDto,
  ) {
    return this.jobsService.listJobs(user.userId, query.status);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getDetails(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.jobsService.getJobDetails(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns')
  createCampaign(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCampaignDto,
  ) {
    return this.jobsService.createCampaign(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('start')
  start(@CurrentUser() user: { userId: string }, @Body() dto: StartJobDto) {
    return this.jobsService.startJob(
      user.userId,
      dto.resumeId,
      dto.promptSetId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/prompt-set')
  updatePromptSet(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateJobPromptSetDto,
  ) {
    return this.jobsService.updatePromptSet(user.userId, id, dto.promptSetId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pause')
  pause(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.jobsService.pauseJob(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/resume')
  resume(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.jobsService.resumeJob(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/retry')
  retry(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.jobsService.retryFailed(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  status(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.jobsService.getStatus(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Sse(':id/stream')
  async stream(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    const job = await this.jobsService.getStatus(user.userId, id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return this.jobsEvents.getSubject(id).asObservable();
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get('admin/knock-config')
  getKnockConfig() {
    return this.jobsService.getEmailCostConfig();
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch('admin/knock-config')
  updateKnockConfig(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateEmailsPerKnockDto,
  ) {
    return this.jobsService.updateEmailCostConfig(
      user.userId,
      dto.emailsPerKnock,
    );
  }

  @UseGuards(
    JwtAuthGuard,
    //  AdminRoleGuard
  )
  @Post('admin/grant-testing-knock')
  grantTestingKnock(
    @CurrentUser() user: { userId: string },
    @Body() dto: GrantKnockBalanceDto,
  ) {
    return this.jobsService.grantTestingKnock(user.userId, dto.userId);
  }
}
