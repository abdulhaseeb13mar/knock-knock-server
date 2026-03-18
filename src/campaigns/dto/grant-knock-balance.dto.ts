import { IsNotEmpty, IsString } from 'class-validator';

export class GrantKnockBalanceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
