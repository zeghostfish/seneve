import { argon2, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  GeneratedToken,
  PasswordHasher,
  TokenGenerator,
  TokenHasher,
} from '@seneve/identity-application';

const argon2Async = promisify(argon2);

export interface Argon2idPasswordHasherConfig {
  readonly memoryKiB: number;
  readonly passes: number;
  readonly parallelism: number;
  readonly tagLength: number;
  readonly saltLength: number;
  readonly dummyPassword: string;
}

export class NodeArgon2idPasswordHasher implements PasswordHasher {
  constructor(private readonly config: Argon2idPasswordHasherConfig = defaultArgon2idConfig) {}

  async hash(plaintext: string): Promise<string> {
    const salt = randomBytes(this.config.saltLength);
    const tag = await this.hashToBuffer(plaintext, salt);

    return [
      '$argon2id',
      'v=19',
      `m=${this.config.memoryKiB},t=${this.config.passes},p=${this.config.parallelism}`,
      salt.toString('base64url'),
      tag.toString('base64url'),
    ].join('$');
  }

  async verify(input: { plaintext: string; hash: string }): Promise<boolean> {
    const parsed = parseEncodedArgon2idHash(input.hash);
    const tag = await this.hashToBuffer(input.plaintext, parsed.salt, parsed);

    return tag.length === parsed.tag.length && timingSafeEqual(tag, parsed.tag);
  }

  async equivalentHash(): Promise<void> {
    await this.hash(this.config.dummyPassword);
  }

  private async hashToBuffer(
    plaintext: string,
    salt: Buffer,
    override: Partial<Argon2idPasswordHasherConfig> = {},
  ): Promise<Buffer> {
    return argon2Async('argon2id', {
      message: Buffer.from(plaintext, 'utf8'),
      nonce: salt,
      parallelism: override.parallelism ?? this.config.parallelism,
      tagLength: override.tagLength ?? this.config.tagLength,
      memory: override.memoryKiB ?? this.config.memoryKiB,
      passes: override.passes ?? this.config.passes,
    }) as Promise<Buffer>;
  }
}

export class NodeOpaqueTokenGenerator implements TokenGenerator {
  constructor(private readonly tokenBytes = 32) {}

  uuid(): string {
    return randomUUID();
  }

  opaqueToken(): GeneratedToken {
    return {
      tokenId: randomUUID(),
      rawToken: randomBytes(this.tokenBytes).toString('base64url'),
    };
  }
}

export class HmacSha256TokenHasher implements TokenHasher {
  constructor(private readonly secret: string) {}

  async hash(rawToken: string): Promise<string> {
    return `hmac-sha256:${createHmac('sha256', this.secret).update(rawToken, 'utf8').digest('base64url')}`;
  }
}

export interface HmacAccessTokenIssuerConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly secret: string;
}

export class HmacAccessTokenIssuer implements AccessTokenIssuer {
  constructor(private readonly config: HmacAccessTokenIssuerConfig) {}

  async issue(claims: AccessTokenClaims): Promise<string> {
    const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
    const payload = encodeJson({
      iss: this.config.issuer,
      aud: this.config.audience,
      sub: claims.sub,
      identity_id: claims.identityId,
      session_id: claims.sessionId,
      token_version: claims.tokenVersion,
      iat: Math.floor(claims.issuedAt.getTime() / 1000),
      exp: Math.floor(claims.expiresAt.getTime() / 1000),
    });
    const signature = createHmac('sha256', this.config.secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }
}

export const defaultArgon2idConfig: Argon2idPasswordHasherConfig = {
  memoryKiB: 65_536,
  passes: 3,
  parallelism: 1,
  tagLength: 32,
  saltLength: 16,
  dummyPassword: 'SeneveDummyPassword1!',
};

interface ParsedArgon2idHash extends Argon2idPasswordHasherConfig {
  readonly salt: Buffer;
  readonly tag: Buffer;
}

function parseEncodedArgon2idHash(hash: string): ParsedArgon2idHash {
  const parts = hash.split('$');

  if (parts.length !== 6 || parts[1] !== 'argon2id' || parts[2] !== 'v=19') {
    throw new Error('Unsupported password hash format.');
  }

  const parameters = Object.fromEntries(parts[3]!.split(',').map((pair) => pair.split('=')));
  const memoryKiB = Number.parseInt(parameters.m ?? '', 10);
  const passes = Number.parseInt(parameters.t ?? '', 10);
  const parallelism = Number.parseInt(parameters.p ?? '', 10);
  const salt = Buffer.from(parts[4]!, 'base64url');
  const tag = Buffer.from(parts[5]!, 'base64url');

  if (
    ![memoryKiB, passes, parallelism].every(Number.isInteger) ||
    salt.length === 0 ||
    tag.length === 0
  ) {
    throw new Error('Invalid password hash parameters.');
  }

  return {
    memoryKiB,
    passes,
    parallelism,
    tagLength: tag.length,
    saltLength: salt.length,
    dummyPassword: defaultArgon2idConfig.dummyPassword,
    salt,
    tag,
  };
}

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
