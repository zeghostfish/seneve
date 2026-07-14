import { loadFoundationConfig } from '@seneve/config';
import { createStructuredLogEntry } from '@seneve/shared';

import { createHealthServer } from './health-server.js';

const config = loadFoundationConfig();
const server = createHealthServer('seneve-worker');

server.listen(config.workerHealthPort);

console.log(
  JSON.stringify(
    createStructuredLogEntry({
      level: 'info',
      message: 'Worker service started',
      service: 'seneve-worker',
      context: { port: config.workerHealthPort },
    }),
  ),
);
