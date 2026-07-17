import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const roles = [
  'OWNER',
  'ADMINISTRATOR',
  'EVENT_MANAGER',
  'FINANCE_MANAGER',
  'CONTENT_MANAGER',
  'VIEWER',
  'AUDITOR',
] as const;

export class OrganizationIdParamDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}

export class MembershipIdParamDto extends OrganizationIdParamDto {
  @ApiProperty()
  @IsUUID()
  membershipId!: string;
}

export class InvitationIdParamDto extends OrganizationIdParamDto {
  @ApiProperty()
  @IsUUID()
  invitationId!: string;
}

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(63)
  slug!: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @MaxLength(12)
  defaultLocale!: string;

  @ApiProperty({ example: 'Africa/Lome' })
  @IsString()
  @MaxLength(64)
  timezone!: string;
}

export class UpdateOrganizationDto extends CreateOrganizationDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class LifecycleDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class UpdateMembershipRoleDto {
  @ApiProperty({ enum: roles })
  @IsIn(roles)
  role!: (typeof roles)[number];
}

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: roles })
  @IsIn(roles)
  role!: (typeof roles)[number];
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsUUID()
  tokenId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(512)
  token!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  recipientEmail!: string;
}

export class OwnershipTransferDto {
  @ApiProperty()
  @IsUUID()
  currentOwnerMembershipId!: string;

  @ApiProperty()
  @IsUUID()
  targetMembershipId!: string;

  @ApiProperty({ enum: roles.filter((role) => role !== 'OWNER') })
  @IsIn(roles.filter((role) => role !== 'OWNER'))
  previousOwnerRole!: Exclude<(typeof roles)[number], 'OWNER'>;
}
