import { HttpException, HttpStatus } from "@nestjs/common";

// ─── HttpErrorStatus — extract only 4xx/5xx numeric status codes ─────────────

/**
 * Conditional type that filters HttpStatus to only error status codes (4xx/5xx).
 * This is used to allow `@Errors(HttpStatus.NOT_FOUND)` alongside string codes.
 */
export type HttpErrorStatus = HttpStatus extends infer Status
  ? Status extends number
    ? `${Status}` extends `4${string}` | `5${string}`
      ? Status
      : never
    : never
  : never;

// ─── Error Code ↔ Status Mapping ──────────────────────────────────────────────

export const ERROR_CODE_STATUS_MAP = {
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  METHOD_NOT_ALLOWED: HttpStatus.METHOD_NOT_ALLOWED,
  NOT_ACCEPTABLE: HttpStatus.NOT_ACCEPTABLE,
  REQUEST_TIMEOUT: HttpStatus.REQUEST_TIMEOUT,
  CONFLICT: HttpStatus.CONFLICT,
  GONE: HttpStatus.GONE,
  PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  I_AM_A_TEAPOT: HttpStatus.I_AM_A_TEAPOT,
  UNPROCESSABLE_ENTITY: HttpStatus.UNPROCESSABLE_ENTITY,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_SERVER_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
} as const;

/**
 * Known error code string literals (keys of ERROR_CODE_STATUS_MAP).
 */
export type ErrorCode = keyof typeof ERROR_CODE_STATUS_MAP;

// ─── ErrorIdentifier — flexible input type for @Errors / @MapResult ──────────

/**
 * Type for NestJS exception class constructors.
 * Matches classes like NotFoundException, ConflictException, etc.
 */
export type HttpExceptionConstructor = new (...args: any[]) => HttpException;

/**
 * Any valid way to declare an error:
 * - ErrorCode string: 'NOT_FOUND', 'BAD_REQUEST', 'DATABASE_UNAVAILABLE' (custom tag)
 * - HttpStatus number: HttpStatus.NOT_FOUND (404), HttpStatus.CONFLICT (409)
 * - Exception class: NotFoundException, ConflictException
 */
export type ErrorIdentifier =
  | string // ErrorCode known codes + custom tags (e.g. 'DATABASE_UNAVAILABLE')
  | HttpErrorStatus // Numeric status codes (4xx/5xx)
  | HttpExceptionConstructor; // NestJS exception class constructors

// ─── ServiceError Interface (discriminant = `code`) ──────────────────────────

export interface ServiceError {
  code: string;
  status: number;
  message: string;
  provider?: string;
  response?: unknown;
}

// ─── Concrete Error Interfaces (one per known code, literal code + status) ───

export interface BadRequestError extends ServiceError {
  code: "BAD_REQUEST";
  status: 400;
}
export interface UnauthorizedError extends ServiceError {
  code: "UNAUTHORIZED";
  status: 401;
}
export interface ForbiddenError extends ServiceError {
  code: "FORBIDDEN";
  status: 403;
}
export interface NotFoundError extends ServiceError {
  code: "NOT_FOUND";
  status: 404;
}
export interface MethodNotAllowedError extends ServiceError {
  code: "METHOD_NOT_ALLOWED";
  status: 405;
}
export interface NotAcceptableError extends ServiceError {
  code: "NOT_ACCEPTABLE";
  status: 406;
}
export interface RequestTimeoutError extends ServiceError {
  code: "REQUEST_TIMEOUT";
  status: 408;
}
export interface ConflictError extends ServiceError {
  code: "CONFLICT";
  status: 409;
}
export interface GoneError extends ServiceError {
  code: "GONE";
  status: 410;
}
export interface PayloadTooLargeError extends ServiceError {
  code: "PAYLOAD_TOO_LARGE";
  status: 413;
}
export interface UnsupportedMediaTypeError extends ServiceError {
  code: "UNSUPPORTED_MEDIA_TYPE";
  status: 415;
}
export interface ImATeapotError extends ServiceError {
  code: "I_AM_A_TEAPOT";
  status: 418;
}
export interface UnprocessableEntityError extends ServiceError {
  code: "UNPROCESSABLE_ENTITY";
  status: 422;
}
export interface TooManyRequestsError extends ServiceError {
  code: "TOO_MANY_REQUESTS";
  status: 429;
}
export interface InternalServerError extends ServiceError {
  code: "INTERNAL_SERVER_ERROR";
  status: 500;
}
export interface ServiceUnavailableError extends ServiceError {
  code: "SERVICE_UNAVAILABLE";
  status: 503;
}

/**
 * Union of all known error interfaces for exhaustive matching.
 */
export type KnownServiceError =
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | MethodNotAllowedError
  | NotAcceptableError
  | RequestTimeoutError
  | ConflictError
  | GoneError
  | PayloadTooLargeError
  | UnsupportedMediaTypeError
  | ImATeapotError
  | UnprocessableEntityError
  | TooManyRequestsError
  | InternalServerError
  | ServiceUnavailableError;

/**
 * Maps an ErrorCode string to its concrete error interface.
 * e.g. ServiceErrorOf<'NOT_FOUND'> = NotFoundError
 */
export type ServiceErrorOf<C extends ErrorCode> = Extract<
  KnownServiceError,
  { code: C }
>;

/**
 * Maps a tuple of ErrorCode strings to a union of their concrete error interfaces.
 * e.g. ServiceErrorUnion<['NOT_FOUND', 'BAD_REQUEST']> = NotFoundError | BadRequestError
 */
export type ServiceErrorUnion<T extends readonly ErrorCode[]> = ServiceErrorOf<
  T[number]
>;

/**
 * A ResultAsync with ServiceError on the error side.
 * Generic E defaults to ServiceError (untyped) for backward compat.
 */
export type AppHttpResult<
  T = Record<string, unknown>,
  E extends ServiceError = ServiceError,
> = import("neverthrow").ResultAsync<T, E>;
