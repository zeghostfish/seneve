import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  PrismaIdentityRepository,
  PrismaIdentitySessionRepository,
  PrismaIdentityTokenRepository,
  PrismaIdentityUnitOfWork,
} from './index.js';

const shouldRunPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
const describePostgres = shouldRunPostgres ? describe : describe.skip;

const prisma = new PrismaClient();
const identities = new PrismaIdentityRepository(prisma);
const sessions = new PrismaIdentitySessionRepository(prisma);
const tokens = new PrismaIdentityTokenRepository(prisma);
const unitOfWork = new PrismaIdentityUnitOfWork(prisma);

const now = new Date('2026-07-14T00:00:00.000Z');
const later = new Date('2026-07-15T00:00:00.000Z');
const passwordHash = '$argon2id$v=19$m=65536,t=3,p=1$hash';
const refreshHash = 'hmac-sha256:abcdefghijklmnopqrstuvwxyz123456';
const nextRefreshHash = 'hmac-sha256:abcdefghijklmnopqrstuvwxyz654321';
const verificationHash = 'sha256:abcdefghijklmnopqrstuvwxyz123456';
const resetHash = 'sha256:abcdefghijklmnopqrstuvwxyz654321';

describePostgres('Prisma identity repositories', () => {
  beforeEach(async () => {
    await cleanupIdentityTables();
  });

  afterAll(async () => {
    await cleanupIdentityTables();
    await prisma.$disconnect();
  });

  it('persists and rehydrates an identity without plaintext credentials', async () => {
    await createRegisteredIdentity('11111111-1111-4111-8111-111111111111', 'ada@example.com');

    const identity = await identities.findByNormalizedLoginEmail('ada@example.com');

    expect(identity).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'PENDING_EMAIL_VERIFICATION',
      normalizedLoginEmail: 'ada@example.com',
      user: {
        displayName: 'Ada Lovelace',
      },
      primaryEmail: {
        normalizedEmail: 'ada@example.com',
        verifiedAt: null,
      },
      activeCredentials: [
        {
          type: 'PASSWORD',
          status: 'ACTIVE',
          secretHash: passwordHash,
        },
      ],
    });
    expect(identity?.activeCredentials[0]?.secretHash).not.toBe('CorrectHorseBatteryStaple!');
  });

  it('enforces normalized login email uniqueness among active identities', async () => {
    await createRegisteredIdentity('11111111-1111-4111-8111-111111111111', 'ada@example.com');

    await expect(
      createRegisteredIdentity('22222222-2222-4222-8222-222222222222', 'ada@example.com'),
    ).rejects.toThrow();
  });

  it('creates a session, rotates a refresh token, and revokes the family on replay', async () => {
    await createRegisteredIdentity('11111111-1111-4111-8111-111111111111', 'ada@example.com');
    await sessions.createSessionWithRefreshToken({
      sessionId: '33333333-3333-4333-8333-333333333333',
      identityId: '11111111-1111-4111-8111-111111111111',
      refreshTokenId: '44444444-4444-4444-8444-444444444444',
      refreshTokenFamilyId: '55555555-5555-4555-8555-555555555555',
      refreshTokenHash: refreshHash,
      issuedAt: now,
      sessionExpiresAt: new Date('2026-08-14T00:00:00.000Z'),
      refreshTokenExpiresAt: later,
    });

    await expect(
      sessions.rotateRefreshToken({
        currentRefreshTokenId: '44444444-4444-4444-8444-444444444444',
        currentRefreshTokenHash: refreshHash,
        nextRefreshTokenId: '66666666-6666-4666-8666-666666666666',
        nextRefreshTokenHash: nextRefreshHash,
        rotatedAt: new Date('2026-07-14T01:00:00.000Z'),
        nextRefreshTokenExpiresAt: later,
      }),
    ).resolves.toMatchObject({ outcome: 'ROTATED' });

    await expect(
      sessions.rotateRefreshToken({
        currentRefreshTokenId: '44444444-4444-4444-8444-444444444444',
        currentRefreshTokenHash: refreshHash,
        nextRefreshTokenId: '77777777-7777-4777-8777-777777777777',
        nextRefreshTokenHash: 'hmac-sha256:abcdefghijklmnopqrstuvwxyz000000',
        rotatedAt: new Date('2026-07-14T02:00:00.000Z'),
        nextRefreshTokenExpiresAt: later,
      }),
    ).resolves.toMatchObject({ outcome: 'REUSED' });

    const storedSession = await prisma.session.findUniqueOrThrow({
      where: { id: '33333333-3333-4333-8333-333333333333' },
    });
    const storedTokens = await prisma.refreshToken.findMany({
      where: { familyId: '55555555-5555-4555-8555-555555555555' },
    });

    expect(storedSession.status).toBe('REVOKED');
    expect(storedTokens.every((token) => token.status === 'REVOKED')).toBe(true);
  });

  it('consumes email-verification and password-reset tokens only once', async () => {
    await createRegisteredIdentity('11111111-1111-4111-8111-111111111111', 'ada@example.com');
    await tokens.createEmailVerificationToken({
      id: '22222222-2222-4222-8222-222222222222',
      identityId: '11111111-1111-4111-8111-111111111111',
      tokenId: '33333333-3333-4333-8333-333333333333',
      tokenHash: verificationHash,
      createdAt: now,
      expiresAt: later,
    });
    await tokens.createPasswordResetToken({
      id: '44444444-4444-4444-8444-444444444444',
      identityId: '11111111-1111-4111-8111-111111111111',
      tokenId: '55555555-5555-4555-8555-555555555555',
      tokenHash: resetHash,
      createdAt: now,
      expiresAt: later,
    });

    await expect(
      tokens.consumeEmailVerificationToken({
        tokenId: '33333333-3333-4333-8333-333333333333',
        tokenHash: verificationHash,
        consumedAt: new Date('2026-07-14T01:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'CONSUMED' });
    await expect(
      tokens.consumeEmailVerificationToken({
        tokenId: '33333333-3333-4333-8333-333333333333',
        tokenHash: verificationHash,
        consumedAt: new Date('2026-07-14T02:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'ALREADY_CONSUMED_OR_REVOKED' });

    await expect(
      tokens.consumePasswordResetToken({
        tokenId: '55555555-5555-4555-8555-555555555555',
        tokenHash: resetHash,
        consumedAt: new Date('2026-07-14T01:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'CONSUMED' });
    await expect(
      tokens.consumePasswordResetToken({
        tokenId: '55555555-5555-4555-8555-555555555555',
        tokenHash: resetHash,
        consumedAt: new Date('2026-07-14T02:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ outcome: 'ALREADY_CONSUMED_OR_REVOKED' });
  });

  it('revokes active sessions when identity is suspended', async () => {
    await createRegisteredIdentity('11111111-1111-4111-8111-111111111111', 'ada@example.com');
    await sessions.createSessionWithRefreshToken({
      sessionId: '33333333-3333-4333-8333-333333333333',
      identityId: '11111111-1111-4111-8111-111111111111',
      refreshTokenId: '44444444-4444-4444-8444-444444444444',
      refreshTokenFamilyId: '55555555-5555-4555-8555-555555555555',
      refreshTokenHash: refreshHash,
      issuedAt: now,
      sessionExpiresAt: new Date('2026-08-14T00:00:00.000Z'),
      refreshTokenExpiresAt: later,
    });

    await expect(
      identities.suspendIdentityAndRevokeSessions(
        '11111111-1111-4111-8111-111111111111',
        new Date('2026-07-14T03:00:00.000Z'),
      ),
    ).resolves.toBe(true);

    await expect(
      prisma.session.findUniqueOrThrow({ where: { id: '33333333-3333-4333-8333-333333333333' } }),
    ).resolves.toMatchObject({
      status: 'REVOKED',
    });
  });

  it('rolls back a unit-of-work transaction on failure', async () => {
    await expect(
      unitOfWork.transaction(async (repositories) => {
        await repositories.identities.createRegisteredIdentity(
          registrationInput('11111111-1111-4111-8111-111111111111', 'ada@example.com'),
        );
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(identities.findById('11111111-1111-4111-8111-111111111111')).resolves.toBeNull();
  });
});

function registrationInput(identityId: string, normalizedEmail: string) {
  const suffix = identityId.slice(0, 8);

  return {
    identityId,
    userId: `${suffix}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    displayName: 'Ada Lovelace',
    emailId: `${suffix}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
    email: normalizedEmail,
    normalizedEmail,
    passwordCredentialId: `${suffix}-cccc-4ccc-8ccc-cccccccccccc`,
    passwordHash,
    createdAt: now,
  };
}

async function createRegisteredIdentity(
  identityId: string,
  normalizedEmail: string,
): Promise<void> {
  await identities.createRegisteredIdentity(registrationInput(identityId, normalizedEmail));
}

async function cleanupIdentityTables(): Promise<void> {
  await prisma.identitySecurityEvent.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.identityEmail.deleteMany();
  await prisma.user.deleteMany();
  await prisma.identity.deleteMany();
}
