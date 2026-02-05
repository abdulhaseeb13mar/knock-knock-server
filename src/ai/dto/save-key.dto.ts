import { IsEnum, IsString } from 'class-validator';
import { AiProvider } from '@prisma/client';

export class SaveKeyDto {
  @IsEnum(AiProvider)
  provider: AiProvider;

  @IsString()
  apiKey: string;
}
