import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const statuses = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
] as const;
const visibilities = ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const;
const votingModes = ['FREE', 'PAID', 'HYBRID'] as const;
const resultVisibilities = ['HIDDEN', 'LIVE', 'AFTER_CAMPAIGN', 'SCHEDULED'] as const;

export class OrganizationCampaignParamDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}

export class CampaignParamDto extends OrganizationCampaignParamDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;
}

export class CampaignRulesDto {
  @ApiProperty({ enum: votingModes })
  @IsIn(votingModes)
  votingMode!: (typeof votingModes)[number];

  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  votesPerVoter!: number;

  @ApiProperty()
  @IsBoolean()
  allowMultipleCandidates!: boolean;

  @ApiProperty()
  @IsBoolean()
  requiresEmailVerification!: boolean;

  @ApiProperty({ enum: resultVisibilities })
  @IsIn(resultVisibilities)
  resultsVisibility!: (typeof resultVisibilities)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  resultRevealAt?: string;
}

export class CreateCampaignDto extends CampaignRulesDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(63)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: visibilities })
  @IsIn(visibilities)
  visibility!: (typeof visibilities)[number];

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ example: 'Africa/Lome' })
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @MaxLength(12)
  locale!: string;
}

export class UpdateCampaignDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(63)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: visibilities })
  @IsIn(visibilities)
  visibility!: (typeof visibilities)[number];
}

export class UpdateCampaignRulesDto extends CampaignRulesDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ScheduleCampaignDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ example: 'Africa/Lome' })
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @MaxLength(12)
  locale!: string;
}

export class CampaignLifecycleDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CampaignListQueryDto {
  @ApiPropertyOptional({ enum: statuses })
  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];

  @ApiPropertyOptional({ enum: visibilities })
  @IsOptional()
  @IsIn(visibilities)
  visibility?: (typeof visibilities)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsTo?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
