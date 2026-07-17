import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OrganizationApplicationService } from '@seneve/organization-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { correlationIdFrom } from '../auth/providers/http-context.js';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  InvitationIdParamDto,
  LifecycleDto,
  MembershipIdParamDto,
  OrganizationIdParamDto,
  OwnershipTransferDto,
  UpdateMembershipRoleDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';
import { mapOrganizationError } from './mappers/organization-error.mapper.js';
import {
  invitationResponse,
  membershipResponse,
  organizationResponse,
} from './mappers/organization-response.mapper.js';
import {
  ORGANIZATION_APPLICATION_SERVICE,
  ORGANIZATION_NOTIFICATION_SINK,
} from './organization.tokens.js';
import type { OrganizationNotificationSink } from './providers/organization-notification-sink.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(
    @Inject(ORGANIZATION_APPLICATION_SERVICE)
    private readonly organizations: OrganizationApplicationService,
    @Inject(ORGANIZATION_NOTIFICATION_SINK)
    private readonly notifications: OrganizationNotificationSink,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an organization with the authenticated identity as owner.' })
  async create(@Body() body: CreateOrganizationDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.organizations.createOrganization({
        actorIdentityId: auth.identityId,
        displayName: body.displayName,
        slug: body.slug,
        defaultLocale: body.defaultLocale,
        timezone: body.timezone,
        correlationId,
      });

      return {
        organization: organizationResponse(result.organization),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Get()
  async list(@Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const organizations = await this.organizations.listOrganizations(auth.identityId);

      return {
        organizations: organizations.map(organizationResponse),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Get(':organizationId')
  async get(@Param() params: OrganizationIdParamDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.organizations.getOrganization({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        correlationId,
      });

      return {
        organization: organizationResponse(result.organization),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Patch(':organizationId')
  async update(
    @Param() params: OrganizationIdParamDto,
    @Body() body: UpdateOrganizationDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.organizations.updateProfile({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        expectedVersion: body.expectedVersion,
        displayName: body.displayName,
        slug: body.slug,
        defaultLocale: body.defaultLocale,
        timezone: body.timezone,
        correlationId,
      });

      return {
        organization: organizationResponse(result.organization),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Post(':organizationId/activate')
  async activate(
    @Param() params: OrganizationIdParamDto,
    @Body() body: LifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'activate');
  }

  @Post(':organizationId/suspend')
  async suspend(
    @Param() params: OrganizationIdParamDto,
    @Body() body: LifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'suspend');
  }

  @Post(':organizationId/reactivate')
  async reactivate(
    @Param() params: OrganizationIdParamDto,
    @Body() body: LifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'reactivate');
  }

  @Post(':organizationId/close')
  async close(
    @Param() params: OrganizationIdParamDto,
    @Body() body: LifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'close');
  }

  @Post(':organizationId/archive')
  async archive(
    @Param() params: OrganizationIdParamDto,
    @Body() body: LifecycleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.transition(params, body, request, 'archive');
  }

  private async transition(
    params: OrganizationIdParamDto,
    body: LifecycleDto,
    request: AuthenticatedHttpRequest,
    transition: 'activate' | 'suspend' | 'reactivate' | 'close' | 'archive',
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.organizations.transition(
        {
          actorIdentityId: auth.identityId,
          organizationId: params.organizationId,
          expectedVersion: body.expectedVersion,
          correlationId,
        },
        transition,
      );

      return {
        organization: organizationResponse(result.organization),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Get(':organizationId/memberships')
  async memberships(
    @Param() params: OrganizationIdParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const memberships = await this.organizations.listMemberships({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        correlationId,
      });

      return {
        memberships: memberships.map(membershipResponse),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Patch(':organizationId/memberships/:membershipId')
  async updateMembership(
    @Param() params: MembershipIdParamDto,
    @Body() body: UpdateMembershipRoleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      await this.organizations.updateMembershipRole({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        membershipId: params.membershipId,
        role: body.role,
        correlationId,
      });

      return { accepted: true, correlationId };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Post(':organizationId/memberships/:membershipId/suspend')
  async suspendMembership(
    @Param() params: MembershipIdParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      await this.organizations.suspendMembership({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        membershipId: params.membershipId,
        correlationId,
      });

      return { accepted: true, correlationId };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Delete(':organizationId/memberships/:membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMembership(
    @Param() params: MembershipIdParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      await this.organizations.removeMembership({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        membershipId: params.membershipId,
        correlationId,
      });
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Post(':organizationId/invitations')
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(
    @Param() params: OrganizationIdParamDto,
    @Body() body: CreateInvitationDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.organizations.createInvitation({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        recipientEmail: body.email,
        intendedRole: body.role,
        correlationId,
      });
      await this.notifications.invitationRequested(result.notification);

      return {
        invitation: invitationResponse(result.invitation),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Get(':organizationId/invitations')
  async listInvitations(
    @Param() params: OrganizationIdParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const invitations = await this.organizations.listInvitations({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        correlationId,
      });

      return {
        invitations: invitations.map(invitationResponse),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Post(':organizationId/invitations/:invitationId/revoke')
  async revokeInvitation(
    @Param() params: InvitationIdParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      await this.organizations.revokeInvitation({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        invitationId: params.invitationId,
        correlationId,
      });

      return { accepted: true, correlationId };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }

  @Post(':organizationId/ownership-transfer')
  async transferOwnership(
    @Param() params: OrganizationIdParamDto,
    @Body() body: OwnershipTransferDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      await this.organizations.transferOwnership({
        actorIdentityId: auth.identityId,
        organizationId: params.organizationId,
        currentOwnerMembershipId: body.currentOwnerMembershipId,
        targetMembershipId: body.targetMembershipId,
        previousOwnerRole: body.previousOwnerRole,
        correlationId,
      });

      return { accepted: true, correlationId };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }
}

@ApiTags('Invitations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('invitations')
export class InvitationAcceptanceController {
  constructor(
    @Inject(ORGANIZATION_APPLICATION_SERVICE)
    private readonly organizations: OrganizationApplicationService,
  ) {}

  @Post('accept')
  async accept(@Body() body: AcceptInvitationDto, @Req() request: AuthenticatedHttpRequest) {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    try {
      const result = await this.organizations.acceptInvitation({
        actorIdentityId: auth.identityId,
        tokenId: body.tokenId,
        rawInvitationToken: body.token,
        recipientEmail: body.recipientEmail,
        correlationId,
      });

      return {
        organization: organizationResponse(result.organization),
        correlationId,
      };
    } catch (error) {
      throw mapOrganizationError(error, correlationId);
    }
  }
}

function requireAuth(request: AuthenticatedHttpRequest, correlationId: string) {
  if (!request.auth) {
    throw new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required.',
      correlationId,
    });
  }

  return request.auth;
}
