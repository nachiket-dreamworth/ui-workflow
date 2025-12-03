// src/react/useWorkflowLog.ts

import { useMemo } from "react";
import {
  Workflow,
  WorkflowContext,
  WorkflowInstance,
  WorkflowStateType,
  EventType,
  TransitionId,
} from "../core/types";
import { useWorkflow } from "./WorkflowProvider";

export interface WorkflowLogEntry {
  index: number;
  stateId: string;
  stateLabel?: string;
  type: WorkflowStateType;
  enteredAt: string;
  leftAt?: string;
  durationMs?: number;
  event?: EventType;
  transitionId?: TransitionId;
  isCurrent: boolean;
}

/**
 * Build a readable log from a workflow instance & definition.
 */
function buildLog<Ctx extends WorkflowContext>(
  workflow: Workflow<unknown, Ctx>,
  instance: WorkflowInstance<Ctx>
): WorkflowLogEntry[] {
  return instance.history.map((h, index) => {
    const state = workflow.states[h.stateId];
    const entered = new Date(h.enteredAt);
    const left = h.leftAt ? new Date(h.leftAt) : undefined;

    return {
      index,
      stateId: h.stateId,
      stateLabel: state?.label,
      type: state?.type ?? "task",
      enteredAt: h.enteredAt,
      leftAt: h.leftAt,
      durationMs: left ? left.getTime() - entered.getTime() : undefined,
      event: h.event,
      transitionId: h.transitionId,
      isCurrent:
        h.stateId === instance.currentState &&
        !h.leftAt &&
        instance.status === "running",
    };
  });
}

/**
 * React hook returning a log of all visited states, including:
 * - timestamps
 * - duration (if left)
 * - triggering event
 * - current state marker
 */
export function useWorkflowLog<
  Ctx extends WorkflowContext
>(): WorkflowLogEntry[] {
  const { workflow, instance } = useWorkflow<Ctx>();

  const log = useMemo(
    () => buildLog<Ctx>(workflow, instance),
    [workflow, instance]
  );

  return log;
}
