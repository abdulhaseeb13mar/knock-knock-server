import {
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { JobsEventsService } from './jobs-events.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobsEvents: JobsEventsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('start')
  start(@CurrentUser() user: { userId: string }) {
    return this.jobsService.startJob(user.userId);
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
}
