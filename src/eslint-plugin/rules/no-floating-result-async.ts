/**
 * no-floating-result-async
 *
 * Enforces that ResultAsync values returned from NestJS HTTP handler methods
 * are always unwrapped with .match() or .unwrapOr() before being returned.
 *
 * NestJS resolves PromiseLike return values automatically, so returning a raw
 * ResultAsync<T,E> sends the Ok/Err wrapper object to the client instead of T.
 *
 * @example BAD  – raw ResultAsync floated through
 *   @Get(':id')
 *   get(@Param() p: P) { return this.sdk.findResult(p.id, headers); }
 *
 * @example GOOD – unwrapped before returning
 *   @Get(':id')
 *   get(@Param() p: P) {
 *     return this.sdk.findResult(p.id, headers).match(
 *       ok  => ok,
 *       err => { throw new NotFoundException(); },
 *     );
 *   }
 */

import type { Rule } from "eslint";
import type { Node, ReturnStatement, MethodDefinition } from "estree";

// ── constants ─────────────────────────────────────────────────────────────────

const NESTJS_HTTP_DECORATORS = new Set([
  "Get",
  "Post",
  "Put",
  "Delete",
  "Patch",
  "Options",
  "Head",
  "All",
  "HttpCode",
]);

/** Properties that exist on both Result and ResultAsync from neverthrow */
const RESULT_ASYNC_PROPS = [
  "match",
  "map",
  "mapErr",
  "andThen",
  "orElse",
  "unwrapOr",
];

/** Calls that properly unwrap a Result/ResultAsync at the return site */
const TERMINAL_METHODS = new Set([
  "match",
  "unwrapOr",
  "_unsafeUnwrap",
  "_unsafeUnwrapErr",
]);

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the node at the return position already has a terminal
 * call (.match / .unwrapOr) at the outermost expression level.
 *
 * Handles:
 *   return result.match(...)
 *   return await result.match(...)
 *   return (await result).match(...)
 */
function hasTerminalCallAtTopLevel(node: Node): boolean {
  if (node.type === "AwaitExpression") {
    return hasTerminalCallAtTopLevel(node.argument as Node);
  }
  if (node.type === "CallExpression") {
    const { callee } = node;
    if (
      callee.type === "MemberExpression" &&
      callee.property.type === "Identifier" &&
      TERMINAL_METHODS.has(callee.property.name)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the TypeScript type of a node has all the hallmark properties of a
 * Result / ResultAsync (neverthrow). Uses the TypeChecker exposed via
 * parserServices (ESLint v9: context.sourceCode.parserServices).
 */
function isResultAsyncLike(
  checker: import("typescript").TypeChecker,
  type: import("typescript").Type,
): boolean {
  // Unwrap unions — e.g. ResultAsync resolves to a union of Result variants
  const typeChecker = checker as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const parts: import("typescript").Type[] = [];

  function collectUnionParts(t: import("typescript").Type) {
    if ((t as any).types) {
      for (const sub of (t as any).types) {
        collectUnionParts(sub);
      }
    } else {
      parts.push(t);
    }
  }
  collectUnionParts(typeChecker.getApparentType(type));
  if (parts.length === 0) parts.push(typeChecker.getApparentType(type));

  // A type is Result-like when at least one union member has ALL required props
  return parts.some((t) =>
    RESULT_ASYNC_PROPS.every((prop) => t.getProperty(prop) !== undefined),
  );
}

const FUNCTION_BOUNDARIES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/**
 * Walks up parent chain to find the enclosing MethodDefinition.
 * Returns null if a nested function boundary is crossed first — that means
 * the return is inside a callback (e.g. inside `.andThen()`), not directly
 * in the HTTP handler body.
 */
function findEnclosingMethod(
  node: ReturnStatement & Rule.NodeParentExtension,
): MethodDefinition | null {
  let curr: (Node & Rule.NodeParentExtension) | null = node.parent as any;
  while (curr) {
    if (curr.type === "MethodDefinition")
      return curr as unknown as MethodDefinition;
    // Stop if we cross into a nested function — this return belongs to a callback
    if (FUNCTION_BOUNDARIES.has(curr.type)) return null;
    curr = (curr as any).parent ?? null;
  }
  return null;
}

/**
 * Checks whether a MethodDefinition has at least one NestJS HTTP route
 * decorator applied to it (e.g. @Get, @Post, …).
 */
function hasNestJSHttpDecorator(method: MethodDefinition): boolean {
  // ESTree / TSESTree stores decorators on the enclosing node
  const decorators: any[] = (method as any).decorators ?? [];
  return decorators.some((d: any) => {
    const expr = d.expression ?? d;
    // @Get(':id')  → CallExpression { callee: Identifier { name: 'Get' } }
    if (expr.type === "CallExpression") {
      const { callee } = expr;
      return (
        callee.type === "Identifier" && NESTJS_HTTP_DECORATORS.has(callee.name)
      );
    }
    // @Get  (no parens) — rare but handle it
    if (expr.type === "Identifier") {
      return NESTJS_HTTP_DECORATORS.has(expr.name);
    }
    return false;
  });
}

// ── rule ──────────────────────────────────────────────────────────────────────

export const noFloatingResultAsync: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require ResultAsync values returned from NestJS HTTP handlers to be unwrapped with .match() or .unwrapOr() before returning",
      recommended: true,
      url: "https://github.com/gcanti/neverthrow",
    },
    messages: {
      noFloatingResultAsync:
        "ResultAsync returned from a NestJS HTTP handler must be unwrapped with .match() or .unwrapOr(). " +
        "Returning a raw ResultAsync sends the Ok/Err wrapper to the client instead of the value.",
    },
    schema: [],
  },

  create(context) {
    // ESLint v9: parserServices lives on sourceCode
    const parserServices =
      (context as any).parserServices ??
      (context as any).sourceCode?.parserServices;

    const checker = parserServices?.program?.getTypeChecker();

    if (!checker || !parserServices) {
      // TypeScript not configured — skip silently (don't crash for JS files, etc.)
      return {};
    }

    const getType = parserServices.getTypeAtLocation.bind(parserServices);

    return {
      ReturnStatement(node) {
        const { argument } = node as ReturnStatement;
        if (!argument) return; // bare `return`

        // 1. Only flag returns from NestJS HTTP handler methods
        const method = findEnclosingMethod(node as any);
        if (!method || !hasNestJSHttpDecorator(method)) return;

        // 2. If the return expression already has a terminal unwrap, it's fine
        if (hasTerminalCallAtTopLevel(argument as Node)) return;

        // 3. Use TypeChecker to determine if the returned value is ResultAsync-like
        let tsNode: any;
        try {
          tsNode = parserServices.esTreeNodeToTSNodeMap?.get(argument);
        } catch {
          return;
        }
        if (!tsNode) return;

        let type: import("typescript").Type;
        try {
          type = checker.getTypeAtLocation(tsNode);
        } catch {
          return;
        }

        if (isResultAsyncLike(checker, type)) {
          context.report({
            node: argument as any,
            messageId: "noFloatingResultAsync",
          });
        }
      },
    };
  },
};
