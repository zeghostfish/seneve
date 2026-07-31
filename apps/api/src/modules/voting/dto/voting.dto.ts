import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class VotingOrganizationParamDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}

export class VotingCampaignParamDto extends VotingOrganizationParamDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;
}

export class VoteAttemptParamDto extends VotingOrganizationParamDto {
  @ApiProperty()
  @IsUUID()
  voteAttemptId!: string;
}

export class SubmitFreeVoteDto {
  @ApiProperty()
  @IsUUID()
  candidateId!: string;

  @ApiProperty({ description: 'Client-generated idempotency identifier.' })
  @IsUUID()
  requestId!: string;
}

export class VotingHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
