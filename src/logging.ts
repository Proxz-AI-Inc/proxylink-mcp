import type { ProxyLinkLogger } from './types.js';

export function logError(
  logger: ProxyLinkLogger | undefined,
  message: string,
  meta?: Record<string, unknown>,
): void {
  logger?.error?.(message, meta);
}
