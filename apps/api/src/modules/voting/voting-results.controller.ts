import {
  Controller,
  Get,
  Inject,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { VotingResultsApplicationService } from '@seneve/voting-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { correlationIdFrom } from '../auth/providers/http-context.js';
import { VotingCampaignParamDto } from './dto/voting.dto.js';
import { mapVotingError } from './mappers/voting-error.mapper.js';
import { privateVotingResultsResponse } from './mappers/voting-response.mapper.js';
import { VOTING_RESULTS_APPLICATION_SERVICE } from './voting.tokens.js';

@ApiTags('Voting results')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('organizations/:organizationId/campaigns/:campaignId/voting-results')
export class VotingResultsController {
  constructor(
    @Inject(VOTING_RESULTS_APPLICATION_SERVICE)
    private readonly votingResults: VotingResultsApplicationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Read private aggregate voting results for a campaign.' })
  async get(@Param() params: VotingCampaignParamDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const actorIdentityId = request.auth?.identityId;
    if (!actorIdentityId) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
        correlationId,
      });
    }

    try {
      const result = await this.votingResults.getPrivateResults({
        actorIdentityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        correlationId,
      });
      return { results: privateVotingResultsResponse(result), correlationId };
    } catch (error) {
      throw mapVotingError(error, correlationId);
    }
  }
}
