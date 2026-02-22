import { IsNotEmpty, IsString } from 'class-validator';

export class StartJobDto {
  @IsString()
  @IsNotEmpty()
  resumeId: string;
}
