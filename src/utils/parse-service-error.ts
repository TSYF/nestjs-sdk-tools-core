import { HttpException } from "@nestjs/common";
import {
  type ServiceError,
  type ErrorCode,
  type ServiceErrorOf,
  ERROR_CODE_STATUS_MAP,
} from "../types";
import { STATUS_TO_CODE_MAP } from "../maps";

/**
 * Converts an HttpException into a typed ServiceError.
 * If the exception was thrown by a ServiceException, uses its `code` directly.
 * Otherwise, maps the HTTP status → ErrorCode.
 *
 * For known ErrorCode strings, returns a strongly typed ServiceErrorOf<C>.
 * For custom tags, returns a ServiceError with the custom code string.
 */
export function parseServiceError<C extends ErrorCode>(
  error: HttpException,
  _allowedCodes: readonly C[],
): ServiceErrorOf<C> {
  const status = error.getStatus?.() ?? 500;
  const rawResponse = error.getResponse?.();

  const responseObj =
    typeof rawResponse === "object" && rawResponse !== null
      ? (rawResponse as Record<string, unknown>)
      : {
          message:
            typeof rawResponse === "string" ? rawResponse : "Unknown error",
        };

  // Prefer the code from the response body (set by ServiceException)
  const code: string =
    typeof responseObj.code === "string"
      ? responseObj.code
      : (STATUS_TO_CODE_MAP[status] ?? "INTERNAL_SERVER_ERROR");

  const resolvedStatus =
    (ERROR_CODE_STATUS_MAP as Record<string, number>)[code] ?? status;

  return {
    code,
    status: resolvedStatus,
    message: (responseObj.message as string) ?? "Unknown error",
    provider: responseObj.provider as string | undefined,
    response: responseObj.response ?? responseObj,
  } as ServiceErrorOf<C>;
}

/**
 * Like parseServiceError but returns a generic ServiceError (not typed to known codes).
 * Useful when the error might be a custom tag not in the known ErrorCode union.
 */
export function parseServiceErrorGeneric(error: HttpException): ServiceError {
  const status = error.getStatus?.() ?? 500;
  const rawResponse = error.getResponse?.();

  const responseObj =
    typeof rawResponse === "object" && rawResponse !== null
      ? (rawResponse as Record<string, unknown>)
      : {
          message:
            typeof rawResponse === "string" ? rawResponse : "Unknown error",
        };

  const code: string =
    typeof responseObj.code === "string"
      ? responseObj.code
      : (STATUS_TO_CODE_MAP[status] ?? "INTERNAL_SERVER_ERROR");

  const resolvedStatus =
    (ERROR_CODE_STATUS_MAP as Record<string, number>)[code] ?? status;

  return {
    code,
    status: resolvedStatus,
    message: (responseObj.message as string) ?? "Unknown error",
    provider: responseObj.provider as string | undefined,
    response: responseObj.response ?? responseObj,
  };
}
