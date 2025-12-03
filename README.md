# `@nachiketnkulkarni/ui-workflow`

A lightweight, type-safe, **UI workflow engine** for React applications.  
Designed for building **frontend workflow logic** similar to **XState** or backend workflow tools like **Camunda**, but optimized specifically for:

- **UI-driven flows**
- **Auto-running steps**
- **Config-first JSON/DSL**
- **TypeScript-first safety**
- **Simple React integration**

This package enables you to define workflows declaratively using **JSON**, plug in backend/local logic through a **handler registry**, and render/drive workflows through **React hooks**.

---

## ✨ Features

- **Config-first workflow definition** (JSON/DSL)
- **Auto-running workflow engine**
  - Automatically progresses through `auto` states until stable
- **TypeScript-first** runtime and definitions
- **React bindings**
  - `WorkflowProvider`
  - `useWorkflow()`
- **Pluggable handlers**
  - API calls
  - Local validations
  - Async logic
- **Supports GUARD logic**, ACTION logic, `onEnter`, `onExit`
- **Fully controlled workflow instance state**
- **Workflow history tracking**
- **Highly modular and extensible**

---

## 📦 Installation

```bash
npm install @nachiketnkulkarni/ui-workflow
```

or

```bash
yarn add @nachiketnkulkarni/ui-workflow
```

---

## 🧠 Core Concepts

### **States**

Each workflow state has a type:

| Type   | Meaning                                   |
| ------ | ----------------------------------------- |
| `task` | Requires UI/user action                   |
| `auto` | Runs automatically with no UI interaction |
| `end`  | Terminal state of workflow                |

---

### **Transitions**

Each state contains transitions that may contain:

- `event` — user-triggered or system-triggered event
- `guard` — boolean condition to allow/block transition
- `action` — logic executed during transition

---

### **Auto-running Logic**

`auto` states **immediately run**:

1. `onEnter` action
2. All **event-less transitions**
3. Each transition guard is evaluated
4. First valid guard wins
5. Transitions again
6. Until reaching a non-auto or end state

This enables backend-like workflow execution on the client.

---

## 🧩 JSON/DSL Workflow Definition Example

```json
{
  "id": "cash-withdrawal",
  "version": 1,
  "initialState": "enterDetails",
  "states": {
    "enterDetails": {
      "kind": "task",
      "label": "Enter PIN & Amount",
      "transitions": [
        {
          "target": "checkPin",
          "event": "SUBMIT"
        }
      ]
    },
    "checkPin": {
      "kind": "auto",
      "onEnter": "atm.checkPin",
      "transitions": [
        { "target": "failed", "guard": "atm.guard.pinInvalid" },
        { "target": "checkUserExists", "guard": "atm.guard.pinValid" }
      ]
    },
    "failed": { "kind": "end" },
    "completed": { "kind": "end" }
  }
}
```

---

## 🔧 Handler Registry

Handlers connect workflow to your **API logic or business logic**.

```ts
import { HandlerRegistry } from "@nachiketnkulkarni/ui-workflow";

export const atmHandlers: HandlerRegistry<WithdrawalContext> = {
  "atm.checkPin": async (ctx) => {
    const result = await api.verifyPin(ctx.pin);
    ctx.pinValid = result.valid;
  },

  "atm.guard.pinValid": (ctx) => ctx.pinValid === true,
  "atm.guard.pinInvalid": (ctx) => ctx.pinValid === false,
};
```

Handlers can be either:

- **Guard functions** → return boolean
- **Action functions** → return void / promise

Resolved automatically by the compiler.

---

## ⚙️ Compiling Workflow JSON + Handlers

```ts
import config from "./atmConfig.json";
import { compileWorkflowConfig } from "@nachiketnkulkarni/ui-workflow";
import { atmHandlers } from "./handlers";

export const atmWorkflow = compileWorkflowConfig(config, atmHandlers);
```

---

## ⚛️ React Integration

### Wrapping the workflow

```tsx
import { WorkflowProvider, useWorkflow } from "@nachiketnkulkarni/ui-workflow";

export function WithdrawalFlow() {
  const initialCtx = { pin: "", amount: 0 };

  return (
    <WorkflowProvider workflow={atmWorkflow} initialContext={initialCtx}>
      <WithdrawScreen />
    </WorkflowProvider>
  );
}
```

---

### Using the workflow inside React

```tsx
function WithdrawScreen() {
  const { instance, send, currentState, updateContext } =
    useWorkflow<WithdrawalContext>();

  if (currentState.id === "enterDetails") {
    return (
      <>
        <input
          onChange={(e) => updateContext((ctx) => (ctx.pin = e.target.value))}
        />
        <button onClick={() => send("SUBMIT")}>Submit</button>
      </>
    );
  }

  if (currentState.type === "auto") {
    return <p>Processing {currentState.label}...</p>;
  }

  if (currentState.id === "completed") {
    return <p>Withdrawal completed!</p>;
  }

  return null;
}
```

---

## 🧪 Example Workflow Execution

```
enterDetails (task)
 --SUBMIT→ checkPin (auto)
 → onEnter: call verifyPin API
 → guard checks
 → checkUserExists (auto)
 → checkAccount (auto)
 → checkBalance (auto)
 → debitAccount (auto)
 → completed (end)
```

User interacts **only once**, engine handles the rest.

---

## 🧱 API Reference (Summary)

### **compileWorkflowConfig(config, handlers)**

Compiles JSON workflow + handler registry → runtime workflow.

---

### **WorkflowProvider**

Props:

| Prop             | Type     | Description                |
| ---------------- | -------- | -------------------------- |
| `workflow`       | Workflow | Compiled workflow          |
| `initialContext` | object   | Initial workflow context   |
| `onTransition?`  | callback | Hook for logging/analytics |

---

### **useWorkflow()**

Returns:

| Key                 | Description              |
| ------------------- | ------------------------ |
| `instance`          | Full workflow instance   |
| `currentState`      | Current workflow state   |
| `send(event)`       | Trigger event            |
| `can(event)`        | Check if event is valid  |
| `updateContext(fn)` | Mutate context immutably |
| `setContext(ctx)`   | Replace context          |

---

## 💡 Why This Library?

Unlike XState, this library is:

- purpose-built for **UI flows** (forms, wizards, process automation)
- simpler to learn
- JSON-friendly for **non-dev workflow authors**
- excellent for banking, onboarding, checkout, KYC, approvals, multi-step ops
- supports async actions naturally (API calls inside auto states)

---

## 🧭 Roadmap

- [ ] Visual Workflow Designer / Graph Viewer
- [ ] Auto-generated TypeScript types from JSON schema
- [ ] Workflow validation tool (`workflow validate myflow.json`)
- [ ] DevTools for React + workflow instance inspection
- [ ] Persistent workflow sessions with storage adapters (localStorage, backend)

---
