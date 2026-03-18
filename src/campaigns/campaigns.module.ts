import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignsProcessor } from './campaigns.processor';
import { CampaignsEventsService } from './campaigns-events.service';
import { GmailIntegrationModule } from '../integrations/gmail/gmail.module';
import { AiModule } from '../ai/ai.module';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email-campaigns',
    }),
    GmailIntegrationModule,
    AiModule,
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsProcessor,
    CampaignsEventsService,
    AdminRoleGuard,
  ],
})
export class CampaignsModule {}
