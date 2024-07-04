import { Histogram } from 'prom-client';
import { PrometheusDriver } from 'prometheus-query';
import { prisma } from './prisma.js';

const queriesHistogram = new Histogram({
  name: 'query_duration_ms',
  help: 'Duration of queries',
  labelNames: ['query_type', 'oauth_client', 'user_id', 'query_name', 'operation_name'],
  buckets: [1, 5, 10, 30, 50, 100, 200, 500, 1000],
});

const rateLimitsHistogram = new Histogram({
  name: 'rate_limit_hit_penalty_ms',
  help: 'Duration of rate limit hits (time before trying again)',
  labelNames: ['query_type', 'oauth_client', 'user_id', 'query_name', 'operation_name'],
  buckets: [1, 5, 10, 30, 50, 100, 200, 500, 1000],
});

const createdTokens = new Histogram({
  name: 'tokens_created',
  help: 'Number of created tokens',
  labelNames: ['oauth_client', 'user_id', 'oauth_client_name'],
  buckets: [1, 5, 10, 30, 50, 100, 200, 500, 1000],
});

export async function updateQueryUsage({
  duration,
  queryName,
  queryType,
  token,
  user,
  operationName,
}: {
  queryType: string;
  queryName: string;
  token?: string;
  user?: string;
  duration: number;
  operationName?: string;
}) {
  const app = token
    ? await prisma.thirdPartyCredential.findFirst({
        where: { value: token },
      })
    : undefined;

  queriesHistogram
    .labels({
      operation_name: operationName ?? '',
      query_name: queryName,
      query_type: queryType,
      oauth_client: app?.clientId ?? '',
      user_id: user ?? '',
    })
    .observe(duration);
}

export async function updateRateLimitHit({
  token,
  queryName,
  queryType,
  user,
  tryAgainInMs,
  operationName,
}: {
  queryType: string;
  queryName: string;
  token?: string;
  user?: string;
  tryAgainInMs: number;
  operationName?: string;
}) {
  const app = token
    ? await prisma.thirdPartyCredential.findFirst({ where: { value: token } })
    : undefined;

  rateLimitsHistogram
    .labels({
      query_name: queryName,
      query_type: queryType,
      oauth_client: app?.clientId ?? '',
      user_id: user ?? '',
      operation_name: operationName ?? '',
    })
    .observe(tryAgainInMs);
}

export async function updateCreatedTokensCount({ token, user }: { token: string; user: string }) {
  const tok = await prisma.thirdPartyCredential.findFirst({
    where: { value: token },
    include: { client: true },
  });

  createdTokens
    .labels({
      oauth_client: tok?.clientId ?? '',
      oauth_client_name: tok?.client.name ?? '',
      user_id: user,
    })
    .observe(1);
}

export const prometheusClient = new PrometheusDriver({
  endpoint: process.env.PROMETHEUS_URL || 'http://localhost:9090',
  baseURL: '/api/v1',
});
