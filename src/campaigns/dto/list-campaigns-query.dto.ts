import { IsEnum, IsOptional } from 'class-validator';
import { CampaignStatus } from '@prisma/client';

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
