// src/core/configTypes.ts

import { WorkflowStateType } from "./types";

export type StateKind = WorkflowStateType;

export interface WorkflowConfig {
  id: string;
  version: number;
  initialState: string;
  states: Record<string, StateConfig>;
}

export interface StateConfig {
  kind: StateKind;
  label?: string;
  description?: string;
  icon?: string;

  onEnter?: string;
  onExit?: string;

  transitions?: TransitionConfig[];
}

export interface TransitionConfig {
  target: string;
  label?: string;
  event?: string;
  guard?: string;
  action?: string;
}
