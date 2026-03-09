import { type ServiceError } from "../types";

/**
 * Exhaustive pattern matching on a ServiceError's `code` field.
 * TypeScript enforces that all variants of the union must have a handler.
 *
 * @example
 * matchError(error, {
 *   NOT_FOUND: (e) => `Not found: ${e.message}`,
 *   BAD_REQUEST: (e) => `Bad request: ${e.message}`,
 * });
 *
 * @example
 * // Works with custom tags too:
 * matchError(error, {
 *   NOT_FOUND: (e) => handleNotFound(e),
 *   DATABASE_UNAVAILABLE: (e) => retryLater(e),
 * });
 */
export function matchError<E extends ServiceError, R>(
  error: E,
  handlers: { [K in E["code"]]: (e: Extract<E, { code: K }>) => R },
): R {
  const handler = (handlers as Record<string, (e: any) => R>)[error.code];
  if (!handler) {
    throw new Error(`Unhandled error code: ${error.code}`);
  }
  return handler(error);
}

/**
 * Use in the `default:` branch of a switch-case for exhaustiveness checks.
 * If TypeScript doesn't narrow the type to `never`, you have a missing case.
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}
