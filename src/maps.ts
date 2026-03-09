import {
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  NotAcceptableException,
  RequestTimeoutException,
  ConflictException,
  GoneException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  ImATeapotException,
  UnprocessableEntityException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type ErrorCode,
  type ErrorIdentifier,
  type HttpExceptionConstructor,
  ERROR_CODE_STATUS_MAP,
} from "./types";

// ─── Status → Code reverse map ──────────────────────────────────────────────

export const STATUS_TO_CODE_MAP: Record<number, ErrorCode> = Object.fromEntries(
  Object.entries(ERROR_CODE_STATUS_MAP).map(([code, status]) => [
    status,
    code as ErrorCode,
  ]),
) as Record<number, ErrorCode>;

// ─── Exception Class → Code map ─────────────────────────────────────────────

/**
 * Maps NestJS built-in exception class names to their ErrorCode.
 * Used by normalizeToCode() and the SDK generator to resolve
 * `@Errors(NotFoundException)` → 'NOT_FOUND'.
 */
export const EXCEPTION_CLASS_CODE_MAP: Record<string, ErrorCode> = {
  BadRequestException: "BAD_REQUEST",
  UnauthorizedException: "UNAUTHORIZED",
  ForbiddenException: "FORBIDDEN",
  NotFoundException: "NOT_FOUND",
  MethodNotAllowedException: "METHOD_NOT_ALLOWED",
  NotAcceptableException: "NOT_ACCEPTABLE",
  RequestTimeoutException: "REQUEST_TIMEOUT",
  ConflictException: "CONFLICT",
  GoneException: "GONE",
  PayloadTooLargeException: "PAYLOAD_TOO_LARGE",
  UnsupportedMediaTypeException: "UNSUPPORTED_MEDIA_TYPE",
  ImATeapotException: "I_AM_A_TEAPOT",
  UnprocessableEntityException: "UNPROCESSABLE_ENTITY",
  // NestJS doesn't have a TooManyRequestsException OOTB, but we include the mapping
  InternalServerErrorException: "INTERNAL_SERVER_ERROR",
  ServiceUnavailableException: "SERVICE_UNAVAILABLE",
};

/**
 * Maps NestJS built-in exception class constructors to their ErrorCode.
 * Used at runtime by normalizeToCode() when given an exception class reference.
 */
const EXCEPTION_CONSTRUCTOR_CODE_MAP = new Map<
  HttpExceptionConstructor,
  ErrorCode
>([
  [BadRequestException, "BAD_REQUEST"],
  [UnauthorizedException, "UNAUTHORIZED"],
  [ForbiddenException, "FORBIDDEN"],
  [NotFoundException, "NOT_FOUND"],
  [MethodNotAllowedException, "METHOD_NOT_ALLOWED"],
  [NotAcceptableException, "NOT_ACCEPTABLE"],
  [RequestTimeoutException, "REQUEST_TIMEOUT"],
  [ConflictException, "CONFLICT"],
  [GoneException, "GONE"],
  [PayloadTooLargeException, "PAYLOAD_TOO_LARGE"],
  [UnsupportedMediaTypeException, "UNSUPPORTED_MEDIA_TYPE"],
  [ImATeapotException, "I_AM_A_TEAPOT"],
  [UnprocessableEntityException, "UNPROCESSABLE_ENTITY"],
  [InternalServerErrorException, "INTERNAL_SERVER_ERROR"],
  [ServiceUnavailableException, "SERVICE_UNAVAILABLE"],
]);

// ─── Error Code → Interface Name map (used by SDK generator) ────────────────

export const ERROR_CODE_INTERFACE_MAP: Record<ErrorCode, string> = {
  BAD_REQUEST: "BadRequestError",
  UNAUTHORIZED: "UnauthorizedError",
  FORBIDDEN: "ForbiddenError",
  NOT_FOUND: "NotFoundError",
  METHOD_NOT_ALLOWED: "MethodNotAllowedError",
  NOT_ACCEPTABLE: "NotAcceptableError",
  REQUEST_TIMEOUT: "RequestTimeoutError",
  CONFLICT: "ConflictError",
  GONE: "GoneError",
  PAYLOAD_TOO_LARGE: "PayloadTooLargeError",
  UNSUPPORTED_MEDIA_TYPE: "UnsupportedMediaTypeError",
  I_AM_A_TEAPOT: "ImATeapotError",
  UNPROCESSABLE_ENTITY: "UnprocessableEntityError",
  TOO_MANY_REQUESTS: "TooManyRequestsError",
  INTERNAL_SERVER_ERROR: "InternalServerError",
  SERVICE_UNAVAILABLE: "ServiceUnavailableError",
};

// ─── normalizeToCode — converts any ErrorIdentifier to a code string ────────

/**
 * Converts any ErrorIdentifier (string code, HttpStatus number, exception class)
 * into a normalized error code string.
 *
 * @example
 * normalizeToCode('NOT_FOUND')           // 'NOT_FOUND'
 * normalizeToCode(HttpStatus.NOT_FOUND)  // 'NOT_FOUND'
 * normalizeToCode(NotFoundException)      // 'NOT_FOUND'
 * normalizeToCode('DATABASE_UNAVAILABLE') // 'DATABASE_UNAVAILABLE' (custom tag, pass-through)
 */
export function normalizeToCode(identifier: ErrorIdentifier): string {
  // String code — either a known ErrorCode or a custom tag
  if (typeof identifier === "string") {
    return identifier;
  }

  // Numeric HttpStatus — look up in reverse map
  if (typeof identifier === "number") {
    const code = STATUS_TO_CODE_MAP[identifier];
    if (code) return code;
    // Unknown numeric status → no known code mapping
    throw new Error(
      `Unknown HTTP status code: ${identifier}. Must be a known 4xx/5xx status.`,
    );
  }

  // Exception class constructor — look up in constructor map
  if (typeof identifier === "function") {
    const code = EXCEPTION_CONSTRUCTOR_CODE_MAP.get(
      identifier as HttpExceptionConstructor,
    );
    if (code) return code;

    // Try to resolve unknown exception classes by instantiating and reading status
    try {
      const instance = new (identifier as HttpExceptionConstructor)("");
      const status = instance.getStatus();
      const mappedCode = STATUS_TO_CODE_MAP[status];
      if (mappedCode) return mappedCode;
    } catch {}

    throw new Error(
      `Unknown exception class: ${identifier.name}. Consider mapping it or using its status code.`,
    );
  }

  throw new Error(`Invalid ErrorIdentifier: ${String(identifier)}`);
}

/**
 * Resolves the HTTP status for a given error code string.
 * Known codes use the ERROR_CODE_STATUS_MAP; custom tags return undefined.
 */
export function codeToStatus(code: string): number | undefined {
  return (ERROR_CODE_STATUS_MAP as Record<string, number>)[code];
}
