import { ok, err, ResultAsync } from "neverthrow";
import type { ServiceError } from "./types";

// ─── Exhaustive Error Handler Type ───────────────────────────────────────────

/**
 * An object where each key is a literal `code` from the error union E,
 * and each value is a handler receiving the narrowed error type for that code.
 * TypeScript enforces that ALL codes in E must have a handler (exhaustive).
 *
 * @example
 * // When E = NotFoundError | BadRequestError:
 * result.match(
 *   (value) => handleSuccess(value),
 *   {
 *     NOT_FOUND: (e) => handleNotFound(e),
 *     BAD_REQUEST: (e) => handleBadRequest(e),
 *   },
 * );
 */
export type ExhaustiveErrorHandler<E extends ServiceError, A> = {
  [K in E["code"]]: (e: Extract<E, { code: K }>) => A;
};

// ─── Module Augmentation ─────────────────────────────────────────────────────
// Adds an overloaded `.match()` that accepts an exhaustive object handler
// when E extends ServiceError. The original callback form remains available.
// [E] extends [ServiceError] prevents distributive conditional behavior on unions.

declare module "neverthrow" {
  interface Ok<T, E> {
    match<A>(
      ok: (val: T) => A,
      err: [E] extends [ServiceError] ? ExhaustiveErrorHandler<E, A> : never,
    ): A;
  }

  interface Err<T, E> {
    match<A>(
      ok: (val: T) => A,
      err: [E] extends [ServiceError] ? ExhaustiveErrorHandler<E, A> : never,
    ): A;
  }

  interface ResultAsync<T, E> {
    match<A>(
      ok: (val: T) => A,
      err: [E] extends [ServiceError] ? ExhaustiveErrorHandler<E, A> : never,
    ): Promise<A>;
  }
}

// ─── Runtime Patch ───────────────────────────────────────────────────────────
// Patches Err.prototype.match and ResultAsync.prototype.match to detect
// when the err argument is an object (exhaustive handler map) and route
// to the correct handler based on error.code.
//
// This is idempotent — a Symbol guard prevents double-patching if the
// module is loaded multiple times.

const PATCHED = Symbol.for("nestjs-sdk-tools:match-patched");

function wrapObjectHandler(errHandler: any): (error: any) => any {
  if (typeof errHandler === "object" && errHandler !== null) {
    return (error: any) => {
      const code = error?.code;
      const handler = errHandler[code];
      if (!handler) {
        throw new Error(
          `Unhandled error code: "${code}". Expected one of: ${Object.keys(errHandler).join(", ")}`,
        );
      }
      return handler(error);
    };
  }
  return errHandler;
}

// Patch Err.prototype.match
const ErrProto = Object.getPrototypeOf(err(undefined));
if (!ErrProto[PATCHED]) {
  const originalErrMatch = ErrProto.match;
  ErrProto.match = function (okFn: any, errFn: any) {
    return originalErrMatch.call(this, okFn, wrapObjectHandler(errFn));
  };
  ErrProto[PATCHED] = true;
}

// Patch ResultAsync.prototype.match
if (!(ResultAsync.prototype as any)[PATCHED]) {
  const originalResultAsyncMatch = ResultAsync.prototype.match;
  (ResultAsync.prototype as any).match = function (okFn: any, errFn: any) {
    return originalResultAsyncMatch.call(this, okFn, wrapObjectHandler(errFn));
  };
  (ResultAsync.prototype as any)[PATCHED] = true;
}
