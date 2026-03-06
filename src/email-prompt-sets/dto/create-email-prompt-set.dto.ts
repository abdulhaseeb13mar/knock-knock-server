import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEmailPromptSetDto {
  @IsString()
  @IsNotEmpty()
  emailFormat: string;

  @IsString()
  @IsNotEmpty()
  aiPrompt: string;
}
