import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateJobPromptSetDto {
  @IsString()
  @IsNotEmpty()
  promptSetId: string;
}
