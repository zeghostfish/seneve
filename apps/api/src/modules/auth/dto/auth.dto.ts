import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  password!: string;
}

export class LoginRequestDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @ApiProperty({ required: false, example: 'Ada MacBook' })
  @IsString()
  @MaxLength(120)
  deviceDisplayName?: string;
}

export class EmailVerificationTokenDto {
  @ApiProperty()
  @IsUUID()
  tokenId!: string;

  @ApiProperty({ minLength: 20, maxLength: 512 })
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token!: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class PasswordResetCompleteDto {
  @ApiProperty()
  @IsUUID()
  tokenId!: string;

  @ApiProperty({ minLength: 20, maxLength: 512 })
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 256 })
  @IsString()
  @MinLength(12)
  @MaxLength(256)
  newPassword!: string;
}

export class SessionIdParamDto {
  @ApiProperty()
  @IsUUID()
  sessionId!: string;
}
