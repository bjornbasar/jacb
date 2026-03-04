import 'dotenv/config';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

import { validateEnvVars } from './lib/utils.js';
import telegramRoutes from './channels/telegram.js';
import messengerRoutes from './channels/messenger.js';

try {
    validateEnvVars();
    console.log('✅ Environment variables validated');
} catch (err) {
    console.error('❌ Environment validation failed:', err.message);
    process.exit(1);
}

const fastify = Fastify({ logger: true });

await fastify.register(rateLimit, { global: false });

await fastify.register(telegramRoutes);
await fastify.register(messengerRoutes);

fastify.get('/', async (_request, reply) => {
    return reply.send({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Bot server running on port ${PORT}`);
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}
