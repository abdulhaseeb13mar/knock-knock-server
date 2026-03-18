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
import { CampaignsService } from './campaigns.service';
import { CampaignsEventsService } from './campaigns-events.service';
import { StartCampaignDto } from './dto/start-campaign.dto';
import { UpdateCampaignPromptSetDto } from './dto/update-campaign-prompt-set.dto';
import { UpdateEmailsPerKnockDto } from './dto/update-emails-per-knock.dto';
import { GrantKnockBalanceDto } from './dto/grant-knock-balance.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly campaignsEvents: CampaignsEventsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListCampaignsQueryDto,
  ) {
    return this.campaignsService.listCampaigns(user.userId, query.status);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getDetails(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.campaignsService.getCampaignDetails(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createCampaign(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.createCampaign(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('start')
  start(
    @CurrentUser() user: { userId: string },
    @Body() dto: StartCampaignDto,
  ) {
    return this.campaignsService.startCampaign(
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
    @Body() dto: UpdateCampaignPromptSetDto,
  ) {
    return this.campaignsService.updatePromptSet(
      user.userId,
      id,
      dto.promptSetId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pause')
  pause(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.campaignsService.pauseCampaign(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/resume')
  resume(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.campaignsService.resumeCampaign(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/retry')
  retry(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.campaignsService.retryFailed(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  status(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.campaignsService.getStatus(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Sse(':id/stream')
  async stream(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ): Promise<Observable<MessageEvent>> {
    const campaign = await this.campaignsService.getStatus(user.userId, id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.campaignsEvents.getSubject(id).asObservable();
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Get('admin/knock-config')
  getKnockConfig() {
    return this.campaignsService.getEmailCostConfig();
  }

  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @Patch('admin/knock-config')
  updateKnockConfig(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateEmailsPerKnockDto,
  ) {
    return this.campaignsService.updateEmailCostConfig(
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
    return this.campaignsService.grantTestingKnock(user.userId, dto.userId);
  }
}
