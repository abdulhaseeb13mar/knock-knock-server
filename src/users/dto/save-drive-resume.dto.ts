import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class SaveDriveResumeDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: true })
  sharedUrl: string;
}
