// src/core/handlers.ts

import { WorkflowContext, GuardFn, WorkflowAction } from "./types";

/**
 * A handler can be either:
 * - a guard (returns boolean / Promise<boolean>)
 * - or an action (returns void / Promise<void>).
 *
 * The registry stores both; we have typed resolvers to get the right shape out.
 */
export type HandlerFn<Ctx extends WorkflowContext = WorkflowContext> =
  | GuardFn<Ctx>
  | WorkflowAction<Ctx>;

export type HandlerRegistry<Ctx extends WorkflowContext = WorkflowContext> = {
  [handlerId: string]: HandlerFn<Ctx>;
};

/**
 * Resolve a guard handler by id from the registry.
 */
export function resolveGuard<Ctx extends WorkflowContext>(
  handlers: HandlerRegistry<Ctx>,
  id?: string
): GuardFn<Ctx> | undefined {
  if (!id) return undefined;
  const fn = handlers[id];
  if (!fn) {
    throw new Error(`Guard handler "${id}" not found in handler registry`);
  }
  // We trust the caller to have registered a guard for this id.
  return fn as GuardFn<Ctx>;
}

/**
 * Resolve an action handler by id from the registry.
 */
export function resolveAction<Ctx extends WorkflowContext>(
  handlers: HandlerRegistry<Ctx>,
  id?: string
): WorkflowAction<Ctx> | undefined {
  if (!id) return undefined;
  const fn = handlers[id];
  if (!fn) {
    throw new Error(`Action handler "${id}" not found in handler registry`);
  }
  // We trust the caller to have registered an action for this id.
  return fn as WorkflowAction<Ctx>;
}
