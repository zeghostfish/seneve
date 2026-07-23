import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class VotingCampaignParamDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;

  @ApiProperty()
  @IsUUID()
  campaignId!: string;
}

export class VoteAttemptParamDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;

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
