import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CandidateApplicationService } from '@seneve/candidate-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { correlationIdFrom } from '../auth/providers/http-context.js';
import { CANDIDATE_APPLICATION_SERVICE } from './candidate.tokens.js';
import {
  CandidateLifecycleDto,
  CandidateListQueryDto,
  CandidateParamDto,
  CandidateReasonDto,
  CampaignCandidateParamDto,
  CreateCandidateDto,
  ReorderCandidatesDto,
  UpdateCandidateDto,
} from './dto/candidate.dto.js';
import { mapCandidateError } from './mappers/candidate-error.mapper.js';
import { candidateResponse } from './mappers/candidate-response.mapper.js';

@ApiTags('Candidates')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('organizations/:organizationId/campaigns/:campaignId/candidates')
export class CandidateController {
  constructor(
    @Inject(CANDIDATE_APPLICATION_SERVICE)
    private readonly candidates: CandidateApplicationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a candidate in the target campaign.' })
  async create(
    @Param() params: CampaignCandidateParamDto,
    @Body() body: CreateCandidateDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.candidates.createCandidate({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        ...body,
        correlationId,
      });

      return { candidate: candidateResponse(result.candidate), correlationId };
    } catch (error) {
      throw mapCandidateError(error, correlationId);
    }
  }

  @Get()
  async list(
    @Param() params: CampaignCandidateParamDto,
    @Query() query: CandidateListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.candidates.listCandidates({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        correlationId,
        filters: {
          status: query.status,
          search: query.search,
          createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
          createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
          eligibleOnly: query.eligibleOnly,
          limit: query.limit ?? 50,
          cursor: query.cursor ?? null,
        },
      });

      return {
        candidates: result.candidates.map(candidateResponse),
        nextCursor: result.nextCursor,
        correlationId,
      };
    } catch (error) {
      throw mapCandidateError(error, correlationId);
    }
  }

  @Get(':candidateId')
  async get(@Param() params: CandidateParamDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.candidates.getCandidate({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        candidateId: params.candidateId,
        correlationId,
      });

      return { candidate: candidateResponse(result.candidate), correlationId };
    } catch (error) {
      throw mapCandidateError(error, correlationId);
    }
  }

  @Patch(':candidateId')
  async update(
    @Param() params: CandidateParamDto,
    @Body() body: UpdateCandidateDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.candidates.updateCandidate({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        candidateId: params.candidateId,
        ...body,
        correlationId,
      });

      return { candidate: candidateResponse(result.candidate), correlationId };
    } catch (error) {
      throw mapCandidateError(error, correlationId);
    }
  }

  @Post(':candidateId/eligible')
  async eligible(
    @Param() params: CandidateParamDto,
    @Body() body: CandidateLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'eligible');
  }

  @Post(':candidateId/suspend')
  async suspend(
    @Param() params: CandidateParamDto,
    @Body() body: CandidateReasonDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'suspend');
  }

  @Post(':candidateId/reactivate')
  async reactivate(
    @Param() params: CandidateParamDto,
    @Body() body: CandidateLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'reactivate');
  }

  @Post(':candidateId/withdraw')
  async withdraw(
    @Param() params: CandidateParamDto,
    @Body() body: CandidateReasonDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'withdraw');
  }

  @Post(':candidateId/disqualify')
  async disqualify(
    @Param() params: CandidateParamDto,
    @Body() body: CandidateReasonDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'disqualify');
  }

  @Post(':candidateId/archive')
  async archive(
    @Param() params: CandidateParamDto,
    @Body() body: CandidateLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'archive');
  }

  @Post('reorder')
  async reorder(
    @Param() params: CampaignCandidateParamDto,
    @Body() body: ReorderCandidatesDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.candidates.reorderCandidates({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        candidateIds: body.candidateIds,
        correlationId,
      });

      return {
        candidates: result.candidates.map(candidateResponse),
        nextCursor: result.nextCursor,
        correlationId,
      };
    } catch (error) {
      throw mapCandidateError(error, correlationId);
    }
  }

  private async transition(
    params: CandidateParamDto,
    body: CandidateLifecycleDto | CandidateReasonDto,
    request: AuthenticatedHttpRequest,
    target: 'eligible' | 'suspend' | 'reactivate' | 'withdraw' | 'disqualify' | 'archive',
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const base = {
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        candidateId: params.candidateId,
        expectedVersion: body.expectedVersion,
        correlationId,
      };
      const result =
        target === 'eligible'
          ? await this.candidates.markCandidateEligible(base)
          : target === 'suspend'
            ? await this.candidates.suspendCandidate({
                ...base,
                reason: (body as CandidateReasonDto).reason,
              })
            : target === 'reactivate'
              ? await this.candidates.reactivateCandidate(base)
              : target === 'withdraw'
                ? await this.candidates.withdrawCandidate({
                    ...base,
                    reason: (body as CandidateReasonDto).reason,
                  })
                : target === 'disqualify'
                  ? await this.candidates.disqualifyCandidate({
                      ...base,
                      reason: (body as CandidateReasonDto).reason,
                    })
                  : await this.candidates.archiveCandidate(base);

      return { candidate: candidateResponse(result.candidate), correlationId };
    } catch (error) {
      throw mapCandidateError(error, correlationId);
    }
  }
}

function requireAuth(request: AuthenticatedHttpRequest, correlationId: string) {
  if (!request.auth) {
    throw new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required.',
      correlationId,
    });
  }

  return request.auth;
}
