import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

/**
 * Per-request context propagated through the call stack via AsyncLocalStorage.
 * Lets loggers, repositories, and services access requestId without threading
 * it through every function signature.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
