import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';
import { AiProvider } from '@prisma/client';

export class CreateCampaignDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recipientIds: string[];

  @IsEnum(AiProvider)
  aiProvider: AiProvider;

  @IsString()
  @IsNotEmpty()
  emailFormat: string;

  @IsString()
  @IsNotEmpty()
  aiPrompt: string;

  @IsInt()
  @Min(1)
  dailyLimit: number;
}
