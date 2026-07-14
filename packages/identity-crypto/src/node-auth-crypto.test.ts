import { describe, expect, it } from 'vitest';

import {
  HmacAccessTokenIssuer,
  HmacSha256TokenHasher,
  NodeArgon2idPasswordHasher,
} from './index.js';

describe('Node identity crypto adapters', () => {
  it('hashes and verifies passwords with encoded Argon2id parameters', async () => {
    const hasher = new NodeArgon2idPasswordHasher({
      memoryKiB: 1024,
      passes: 1,
      parallelism: 1,
      tagLength: 16,
      saltLength: 16,
      dummyPassword: 'DummyPassword1!',
    });

    const hash = await hasher.hash('CorrectHorse1!');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=1024,t=1,p=1\$/);
    await expect(hasher.verify({ plaintext: 'CorrectHorse1!', hash })).resolves.toBe(true);
    await expect(hasher.verify({ plaintext: 'WrongHorse1!', hash })).resolves.toBe(false);
  });

  it('hashes raw tokens without returning the raw token value', async () => {
    const hasher = new HmacSha256TokenHasher('server-secret');

    await expect(hasher.hash('raw-token')).resolves.toMatch(/^hmac-sha256:/);
    await expect(hasher.hash('raw-token')).resolves.not.toBe('raw-token');
  });

  it('issues minimal signed access tokens without role or permission claims', async () => {
    const issuer = new HmacAccessTokenIssuer({
      issuer: 'seneve',
      audience: 'seneve-web',
      secret: 'server-secret',
    });

    const token = await issuer.issue({
      sub: 'identity-1',
      identityId: 'identity-1',
      sessionId: 'session-1',
      tokenVersion: 1,
      issuedAt: new Date('2026-07-14T00:00:00.000Z'),
      expiresAt: new Date('2026-07-14T00:15:00.000Z'),
    });
    const [, encodedPayload] = token.split('.');
    const payload = JSON.parse(
      Buffer.from(encodedPayload!, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(payload).toMatchObject({
      sub: 'identity-1',
      identity_id: 'identity-1',
      session_id: 'session-1',
      token_version: 1,
    });
    expect(payload).not.toHaveProperty('roles');
    expect(payload).not.toHaveProperty('permissions');
  });
});
