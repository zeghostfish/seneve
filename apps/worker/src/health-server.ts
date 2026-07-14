import { createServer, type Server } from 'node:http';

import type { HealthResponse } from '@seneve/shared';

export function createHealthServer(service: string): Server {
  return createServer((_, response) => {
    const body: HealthResponse = {
      status: 'ok',
      service,
      timestamp: new Date().toISOString(),
    };

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  });
}
