import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { AiProvider } from '@prisma/client';

export class CreateCampaignDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recipientIds: string[];

  @IsEnum(AiProvider)
  aiProvider: AiProvider;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  emailPromptSetId?: string;

  @ValidateIf((dto: CreateCampaignDto) => !dto.emailPromptSetId)
  @IsString()
  @IsNotEmpty()
  emailFormat?: string;

  @ValidateIf((dto: CreateCampaignDto) => !dto.emailPromptSetId)
  @IsString()
  @IsNotEmpty()
  aiPrompt?: string;

  @IsInt()
  @Min(1)
  dailyLimit: number;
}
