import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsProcessor } from './jobs.processor';
import { JobsEventsService } from './jobs-events.service';
import { GmailIntegrationModule } from '../integrations/gmail/gmail.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email-jobs',
    }),
    GmailIntegrationModule,
    AiModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor, JobsEventsService],
})
export class JobsModule {}
