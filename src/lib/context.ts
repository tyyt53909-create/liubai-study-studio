import { createContext, useContext } from "react";
import type { Level, Snapshot, Task } from "../../shared/domain";
import { capacity } from "../../shared/domain";
export type UI = {
  s: Snapshot;
  now: number;
  active: Snapshot["sessions"][number] | undefined;
  activeTask: Task | undefined;
  busy: boolean;
  day: string;
  eng: ReturnType<typeof capacity>;
  flex: ReturnType<typeof capacity>;
  open: Task[];
  run: (fn: () => Promise<unknown>, after?: () => void) => Promise<void>;
  planTask: (t: Task, level: Level, on_date?: string) => Promise<any>;
  togglePriority: (t: Task) => Promise<any>;
  sorted: (list: Task[]) => Task[];
  setSelected: (v: string | null) => void;
  setCapture: (v: boolean) => void;
  setNotice: (v: string) => void;
};
export const UIContext = createContext<UI | null>(null);
export function useUI() {
  return useContext(UIContext)!;
}
