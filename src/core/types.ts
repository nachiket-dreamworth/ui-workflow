// src/core/types.ts

export type WorkflowId = string;
export type StateId = string;
export type TransitionId = string;
export type EventType = string;

export interface WorkflowContext {
  // Extend in app code
  [key: string]: unknown;
}

export type WorkflowStateType = "task" | "auto" | "end";

export type GuardFn<Ctx extends WorkflowContext = WorkflowContext> = (
  ctx: Ctx
) => boolean | Promise<boolean>;

export type WorkflowAction<Ctx extends WorkflowContext = WorkflowContext> = (
  ctx: Ctx
) => void | Promise<void>;

export interface Transition<Ctx extends WorkflowContext = WorkflowContext> {
  id?: TransitionId;
  target: StateId;
  label?: string;
  event?: EventType; // if omitted in auto states => auto transition
  guard?: GuardFn<Ctx>;
  action?: WorkflowAction<Ctx>;
}

export interface WorkflowState<
  StateData = unknown,
  Ctx extends WorkflowContext = WorkflowContext
> {
  id: StateId;
  type: WorkflowStateType;
  label?: string;
  description?: string;
  icon?: string;

  onEnter?: WorkflowAction<Ctx>;
  onExit?: WorkflowAction<Ctx>;

  transitions?: Transition<Ctx>[];

  // Optional metadata for UI
  data?: StateData;
}

export interface Workflow<
  StateData = unknown,
  Ctx extends WorkflowContext = WorkflowContext
> {
  id: WorkflowId;
  initialState: StateId;
  states: Record<StateId, WorkflowState<StateData, Ctx>>;
}

export interface WorkflowHistoryEntry {
  stateId: StateId;
  enteredAt: string;
  leftAt?: string;
  transitionId?: TransitionId;
  event?: EventType;
}

export type WorkflowStatus =
  | "idle"
  | "running"
  | "completed"
  | "error"
  | "cancelled";

export interface WorkflowInstance<
  Ctx extends WorkflowContext = WorkflowContext
> {
  workflowId: WorkflowId;
  instanceId: string;
  currentState: StateId;
  ctx: Ctx;
  history: WorkflowHistoryEntry[];
  status: WorkflowStatus;
  error?: unknown;
}

export interface TransitionResult<
  Ctx extends WorkflowContext = WorkflowContext
> {
  instance: WorkflowInstance<Ctx>;
  transitioned: boolean;
}
