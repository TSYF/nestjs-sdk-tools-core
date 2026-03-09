import { HttpException } from "@nestjs/common";
import { type ErrorCode, ERROR_CODE_STATUS_MAP } from "./types";

// ─── ServiceException — base throwable error with `code` ─────────────────────

/**
 * Base exception class that carries a `code` field.
 * The code can be a known ErrorCode or a custom string tag.
 */
export class ServiceException extends HttpException {
  public readonly code: string;

  constructor(
    code: string,
    status: number,
    message: string,
    provider?: string,
  ) {
    super({ code, status, message, provider: provider ?? undefined }, status);
    this.code = code;
  }
}

// ─── Concrete ServiceError classes (one per known ErrorCode) ─────────────────

export class BadRequestServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("BAD_REQUEST", 400, message, provider);
  }
}
export class UnauthorizedServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("UNAUTHORIZED", 401, message, provider);
  }
}
export class ForbiddenServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("FORBIDDEN", 403, message, provider);
  }
}
export class NotFoundServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("NOT_FOUND", 404, message, provider);
  }
}
export class MethodNotAllowedServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("METHOD_NOT_ALLOWED", 405, message, provider);
  }
}
export class NotAcceptableServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("NOT_ACCEPTABLE", 406, message, provider);
  }
}
export class RequestTimeoutServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("REQUEST_TIMEOUT", 408, message, provider);
  }
}
export class ConflictServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("CONFLICT", 409, message, provider);
  }
}
export class GoneServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("GONE", 410, message, provider);
  }
}
export class PayloadTooLargeServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("PAYLOAD_TOO_LARGE", 413, message, provider);
  }
}
export class UnsupportedMediaTypeServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("UNSUPPORTED_MEDIA_TYPE", 415, message, provider);
  }
}
export class ImATeapotServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("I_AM_A_TEAPOT", 418, message, provider);
  }
}
export class UnprocessableEntityServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("UNPROCESSABLE_ENTITY", 422, message, provider);
  }
}
export class TooManyRequestsServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("TOO_MANY_REQUESTS", 429, message, provider);
  }
}
export class InternalServerServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("INTERNAL_SERVER_ERROR", 500, message, provider);
  }
}
export class ServiceUnavailableServiceError extends ServiceException {
  constructor(message: string, provider?: string) {
    super("SERVICE_UNAVAILABLE", 503, message, provider);
  }
}

/**
 * Factory: create a ServiceException for a custom tag that doesn't have
 * a dedicated class. Requires an explicit status code.
 *
 * @example
 * throw customServiceError('DATABASE_UNAVAILABLE', 503, 'DB is down');
 */
export function customServiceError(
  code: string,
  status: number,
  message: string,
  provider?: string,
): ServiceException {
  return new ServiceException(code, status, message, provider);
}
