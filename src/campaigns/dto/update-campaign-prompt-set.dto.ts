import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCampaignPromptSetDto {
  @IsString()
  @IsNotEmpty()
  promptSetId: string;
}
