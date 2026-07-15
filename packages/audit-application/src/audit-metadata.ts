import { AuditDomainError } from '@seneve/domain-audit';

const forbiddenKeyFragments = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'credential',
  'apiKey',
  'card',
];

export function sanitizeAuditMetadata(
  metadata: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return sanitizeObject(metadata);
}

function sanitizeObject(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();

    if (forbiddenKeyFragments.some((fragment) => normalizedKey.includes(fragment.toLowerCase()))) {
      output[key] = '[REDACTED]';
      continue;
    }

    output[key] = sanitizeValue(value);
  }

  return output;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    if (value.length > 1000) {
      throw new AuditDomainError('AUDIT_METADATA_UNSAFE', 'Audit metadata value is too large.');
    }

    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return String(value);
}
