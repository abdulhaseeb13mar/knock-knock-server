import { IsOptional, IsString } from 'class-validator';

export class UpdateEmailPromptSetDto {
  @IsString()
  @IsOptional()
  emailFormat?: string;

  @IsString()
  @IsOptional()
  aiPrompt?: string;
}
