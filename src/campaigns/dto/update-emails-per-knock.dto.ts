import { IsInt, Min } from 'class-validator';

export class UpdateEmailsPerKnockDto {
  @IsInt()
  @Min(1)
  emailsPerKnock: number;
}
