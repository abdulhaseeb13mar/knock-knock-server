import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RewriteEmailDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  input: string;
}
