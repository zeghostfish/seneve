import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { VotingApplicationService } from '@seneve/voting-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { correlationIdFrom } from '../auth/providers/http-context.js';
import {
  SubmitFreeVoteDto,
  VoteAttemptParamDto,
  VotingCampaignParamDto,
  VotingHistoryQueryDto,
  VotingOrganizationParamDto,
} from './dto/voting.dto.js';
import { mapVotingError } from './mappers/voting-error.mapper.js';
import {
  ballotResponse,
  votingReceiptResponse,
  votingResponse,
} from './mappers/voting-response.mapper.js';
import { VOTING_APPLICATION_SERVICE } from './voting.tokens.js';

@ApiTags('Voting')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('voting/organizations/:organizationId')
export class VotingController {
  constructor(
    @Inject(VOTING_APPLICATION_SERVICE)
    private readonly voting: VotingApplicationService,
  ) {}

  @Get('campaigns/:campaignId/ballot')
  @ApiOperation({ summary: 'Read an authenticated free-voting ballot.' })
  async getBallot(
    @Param() params: VotingCampaignParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const identityId = requireIdentity(request, correlationId);
    try {
      const result = await this.voting.getBallot({
        voterIdentityId: identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        correlationId,
      });
      return { ballot: ballotResponse(result), correlationId };
    } catch (error) {
      throw mapVotingError(error, correlationId);
    }
  }

  @Post('campaigns/:campaignId/votes')
  @ApiOperation({ summary: 'Submit an idempotent authenticated free vote.' })
  async submit(
    @Param() params: VotingCampaignParamDto,
    @Body() body: SubmitFreeVoteDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const identityId = requireIdentity(request, correlationId);
    try {
      const result = await this.voting.submitFreeVote({
        voterIdentityId: identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        candidateId: body.candidateId,
        requestId: body.requestId,
        correlationId,
      });
      return { vote: votingResponse(result.vote), replayed: result.replayed, correlationId };
    } catch (error) {
      throw mapVotingError(error, correlationId);
    }
  }

  @Get('votes/:voteAttemptId')
  @ApiOperation({ summary: 'Read an authenticated identity own vote attempt.' })
  async getOwn(@Param() params: VoteAttemptParamDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const identityId = requireIdentity(request, correlationId);
    try {
      const result = await this.voting.getOwnVote({
        voterIdentityId: identityId,
        organizationId: params.organizationId,
        voteAttemptId: params.voteAttemptId,
        correlationId,
      });
      return { vote: votingResponse(result.vote), correlationId };
    } catch (error) {
      throw mapVotingError(error, correlationId);
    }
  }

  @Get('votes')
  @ApiOperation({ summary: 'List the authenticated identity confirmed vote receipts.' })
  async listOwn(
    @Param() params: VotingOrganizationParamDto,
    @Query() query: VotingHistoryQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const identityId = requireIdentity(request, correlationId);
    try {
      const result = await this.voting.listOwnVotes({
        voterIdentityId: identityId,
        organizationId: params.organizationId,
        limit: query.limit ?? 25,
        cursor: query.cursor ?? null,
        correlationId,
      });
      return {
        receipts: result.receipts.map(votingReceiptResponse),
        nextCursor: result.nextCursor,
        correlationId,
      };
    } catch (error) {
      throw mapVotingError(error, correlationId);
    }
  }
}

function requireIdentity(request: AuthenticatedHttpRequest, correlationId: string): string {
  if (!request.auth?.identityId) {
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
      correlationId,
    });
  }
  return request.auth.identityId;
}
