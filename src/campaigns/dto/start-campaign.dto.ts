import { IsNotEmpty, IsString } from 'class-validator';

export class StartCampaignDto {
  @IsString()
  @IsNotEmpty()
  resumeId: string;

  @IsString()
  @IsNotEmpty()
  promptSetId: string;
}
