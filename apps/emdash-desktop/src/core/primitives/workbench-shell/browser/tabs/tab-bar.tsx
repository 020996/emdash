import { observer } from 'mobx-react-lite';
import { useEffect, useRef, type ReactNode } from 'react';
import { usePaneContext } from '@core/primitives/workbench-shell/browser/tabs/pane-context';
import { PaneDropZone } from './tab-bar/draggable-tab';

export const TabBar = observer(function TabBar({ trailingSlot }: { trailingSlot?: ReactNode }) {
  const { paneId, pane } = usePaneContext();

  const resolvedTabs = pane.resolvedTabs.filter((tab) => pane.registry.has(tab.kind));
  // Only the first pinned-kind tab stays fixed; more would crowd out the scrolling tabs.
  const pinnedTab = resolvedTabs.find((tab) => pane.registry.get(tab.kind).pinnedInTabBar);
  const scrollingTabs = resolvedTabs.filter((tab) => tab !== pinnedTab);
  const renderTab = (tab: (typeof resolvedTabs)[number]) => {
    const TabItemComponent = pane.registry.get(tab.kind).TabBarItem;
    return <TabItemComponent key={tab.tabId} tab={tab} host={pane} ctx={pane.ctx} />;
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = pane.activeTabId;
    if (!id || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector<HTMLElement>(
      `[data-tabid="${CSS.escape(id)}"]`
    );
    el?.scrollIntoView({ behavior: 'instant', inline: 'nearest', block: 'nearest' });
  }, [pane.activeTabId]);

  return (
    // Any click in the tab bar (select, close, pin, empty space) should return
    // DOM focus to the active content. Child handlers run first; the rAF in
    // focusActiveContent() defers the focus call until after they settle.
    // The inline rename input stops propagation, so it keeps focus while editing.
    // The bar owns one paper surface, matching the task sidebar panels. Tabs
    // carry no fills — the active tab is marked by text contrast plus an
    // underline drawn inside the strip, just above the bottom border.
    <div
      className="task-tab-bar surface-paper flex h-[41px] shrink-0 items-center border-b border-border bg-(--em-surface)"
      onClick={() => pane.focusActiveContent()}
    >
      {pinnedTab && (
        <div className="flex h-full shrink-0 border-r border-border">{renderTab(pinnedTab)}</div>
      )}
      <div
        ref={scrollContainerRef}
        // Scrolls by trackpad/shift-wheel; a visible bar under the tabs reads as a second underline.
        className="flex h-full w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {scrollingTabs.map(renderTab)}
        {trailingSlot && (
          <div className="em-sticky-cover sticky right-0 z-20 flex h-full shrink-0 items-center bg-(--em-surface) px-1">
            {trailingSlot}
          </div>
        )}
        <PaneDropZone paneId={paneId} />
      </div>
    </div>
  );
});
