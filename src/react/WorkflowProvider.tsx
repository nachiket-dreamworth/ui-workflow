// src/react/WorkflowProvider.tsx

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  Workflow,
  WorkflowContext,
  WorkflowInstance,
  EventType,
  WorkflowState,
} from "../core/types";
import {
  startWorkflowAndRun,
  sendEvent as coreSendEvent,
} from "../core/engine";

export interface WorkflowEngineValue<
  Ctx extends WorkflowContext = WorkflowContext
> {
  workflow: Workflow<unknown, Ctx>;
  instance: WorkflowInstance<Ctx>;
  send: (event: EventType) => Promise<void>;
  can: (event: EventType) => Promise<boolean>;
  updateContext: (updater: (ctx: Ctx) => void) => void;
  setContext: (ctx: Ctx) => void;
  currentState: WorkflowState<unknown, Ctx>;
}

const WorkflowEngineContext = createContext<WorkflowEngineValue<any> | null>(
  null
);

export interface WorkflowProviderProps<
  Ctx extends WorkflowContext = WorkflowContext
> {
  workflow: Workflow<unknown, Ctx>;
  initialContext: Ctx;
  children: ReactNode;
  /**
   * Optional hook to observe transitions for logging / analytics.
   * Called when a send() call causes a state change.
   */
  onTransition?: (info: {
    fromState: string;
    toState: string;
    event: EventType;
    instance: WorkflowInstance<Ctx>;
  }) => void;
}

/**
 * React provider for a workflow instance.
 * - Starts workflow + auto-runs auto states on mount.
 * - Exposes instance, send, can, currentState, and context helpers via context.
 */
export function WorkflowProvider<Ctx extends WorkflowContext = WorkflowContext>(
  props: WorkflowProviderProps<Ctx>
) {
  const { workflow, initialContext, children, onTransition } = props;

  const [instance, setInstance] = useState<WorkflowInstance<Ctx> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const started = await startWorkflowAndRun<Ctx>(workflow, initialContext);
      if (!cancelled) {
        setInstance(started);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workflow, initialContext]);

  const send = useCallback(
    async (event: EventType) => {
      if (!instance) return;
      const fromState = instance.currentState;
      const result = await coreSendEvent<Ctx>(workflow, instance, event);
      const nextInstance = result.instance;
      setInstance(nextInstance);

      if (
        onTransition &&
        nextInstance.currentState !== fromState &&
        result.transitioned
      ) {
        onTransition({
          fromState,
          toState: nextInstance.currentState,
          event,
          instance: nextInstance,
        });
      }
    },
    [workflow, instance, onTransition]
  );

  const can = useCallback(
    async (event: EventType) => {
      if (!instance) return false;
      const state = workflow.states[instance.currentState];
      if (!state?.transitions?.length) return false;

      for (const t of state.transitions) {
        if (t.event && t.event !== event) {
          continue;
        }
        const guardPass = t.guard ? await t.guard(instance.ctx) : true;
        if (guardPass) {
          return true;
        }
      }

      return false;
    },
    [workflow, instance]
  );

  const updateContext = useCallback((updater: (ctx: Ctx) => void) => {
    setInstance((prev) => {
      if (!prev) return prev;
      const newCtx = { ...(prev.ctx as Ctx) };
      updater(newCtx);
      return { ...prev, ctx: newCtx };
    });
  }, []);

  const setContext = useCallback((ctx: Ctx) => {
    setInstance((prev) => {
      if (!prev) return prev;
      return { ...prev, ctx };
    });
  }, []);

  const currentState: WorkflowState<unknown, Ctx> | undefined = useMemo(
    () => (instance ? workflow.states[instance.currentState] : undefined),
    [workflow, instance]
  );

  if (!instance || !currentState) {
    // Customize this in your app if you want a loading UI
    return null;
  }

  const value: WorkflowEngineValue<Ctx> = {
    workflow,
    instance,
    send,
    can,
    updateContext,
    setContext,
    currentState,
  };

  return (
    <WorkflowEngineContext.Provider value={value}>
      {children}
    </WorkflowEngineContext.Provider>
  );
}

/**
 * Hook to use the current workflow instance & helpers.
 *
 * Usage:
 *   const { instance, send, currentState, updateContext } = useWorkflow<MyContext>();
 */
export function useWorkflow<
  Ctx extends WorkflowContext
>(): WorkflowEngineValue<Ctx> {
  const ctx = useContext(WorkflowEngineContext);
  if (!ctx) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return ctx as WorkflowEngineValue<Ctx>;
}
