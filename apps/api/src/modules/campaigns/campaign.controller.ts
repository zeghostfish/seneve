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
import type { CampaignApplicationService } from '@seneve/campaign-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { correlationIdFrom } from '../auth/providers/http-context.js';
import { CAMPAIGN_APPLICATION_SERVICE } from './campaign.tokens.js';
import {
  CampaignLifecycleDto,
  CampaignListQueryDto,
  CampaignParamDto,
  CreateCampaignDto,
  OrganizationCampaignParamDto,
  ScheduleCampaignDto,
  UpdateCampaignDto,
  UpdateCampaignRulesDto,
} from './dto/campaign.dto.js';
import { mapCampaignError } from './mappers/campaign-error.mapper.js';
import { campaignResponse } from './mappers/campaign-response.mapper.js';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('organizations/:organizationId/campaigns')
export class CampaignController {
  constructor(
    @Inject(CAMPAIGN_APPLICATION_SERVICE)
    private readonly campaigns: CampaignApplicationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign in the target organization.' })
  async create(
    @Param() params: OrganizationCampaignParamDto,
    @Body() body: CreateCampaignDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.createCampaign({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        ...body,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        resultRevealAt: body.resultRevealAt ? new Date(body.resultRevealAt) : null,
        correlationId,
      });

      return {
        campaign: campaignResponse(result.campaign),
        correlationId,
      };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }

  @Get()
  async list(
    @Param() params: OrganizationCampaignParamDto,
    @Query() query: CampaignListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.listCampaigns({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        correlationId,
        filters: {
          status: query.status,
          visibility: query.visibility,
          search: query.search,
          createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
          createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
          startsFrom: query.startsFrom ? new Date(query.startsFrom) : undefined,
          startsTo: query.startsTo ? new Date(query.startsTo) : undefined,
          limit: query.limit ?? 25,
          cursor: query.cursor ?? null,
        },
      });

      return {
        campaigns: result.campaigns.map(campaignResponse),
        nextCursor: result.nextCursor,
        correlationId,
      };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }

  @Get(':campaignId')
  async get(@Param() params: CampaignParamDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.getCampaign({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        correlationId,
      });

      return {
        campaign: campaignResponse(result.campaign),
        correlationId,
      };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }

  @Patch(':campaignId')
  async update(
    @Param() params: CampaignParamDto,
    @Body() body: UpdateCampaignDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.updateCampaign({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        ...body,
        correlationId,
      });

      return { campaign: campaignResponse(result.campaign), correlationId };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }

  @Patch(':campaignId/rules')
  async updateRules(
    @Param() params: CampaignParamDto,
    @Body() body: UpdateCampaignRulesDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.updateCampaignRules({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        ...body,
        resultRevealAt: body.resultRevealAt ? new Date(body.resultRevealAt) : null,
        correlationId,
      });

      return { campaign: campaignResponse(result.campaign), correlationId };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }

  @Post(':campaignId/schedule')
  async schedule(
    @Param() params: CampaignParamDto,
    @Body() body: ScheduleCampaignDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.scheduleCampaign({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        expectedVersion: body.expectedVersion,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        timezone: body.timezone,
        locale: body.locale,
        correlationId,
      });

      return { campaign: campaignResponse(result.campaign), correlationId };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }

  @Post(':campaignId/activate')
  async activate(
    @Param() params: CampaignParamDto,
    @Body() body: CampaignLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'activate');
  }

  @Post(':campaignId/pause')
  async pause(
    @Param() params: CampaignParamDto,
    @Body() body: CampaignLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'pause');
  }

  @Post(':campaignId/complete')
  async complete(
    @Param() params: CampaignParamDto,
    @Body() body: CampaignLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'complete');
  }

  @Post(':campaignId/cancel')
  async cancel(
    @Param() params: CampaignParamDto,
    @Body() body: CampaignLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'cancel');
  }

  @Post(':campaignId/archive')
  async archive(
    @Param() params: CampaignParamDto,
    @Body() body: CampaignLifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'archive');
  }

  private async transition(
    params: CampaignParamDto,
    body: CampaignLifecycleDto,
    request: AuthenticatedHttpRequest,
    target: 'activate' | 'pause' | 'complete' | 'cancel' | 'archive',
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.campaigns.transitionCampaign(
        {
          actorIdentityId: auth.identityId,
          organizationId: params.organizationId,
          campaignId: params.campaignId,
          expectedVersion: body.expectedVersion,
          correlationId,
        },
        target,
      );

      return { campaign: campaignResponse(result.campaign), correlationId };
    } catch (error) {
      throw mapCampaignError(error, correlationId);
    }
  }
}

function requireAuth(request: AuthenticatedHttpRequest, correlationId: string) {
  if (!request.auth?.identityId) {
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
      correlationId,
    });
  }

  return request.auth;
}
