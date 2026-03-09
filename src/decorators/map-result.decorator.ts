import { HttpException } from "@nestjs/common";
import { ResultAsync } from "neverthrow";
import { type ServiceError, type ErrorIdentifier } from "../types";
import { normalizeToCode, codeToStatus } from "../maps";
import { toServiceError } from "../utils/to-service-error";

/**
 * Type for error mappers in MapResult's errorStatusMap.
 */
export type ErrorMapperFunction = (error: ServiceError) => ServiceError;

/**
 * Map of error code → mapper function or partial ServiceError override.
 * Keys can be any string (ErrorCode known codes or custom tags).
 */
export type ErrorStatusMap = Record<
  string,
  ErrorMapperFunction | Partial<ServiceError>
>;

/**
 * NestJS method decorator that maps a ResultAsync's error side into
 * an HttpException with a standardized ServiceError body.
 *
 * Accepts an optional errorStatusMap keyed by error code strings
 * (known ErrorCode or custom tags).
 *
 * @example
 * @Get()
 * @MapResult({ NOT_FOUND: { message: 'User not found' } })
 * findOne() { return this.sdk.findOneResult(...); }
 *
 * @example
 * @Get()
 * @MapResult({ DATABASE_UNAVAILABLE: (e) => ({ ...e, message: 'DB down' }) })
 * findAll() { return this.sdk.findAllResult(...); }
 */
export function MapResult(errorStatusMap?: ErrorStatusMap) {
  return (_target: any, _key: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const result: ResultAsync<unknown, HttpException | ServiceError> =
        originalMethod.apply(this, args);

      return result.match(
        (value) => value,
        (error) => {
          const serviceError = toServiceError(error);
          const code = serviceError.code;

          if (!errorStatusMap) {
            throw new HttpException(serviceError, serviceError.status);
          }

          const mapper = errorStatusMap[code];

          if (!mapper) {
            throw new HttpException(serviceError, serviceError.status);
          }

          if (typeof mapper === "function") {
            const mapped = mapper(serviceError);
            throw new HttpException(mapped, mapped.status);
          }

          const merged: ServiceError = { ...serviceError, ...mapper };
          throw new HttpException(merged, merged.status);
        },
      );
    };
    return descriptor;
  };
}
