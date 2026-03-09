# @nestjs-sdk-tools/core

Runtime library for NestJS SDK generation. Provides the typed error system (`ServiceError`), exhaustive pattern matching on `ResultAsync`, the `@MapResult` controller decorator, and an ESLint plugin — the shared foundation that every generated SDK and its consumers depend on.

## Install

```bash
npm install @nestjs-sdk-tools/core
```

**Peer dependencies** (install separately if not already present):

```bash
npm install @nestjs/common neverthrow
```

## Quick overview

| Feature                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `ServiceError` type system | Typed, discriminated error shapes keyed by `code` string            |
| `ServiceException` classes | Throwable NestJS `HttpException` wrappers with a `code` field       |
| `AppHttpResult<T, E>`      | `ResultAsync<T, E>` alias for typed service return values           |
| `@MapResult` decorator     | Controller method decorator: resolves `ResultAsync` → HTTP response |
| `matchError` / `.match()`  | Exhaustive pattern matching on the error union                      |
| `parseServiceError`        | Converts an `HttpException` back into a typed `ServiceError`        |
| `SdkErrorMapper` + token   | DI contract for injecting a business-wide error shape normalizer    |
| ESLint plugin              | `no-floating-result-async` rule                                     |

---

## Error types

The `ServiceError` interface is the discriminant at the core of the system:

```ts
interface ServiceError {
  code: string; // e.g. 'NOT_FOUND', 'DATABASE_UNAVAILABLE'
  status: number; // HTTP status code
  message: string;
  provider?: string;
  response?: unknown;
}
```

Every known HTTP error code has a concrete interface with literal `code` and `status` types:

```ts
import type {
  NotFoundError,
  ConflictError,
  ServiceErrorUnion,
} from "@nestjs-sdk-tools/core";

// Narrowed: code is literally 'NOT_FOUND', status is literally 404
type E = ServiceErrorUnion<["NOT_FOUND", "CONFLICT"]>;
// → NotFoundError | ConflictError
```

**Exported error interfaces:** `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `MethodNotAllowedError`, `NotAcceptableError`, `RequestTimeoutError`, `ConflictError`, `GoneError`, `PayloadTooLargeError`, `UnsupportedMediaTypeError`, `ImATeapotError`, `UnprocessableEntityError`, `TooManyRequestsError`, `InternalServerError`, `ServiceUnavailableError`.

**Utility types:**

```ts
// Maps a single code to its concrete error interface
type ServiceErrorOf<'NOT_FOUND'> // → NotFoundError

// Maps a tuple of codes to a union of their interfaces
type ServiceErrorUnion<['NOT_FOUND', 'CONFLICT']> // → NotFoundError | ConflictError

// AppHttpResult — standard return type for service methods
type AppHttpResult<T, E extends ServiceError = ServiceError> = ResultAsync<T, E>
```

---

## ServiceException classes

Throwable `HttpException` subclasses with a `code` field. Throw them in services; `parseServiceError` round-trips them back.

```ts
import {
  NotFoundServiceError,
  ConflictServiceError,
  customServiceError,
} from "@nestjs-sdk-tools/core";

// Built-in classes — one per known ErrorCode
throw new NotFoundServiceError("User not found");
throw new ConflictServiceError("Email already registered", "auth-service");

// Custom codes — provide an explicit status
throw customServiceError(
  "DATABASE_UNAVAILABLE",
  503,
  "Primary DB unreachable",
  "postgres",
);
```

All constructors accept `(message: string, provider?: string)`.

---

## `@MapResult` — controller decorator

Resolves a `ResultAsync` returned by a service/SDK method into an HTTP response. On `ok` it returns the value; on `err` it throws an `HttpException` with the `ServiceError` body. Optionally accepts an `errorStatusMap` to remap or override specific error codes.

```ts
import { MapResult } from '@nestjs-sdk-tools/core';

@Get(':id')
@MapResult()
find(@Param() p: FindDto, @Headers() h: HeaderDto) {
  return this.sdk.findResult(p, h); // ResultAsync<User, NotFoundError>
}

// Override message for a specific code:
@Delete(':id')
@MapResult({ NOT_FOUND: { message: 'Resource already deleted' } })
remove(@Param() p: FindDto, @Headers() h: HeaderDto) {
  return this.sdk.removeResult(p, h);
}

// Remap via function — receives the narrowed ServiceError:
@Post()
@MapResult({
  CONFLICT: (e) => ({ ...e, message: `Duplicate key: ${e.message}` }),
  DATABASE_UNAVAILABLE: (e) => ({ ...e, status: 503 }),
})
create(@Body() dto: CreateDto, @Headers() h: HeaderDto) {
  return this.sdk.createResult(dto, h);
}
```

---

## Exhaustive matching

Import `@nestjs-sdk-tools/core` once (e.g. in your app module) and it patches neverthrow's `.match()` to accept an exhaustive object handler when `E extends ServiceError`. TypeScript guarantees all codes are handled at compile time.

```ts
import "@nestjs-sdk-tools/core"; // activates the match patch (side-effect)

const result = await this.sdk.findResult(dto, headers);

const response = await result.match((user) => user, {
  NOT_FOUND: (e) => {
    throw new NotFoundException(e.message);
  },
  CONFLICT: (e) => {
    throw new ConflictException(e.message);
  },
  // TypeScript errors if any code in the union is missing
});
```

You can also use `matchError` standalone (no `ResultAsync` required):

```ts
import { matchError } from "@nestjs-sdk-tools/core";

const message = matchError(error, {
  NOT_FOUND: (e) => `${e.message} (404)`,
  CONFLICT: (e) => `${e.message} (409)`,
});
```

Use `assertNever` in `switch` statements for the same exhaustiveness guarantees:

```ts
import { assertNever } from "@nestjs-sdk-tools/core";

switch (error.code) {
  case "NOT_FOUND":
    return handleNotFound(error);
  case "CONFLICT":
    return handleConflict(error);
  default:
    return assertNever(error); // TS error if a case is missing
}
```

---

## `parseServiceError` / `parseServiceErrorGeneric`

Converts an `HttpException` back into a `ServiceError`. Used internally by generated SDK base services; exposed for consumers that need to normalize upstream errors manually.

```ts
import {
  parseServiceError,
  parseServiceErrorGeneric,
} from "@nestjs-sdk-tools/core";

// Typed — resolves to ServiceErrorUnion<typeof allowedCodes>
const err = parseServiceError(httpException, [
  "NOT_FOUND",
  "CONFLICT",
] as const);
// err.code is 'NOT_FOUND' | 'CONFLICT'

// Generic — use when the code might be a custom tag
const err = parseServiceErrorGeneric(httpException);
// err is ServiceError (untyped code string)
```

---

## `SdkErrorMapper` — business-wide error normalization

Inject a custom mapper to override how every SDK in the application converts `HttpException` to `ServiceError`. This lets you enforce a business-wide error shape (e.g. adding a `traceId`, mapping provider-specific codes) in one place.

```ts
import { SdkErrorMapper, SDK_ERROR_MAPPER_TOKEN } from "@nestjs-sdk-tools/core";
import { HttpException } from "@nestjs/common";
import { ServiceError } from "@nestjs-sdk-tools/core";

// 1. Implement the mapper
const myMapper: SdkErrorMapper = (error: HttpException): ServiceError => {
  const base = parseServiceErrorGeneric(error);
  return { ...base, provider: "my-service" };
};

// 2a. Register globally (applies to all SDKs in the app)
@Module({
  providers: [
    { provide: SDK_ERROR_MAPPER_TOKEN, useValue: myMapper, global: true },
  ],
})
export class AppModule {}

// 2b. Or per-SDK (overrides the global for that SDK only)
ConfigAdapterSdkModule.forRoot({
  baseUrl: process.env.CONFIG_ADAPTER_URL,
  errorMapper: myMapper,
});
```

---

## ESLint plugin

Prevents `ResultAsync` values from floating through NestJS HTTP handlers unresolved (which would send the wrapper object to the client instead of the unwrapped value).

```js
// eslint.config.mjs
import sdkPlugin from "@nestjs-sdk-tools/core/eslint-plugin";

export default [
  {
    plugins: { sdk: sdkPlugin },
    rules: {
      "sdk/no-floating-result-async": "error",
    },
  },
];
```

**What it catches:**

```ts
// ❌ BAD — ResultAsync floats through, NestJS sends the wrapper to the client
@Get(':id')
find(@Param() p: Dto) {
  return this.sdk.findResult(p, headers);
}

// ✅ GOOD — resolved before returning
@Get(':id')
async find(@Param() p: Dto) {
  return this.sdk.findResult(p, headers).match(
    (value) => value,
    (err) => { throw new NotFoundException(err.message); },
  );
}
```

---

## Full API reference

### Types

| Export                         | Description                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `ServiceError`                 | Base discriminated error interface (`code`, `status`, `message`, `provider?`, `response?`) |
| `KnownServiceError`            | Union of all 16 concrete error interfaces                                                  |
| `ServiceErrorOf<C>`            | Maps a single `ErrorCode` string → concrete interface                                      |
| `ServiceErrorUnion<T>`         | Maps a tuple of `ErrorCode` strings → union of concrete interfaces                         |
| `AppHttpResult<T, E>`          | `ResultAsync<T, E>` alias                                                                  |
| `ErrorCode`                    | Union of known code strings (`'NOT_FOUND' \| 'CONFLICT' \| ...`)                           |
| `ErrorIdentifier`              | Accepts `ErrorCode` string, `HttpStatus` number, or NestJS exception class                 |
| `SdkErrorMapper`               | `(error: HttpException) => ServiceError`                                                   |
| `SDK_ERROR_MAPPER_TOKEN`       | `Symbol.for('@nestjs-sdk-tools/error-mapper')`                                             |
| `ERROR_CODE_STATUS_MAP`        | Code → status constant map                                                                 |
| `ExhaustiveErrorHandler<E, A>` | Object type where every `code` in union `E` has a handler                                  |

### Error classes

| Export                                                 | Code                     | Status |
| ------------------------------------------------------ | ------------------------ | ------ |
| `ServiceException`                                     | (base, any code)         | (any)  |
| `BadRequestServiceError`                               | `BAD_REQUEST`            | 400    |
| `UnauthorizedServiceError`                             | `UNAUTHORIZED`           | 401    |
| `ForbiddenServiceError`                                | `FORBIDDEN`              | 403    |
| `NotFoundServiceError`                                 | `NOT_FOUND`              | 404    |
| `MethodNotAllowedServiceError`                         | `METHOD_NOT_ALLOWED`     | 405    |
| `NotAcceptableServiceError`                            | `NOT_ACCEPTABLE`         | 406    |
| `RequestTimeoutServiceError`                           | `REQUEST_TIMEOUT`        | 408    |
| `ConflictServiceError`                                 | `CONFLICT`               | 409    |
| `GoneServiceError`                                     | `GONE`                   | 410    |
| `PayloadTooLargeServiceError`                          | `PAYLOAD_TOO_LARGE`      | 413    |
| `UnsupportedMediaTypeServiceError`                     | `UNSUPPORTED_MEDIA_TYPE` | 415    |
| `ImATeapotServiceError`                                | `I_AM_A_TEAPOT`          | 418    |
| `UnprocessableEntityServiceError`                      | `UNPROCESSABLE_ENTITY`   | 422    |
| `TooManyRequestsServiceError`                          | `TOO_MANY_REQUESTS`      | 429    |
| `InternalServerServiceError`                           | `INTERNAL_SERVER_ERROR`  | 500    |
| `ServiceUnavailableServiceError`                       | `SERVICE_UNAVAILABLE`    | 503    |
| `customServiceError(code, status, message, provider?)` | any string               | any    |

### Functions

| Export                                   | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| `parseServiceError(error, allowedCodes)` | `HttpException` → typed `ServiceErrorOf<C>`                 |
| `parseServiceErrorGeneric(error)`        | `HttpException` → generic `ServiceError`                    |
| `matchError(error, handlers)`            | Exhaustive switch on `error.code`                           |
| `assertNever(x)`                         | Exhaustiveness guard for `switch` default branches          |
| `toServiceError(error)`                  | Normalizes `HttpException \| ServiceError` → `ServiceError` |
| `normalizeToCode(identifier)`            | Maps `ErrorIdentifier` → `ErrorCode` string                 |
| `codeToStatus(code)`                     | Maps `ErrorCode` → HTTP status number                       |
