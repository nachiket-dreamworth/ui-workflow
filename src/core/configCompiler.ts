// src/core/configCompiler.ts

import { Workflow, WorkflowState, Transition, WorkflowContext } from "./types";
import { WorkflowConfig, StateConfig, TransitionConfig } from "./configTypes";
import { HandlerRegistry, resolveGuard, resolveAction } from "./handlers";

function compileState<Ctx extends WorkflowContext>(
  stateId: string,
  cfg: StateConfig,
  handlers: HandlerRegistry<Ctx>
): WorkflowState<unknown, Ctx> {
  const transitions: Transition<Ctx>[] =
    cfg.transitions?.map((tCfg: TransitionConfig) => ({
      id: `${stateId}::${tCfg.target}::${tCfg.event ?? "AUTO"}`,
      target: tCfg.target,
      label: tCfg.label,
      event: tCfg.event,
      guard: resolveGuard(handlers, tCfg.guard),
      action: resolveAction(handlers, tCfg.action),
    })) ?? [];

  const state: WorkflowState<unknown, Ctx> = {
    id: stateId,
    type: cfg.kind,
    label: cfg.label,
    description: cfg.description,
    icon: cfg.icon,
    onEnter: resolveAction(handlers, cfg.onEnter),
    onExit: resolveAction(handlers, cfg.onExit),
    transitions,
  };

  return state;
}

/**
 * Compile a JSON/DSL workflow config plus a handler registry
 * into a runtime Workflow.
 */
export function compileWorkflowConfig<Ctx extends WorkflowContext>(
  config: WorkflowConfig,
  handlers: HandlerRegistry<Ctx>
): Workflow<unknown, Ctx> {
  const states: Record<string, WorkflowState<unknown, Ctx>> = {};

  for (const [stateId, stateCfg] of Object.entries(config.states)) {
    states[stateId] = compileState(stateId, stateCfg, handlers);
  }

  if (!states[config.initialState]) {
    throw new Error(
      `Initial state "${config.initialState}" not found in workflow "${config.id}"`
    );
  }

  const workflow: Workflow<unknown, Ctx> = {
    id: config.id,
    initialState: config.initialState,
    states,
  };

  return workflow;
}
