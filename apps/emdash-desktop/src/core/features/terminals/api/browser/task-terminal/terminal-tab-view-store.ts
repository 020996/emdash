import { action, comparer, computed, makeObservable, observable, reaction } from 'mobx';
import type { TaskTerminalSelectionState } from '@core/features/tasks/contributions/mementos';
import type {
  TerminalManagerStore,
  TerminalStore,
} from '@core/features/terminals/api/browser/task-terminal/terminal-manager';
import {
  addToSplit,
  pruneSplits,
  splitGroupOf,
} from '@core/features/terminals/api/browser/task-terminal/terminal-splits';
import type { MementoHandle } from '@core/primitives/mementos/browser';
import { type TabViewProvider } from '@core/primitives/workbench-shell/browser/tabs/generic-tab-view';
import {
  reorderTabIds,
  setNextTabActive,
  setPreviousTabActive,
  setTabActive,
  setTabActiveIndex,
} from '@core/primitives/workbench-shell/browser/tabs/tab-utils';

export class TerminalTabViewStore implements TabViewProvider<TerminalStore, never> {
  private readonly _getResource: () => TerminalManagerStore | null;
  private readonly disposers: (() => void)[] = [];
  // Syncing before the stored selection loads would overwrite it with defaults
  // (losing tab order and splits on reload).
  private hydrated = false;

  constructor(
    private readonly handle: MementoHandle<TaskTerminalSelectionState>,
    getResource: () => TerminalManagerStore | null
  ) {
    this._getResource = getResource;
    makeObservable<TerminalTabViewStore, 'handle' | 'syncTerminalIds'>(this, {
      tabOrder: computed,
      activeTabId: computed,
      tabs: computed,
      activeTab: computed,
      addTab: action,
      removeTab: action,
      addSplit: action,
      unsplit: action,
      joinSplit: action,
      reorderTabs: action,
      setNextTabActive: action,
      setPreviousTabActive: action,
      setTabActiveIndex: action,
      setActiveTab: action,
      syncTerminalIds: action,
      handle: false,
    });
    makeObservable<TerminalTabViewStore, 'hydrated'>(this, { hydrated: observable });
    void handle.ready.finally(
      action(() => {
        this.hydrated = true;
      })
    );

    this.disposers.push(
      reaction(
        () => {
          const resource = this._getResource();
          return {
            isLoaded: this.hydrated && (resource?.isLoaded ?? false),
            ids: Array.from(resource?.terminals.keys() ?? []),
          };
        },
        action(({ isLoaded, ids }) => {
          if (!isLoaded) return;
          this.syncTerminalIds(ids);
        }),
        { fireImmediately: true, equals: comparer.structural }
      )
    );
  }

  get tabOrder(): string[] {
    return this.handle.value.tabOrder;
  }

  get activeTabId(): string | undefined {
    return this.handle.value.activeTabId;
  }

  get tabs(): TerminalStore[] {
    const resource = this._getResource();
    if (!resource) return [];
    return this.tabOrder.map((id) => resource.terminals.get(id)).filter(Boolean) as TerminalStore[];
  }

  get activeTab(): TerminalStore | undefined {
    return this.activeTabId ? this._getResource()?.terminals.get(this.activeTabId) : undefined;
  }

  /** Terminal ids shown side by side with `id` in the drawer (just `[id]` when unsplit). */
  splitGroup(id: string): string[] {
    return splitGroupOf(this.handle.value.splits, id);
  }

  /** Adds `newId` (new or existing terminal) to `anchorId`'s split group, tab right after anchor. */
  addSplit(anchorId: string, newId: string): void {
    this.updateSelection((selection) => {
      selection.splits = addToSplit(selection.splits, anchorId, newId);
      selection.tabOrder = selection.tabOrder.filter((id) => id !== newId);
      selection.tabOrder.splice(selection.tabOrder.indexOf(anchorId) + 1, 0, newId);
    });
  }

  /** Takes `id` out of its split group into its own tab; the rest of the group stays split. */
  unsplit(id: string): void {
    this.updateSelection((selection) => {
      selection.splits = selection.splits
        ?.map((group) => group.filter((member) => member !== id))
        .filter((group) => group.length > 1);
    });
  }

  /** Joins `otherId`'s whole group into `anchorId`'s split, right after the anchor. */
  joinSplit(anchorId: string, otherId: string): void {
    const otherGroup = this.splitGroup(otherId);
    // Within one group this is a reorder: move just the dragged terminal.
    const members = otherGroup.includes(anchorId) ? [otherId] : otherGroup;
    let after = anchorId;
    for (const id of members) {
      if (id === anchorId) continue;
      this.addSplit(after, id);
      after = id;
    }
  }

  setActiveTab(id: string): void {
    this.updateSelection((selection) => setTabActive(selection, id));
  }

  reorderTabs(fromIndex: number, toIndex: number): void {
    this.updateSelection((selection) => reorderTabIds(selection, fromIndex, toIndex));
  }

  setNextTabActive(): void {
    this.updateSelection(setNextTabActive);
  }

  setPreviousTabActive(): void {
    this.updateSelection(setPreviousTabActive);
  }

  setTabActiveIndex(index: number): void {
    this.updateSelection((selection) => setTabActiveIndex(selection, index));
  }

  // addTab is required by TabViewProvider but terminals are created explicitly
  addTab(_args: never): void {}

  removeTab(id: string): void {
    void this._getResource()?.deleteTerminal(id);
  }

  closeActiveTab(): void {
    if (this.activeTabId) this.removeTab(this.activeTabId);
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private syncTerminalIds(ids: string[]): void {
    const idSet = new Set(ids);
    this.updateSelection((selection) => {
      selection.tabOrder = selection.tabOrder.filter((id) => idSet.has(id));
      selection.splits = pruneSplits(selection.splits, idSet);
      for (const id of ids) {
        if (!selection.tabOrder.includes(id)) selection.tabOrder.push(id);
      }
      if (selection.activeTabId && !idSet.has(selection.activeTabId)) {
        selection.activeTabId = selection.tabOrder[0];
      }
      if (!selection.activeTabId && selection.tabOrder.length > 0) {
        selection.activeTabId = selection.tabOrder[0];
      }
    });
  }

  private updateSelection(
    update: (selection: {
      tabOrder: string[];
      activeTabId: string | undefined;
      splits: string[][] | undefined;
    }) => void
  ): void {
    this.handle.update((current) => {
      const selection = {
        tabOrder: [...current.tabOrder],
        activeTabId: current.activeTabId,
        splits: current.splits,
      };
      update(selection);
      return { ...current, ...selection };
    });
  }
}
