// ─── nestjs-sdk-tools barrel re-export ───────────────────────────────────────

// Side-effect: patches neverthrow's .match() to accept exhaustive object handlers
import "./match-patch";

// Types & interfaces
export {
  type HttpErrorStatus,
  type ErrorCode,
  type ErrorIdentifier,
  type HttpExceptionConstructor,
  type ServiceError,
  type BadRequestError,
  type UnauthorizedError,
  type ForbiddenError,
  type NotFoundError,
  type MethodNotAllowedError,
  type NotAcceptableError,
  type RequestTimeoutError,
  type ConflictError,
  type GoneError,
  type PayloadTooLargeError,
  type UnsupportedMediaTypeError,
  type ImATeapotError,
  type UnprocessableEntityError,
  type TooManyRequestsError,
  type InternalServerError,
  type ServiceUnavailableError,
  type KnownServiceError,
  type ServiceErrorOf,
  type ServiceErrorUnion,
  type AppHttpResult,
  ERROR_CODE_STATUS_MAP,
  SDK_ERROR_MAPPER_TOKEN,
  type SdkErrorMapper,
} from "./types";

// Exhaustive match type (from patch)
export type { ExhaustiveErrorHandler } from "./match-patch";

// Maps & normalization
export {
  STATUS_TO_CODE_MAP,
  EXCEPTION_CLASS_CODE_MAP,
  ERROR_CODE_INTERFACE_MAP,
  normalizeToCode,
  codeToStatus,
} from "./maps";

// Error classes
export {
  ServiceException,
  BadRequestServiceError,
  UnauthorizedServiceError,
  ForbiddenServiceError,
  NotFoundServiceError,
  MethodNotAllowedServiceError,
  NotAcceptableServiceError,
  RequestTimeoutServiceError,
  ConflictServiceError,
  GoneServiceError,
  PayloadTooLargeServiceError,
  UnsupportedMediaTypeServiceError,
  ImATeapotServiceError,
  UnprocessableEntityServiceError,
  TooManyRequestsServiceError,
  InternalServerServiceError,
  ServiceUnavailableServiceError,
  customServiceError,
} from "./errors";

// Decorators
export {
  MapResult,
  type ErrorMapperFunction,
  type ErrorStatusMap,
} from "./decorators";

// Utils
export {
  parseServiceError,
  parseServiceErrorGeneric,
  matchError,
  assertNever,
  toServiceError,
} from "./utils";
