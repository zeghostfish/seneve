import { loadFoundationConfig } from '@seneve/config';

import { createHealthServer } from './health-server.js';

const config = loadFoundationConfig();
const server = createHealthServer('seneve-worker');

server.listen(config.workerHealthPort);
