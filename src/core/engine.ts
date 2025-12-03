// src/core/engine.ts

import {
  Workflow,
  WorkflowContext,
  WorkflowInstance,
  WorkflowHistoryEntry,
  Transition,
  EventType,
  TransitionResult,
} from "./types";

function generateInstanceId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Optional validation hook, currently just checks initial state exists.
 */
export function createWorkflow<
  StateData = unknown,
  Ctx extends WorkflowContext = WorkflowContext
>(config: Workflow<StateData, Ctx>): Workflow<StateData, Ctx> {
  if (!config.states[config.initialState]) {
    throw new Error(
      `Initial state "${config.initialState}" is not defined in workflow "${config.id}"`
    );
  }
  return config;
}

export function startWorkflow<Ctx extends WorkflowContext>(
  workflow: Workflow<unknown, Ctx>,
  initialCtx: Ctx,
  options?: { instanceId?: string }
): WorkflowInstance<Ctx> {
  const now = new Date().toISOString();

  const instance: WorkflowInstance<Ctx> = {
    workflowId: workflow.id,
    instanceId: options?.instanceId ?? generateInstanceId(),
    currentState: workflow.initialState,
    ctx: initialCtx,
    history: [
      {
        stateId: workflow.initialState,
        enteredAt: now,
      },
    ],
    status: "running",
  };

  return instance;
}

async function applyTransition<Ctx extends WorkflowContext>(
  workflow: Workflow<unknown, Ctx>,
  instance: WorkflowInstance<Ctx>,
  transition: Transition<Ctx>,
  event?: EventType
): Promise<WorkflowInstance<Ctx>> {
  const currentState = workflow.states[instance.currentState];
  if (!currentState) {
    throw new Error(
      `State "${instance.currentState}" not found in workflow "${workflow.id}"`
    );
  }

  const targetState = workflow.states[transition.target];
  if (!targetState) {
    throw new Error(
      `Target state "${transition.target}" not found in workflow "${workflow.id}"`
    );
  }

  const now = new Date().toISOString();

  if (currentState.onExit) {
    await currentState.onExit(instance.ctx);
  }

  if (transition.action) {
    await transition.action(instance.ctx);
  }

  const updatedHistory: WorkflowHistoryEntry[] = instance.history.map(
    (entry, idx, arr) => {
      const isLast = idx === arr.length - 1;
      if (isLast && !entry.leftAt) {
        return { ...entry, leftAt: now };
      }
      return entry;
    }
  );

  updatedHistory.push({
    stateId: targetState.id,
    enteredAt: now,
    transitionId: transition.id,
    event,
  });

  if (targetState.onEnter) {
    await targetState.onEnter(instance.ctx);
  }

  const isEnd = targetState.type === "end";

  const updatedInstance: WorkflowInstance<Ctx> = {
    ...instance,
    currentState: targetState.id,
    history: updatedHistory,
    status: isEnd ? "completed" : "running",
  };

  return updatedInstance;
}

/**
 * Automatically runs through `auto` states and auto transitions
 * (transitions without an event) until a stable state is reached:
 * - non-auto state, or
 * - completed / error / cancelled.
 */
export async function runUntilStable<Ctx extends WorkflowContext>(
  workflow: Workflow<unknown, Ctx>,
  instance: WorkflowInstance<Ctx>
): Promise<WorkflowInstance<Ctx>> {
  let current = instance;

  while (current.status === "running") {
    const state = workflow.states[current.currentState];
    if (!state) {
      return {
        ...current,
        status: "error",
        error: new Error(
          `State "${current.currentState}" not found in workflow "${workflow.id}"`
        ),
      };
    }

    if (state.type !== "auto") {
      break;
    }

    const transitions = state.transitions ?? [];
    const candidates = transitions.filter((t) => !t.event);

    if (!candidates.length) {
      break;
    }

    let moved = false;

    for (const t of candidates) {
      try {
        const guardPass = t.guard ? await t.guard(current.ctx) : true;
        if (!guardPass) {
          continue;
        }

        current = await applyTransition(workflow, current, t);
        moved = true;
        break;
      } catch (err) {
        return {
          ...current,
          status: "error",
          error: err,
        };
      }
    }

    if (!moved) {
      // No guard passed; cannot auto-progress further
      break;
    }
  }

  return current;
}

/**
 * Start workflow and immediately auto-run through `auto` states.
 */
export async function startWorkflowAndRun<Ctx extends WorkflowContext>(
  workflow: Workflow<unknown, Ctx>,
  initialCtx: Ctx,
  options?: { instanceId?: string }
): Promise<WorkflowInstance<Ctx>> {
  const instance = startWorkflow(workflow, initialCtx, options);
  return runUntilStable(workflow, instance);
}

/**
 * Send an event to the workflow (user interaction / explicit trigger).
 * After applying the event transition, auto-runs through any following
 * `auto` states.
 */
export async function sendEvent<Ctx extends WorkflowContext>(
  workflow: Workflow<unknown, Ctx>,
  instance: WorkflowInstance<Ctx>,
  event: EventType
): Promise<TransitionResult<Ctx>> {
  if (instance.status !== "running") {
    return { instance, transitioned: false };
  }

  const currentState = workflow.states[instance.currentState];
  if (!currentState?.transitions?.length) {
    return { instance, transitioned: false };
  }

  const candidates = currentState.transitions.filter((t) => t.event === event);

  if (!candidates.length) {
    return { instance, transitioned: false };
  }

  for (const t of candidates) {
    try {
      const guardPass = t.guard ? await t.guard(instance.ctx) : true;
      if (!guardPass) {
        continue;
      }

      let updated = await applyTransition(workflow, instance, t, event);
      updated = await runUntilStable(workflow, updated);

      return {
        instance: updated,
        transitioned: true,
      };
    } catch (err) {
      const errored: WorkflowInstance<Ctx> = {
        ...instance,
        status: "error",
        error: err,
      };
      return {
        instance: errored,
        transitioned: false,
      };
    }
  }

  return { instance, transitioned: false };
}
