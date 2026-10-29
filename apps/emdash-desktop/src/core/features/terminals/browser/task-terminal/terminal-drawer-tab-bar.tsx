import { useDraggable } from '@dnd-kit/core';
import type {
  TerminalShellAvailability,
  TerminalShellId,
} from '@emdash/core/primitives/terminal-shell/api';
import { AgentStatus, ScriptStatus, type ScriptStatusKind } from '@emdash/ui/react/components';
import { Button, ContextMenu, DropdownMenu, Tabs, Tooltip } from '@emdash/ui/react/primitives';
import {
  ChevronDown,
  Columns2,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Terminal,
  X,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  TERMINAL_DRAWER_DRAG_TYPE,
  type TerminalDrawerDragData,
} from '@core/features/terminals/api/browser/task-terminal/terminal-drag';
import type { TerminalStore } from '@core/features/terminals/api/browser/task-terminal/terminal-manager';
import { TerminalShellOptionLabel } from '@core/features/terminals/contributions/browser/terminal-shell-option-label';
import {
  type LifecycleScriptStatus,
  type LifecycleScriptsStore,
} from '@core/features/workspaces/api/browser/lifecycle-scripts';
import { projectAvailabilityUi } from '@core/manifests/browser/project-availability-ui';
import { BoundShortcut } from '@core/primitives/keybindings/browser/shortcut';
import { cn } from '@core/primitives/styling/browser/cn';

export type TerminalDrawerMode = 'terminals' | 'scripts' | 'problems';

export type TerminalShellMenuState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error'; message: string }>
  | Readonly<{ kind: 'ready'; availability: TerminalShellAvailability[] }>;

interface TerminalDrawerTabBarProps {
  isFocused: boolean;
  mode: TerminalDrawerMode;
  onModeChange: (mode: TerminalDrawerMode) => void;
  /** Diagnostics count of the task's open files, shown as a badge on the Problems tab. */
  problemCount: number;
  lifecycleScriptsMgr: LifecycleScriptsStore | null;
  activeScriptId: string | undefined;
  onSelectScript: (id: string) => void;
  onRunScript: (id: string) => void;
  onStopScript: (id: string) => void;
  /** Terminals shown in the drawer — the panel filters out those open in a main pane. */
  terminals: TerminalStore[];
  activeTerminalId: string | undefined;
  shellMenuState: TerminalShellMenuState;
  onShellMenuOpen: () => void;
  onRetryShellAvailability: () => void;
  onSelectTerminal: (id: string) => void;
  onAddTerminal: (shell?: TerminalShellId) => void;
  onSplitTerminal: () => void;
  /** Split group of a terminal (just `[id]` when unsplit). */
  splitGroupOf: (id: string) => string[];
  onJoinTerminal: (anchorId: string, otherId: string) => void;
  onUnsplitTerminal: (id: string) => void;
  onRemoveTerminal: (id: string) => void;
  onRenameTerminal: (id: string, name: string) => void;
  onHoverTerminal?: (id: string) => void;
  projectId: string;
  liveActionsDisabled: boolean;
  className?: string;
}

const SCRIPT_STATUS_MAP: Record<LifecycleScriptStatus, ScriptStatusKind> = {
  idle: 'waiting',
  running: 'in-progress',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'cancelled',
};

export const TerminalDrawerTabBar = observer(function TerminalDrawerTabBar({
  isFocused,
  mode,
  onModeChange,
  lifecycleScriptsMgr,
  activeScriptId,
  onSelectScript,
  onRunScript,
  onStopScript,
  terminals,
  activeTerminalId,
  shellMenuState,
  onShellMenuOpen,
  onRetryShellAvailability,
  onSelectTerminal,
  onAddTerminal,
  onSplitTerminal,
  splitGroupOf,
  onJoinTerminal,
  onUnsplitTerminal,
  onRemoveTerminal,
  onRenameTerminal,
  onHoverTerminal,
  projectId,
  liveActionsDisabled,
  problemCount,
  className,
}: TerminalDrawerTabBarProps) {
  const scripts = lifecycleScriptsMgr?.tabs ?? [];
  // One tab per split group (VS Code style), labelled by its first terminal.
  const seen = new Set<string>();
  const groupTabs: { terminal: TerminalStore; group: string[] }[] = [];
  for (const terminal of terminals) {
    if (seen.has(terminal.data.id)) continue;
    const group = splitGroupOf(terminal.data.id);
    for (const id of group) seen.add(id);
    groupTabs.push({ terminal, group });
  }

  return (
    <div
      className={cn('flex h-9 shrink-0 items-center gap-1 overflow-hidden pr-2 text-sm', className)}
    >
      <div
        className="flex h-full min-w-0 flex-1 items-center overflow-x-auto"
        role="tablist"
        aria-label={
          mode === 'terminals' ? 'Terminals' : mode === 'scripts' ? 'Scripts' : 'Problems'
        }
      >
        {mode === 'terminals' ? (
          <>
            {groupTabs.map(({ terminal, group }) => {
              const joinable = groupTabs.filter((tab) => tab.terminal !== terminal);
              const isGroupActive =
                activeTerminalId !== undefined && group.includes(activeTerminalId);
              // Close/rename act on the focused pane when this group is showing.
              const targetId = isGroupActive ? activeTerminalId : terminal.data.id;
              return (
                <ContextMenu.Root key={terminal.data.id}>
                  <ContextMenu.Trigger className="flex h-full shrink-0">
                    <DrawerItemTab
                      id={`terminal-drawer-${terminal.data.id}`}
                      icon={
                        terminals.some((t) => group.includes(t.data.id) && t.isBusy) ? (
                          <AgentStatus status="working" size="0.75rem" />
                        ) : group.length > 1 ? (
                          <Columns2 className="size-3" />
                        ) : (
                          <Terminal className="size-3" />
                        )
                      }
                      label={terminal.data.name}
                      isActive={isGroupActive}
                      isFocused={isFocused}
                      dragData={{
                        type: TERMINAL_DRAWER_DRAG_TYPE,
                        terminalId: terminal.data.id,
                        label: terminal.data.name,
                      }}
                      onSelect={() => {
                        if (!isGroupActive) onSelectTerminal(terminal.data.id);
                      }}
                      onRename={(name) => onRenameTerminal(terminal.data.id, name)}
                      onHover={
                        onHoverTerminal ? () => onHoverTerminal(terminal.data.id) : undefined
                      }
                      action={
                        <Tooltip.Root>
                          <Tooltip.Trigger
                            render={
                              <button
                                type="button"
                                aria-label={`Close ${terminal.data.name}`}
                                className="mr-1 flex size-4 shrink-0 items-center justify-center rounded text-foreground-muted opacity-0 group-hover:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveTerminal(targetId);
                                }}
                              />
                            }
                          >
                            <X className="size-3" />
                          </Tooltip.Trigger>
                          <Tooltip.Content>Close terminal</Tooltip.Content>
                        </Tooltip.Root>
                      }
                    />
                  </ContextMenu.Trigger>
                  <ContextMenu.Content>
                    {group.length > 1 && (
                      <ContextMenu.Item onClick={() => onUnsplitTerminal(targetId)}>
                        <Square className="size-4" />
                        Unsplit{' '}
                        {terminals.find((t) => t.data.id === targetId)?.data.name ?? 'terminal'}
                      </ContextMenu.Item>
                    )}
                    {joinable.length > 0 && (
                      <ContextMenu.Group>
                        <ContextMenu.Label>Join into split</ContextMenu.Label>
                        {joinable.map((other) => (
                          <ContextMenu.Item
                            key={other.terminal.data.id}
                            onClick={() =>
                              onJoinTerminal(
                                group[group.length - 1] ?? terminal.data.id,
                                other.terminal.data.id
                              )
                            }
                          >
                            <Columns2 className="size-4" />
                            {other.terminal.data.name}
                          </ContextMenu.Item>
                        ))}
                      </ContextMenu.Group>
                    )}
                    {(group.length > 1 || joinable.length > 0) && <ContextMenu.Separator />}
                    <ContextMenu.Item
                      variant="destructive"
                      onClick={() => onRemoveTerminal(targetId)}
                    >
                      <X className="size-4" />
                      Close terminal
                    </ContextMenu.Item>
                  </ContextMenu.Content>
                </ContextMenu.Root>
              );
            })}
            <projectAvailabilityUi.LiveActionGuard projectId={projectId}>
              <div className="flex shrink-0 items-center">
                <NewTerminalButton
                  disabled={liveActionsDisabled}
                  shellMenuState={shellMenuState}
                  onShellMenuOpen={onShellMenuOpen}
                  onRetryShellAvailability={onRetryShellAvailability}
                  onAddTerminal={onAddTerminal}
                />
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        disabled={liveActionsDisabled || terminals.length === 0}
                        variant="ghost"
                        size="xs"
                        icon
                        className="size-6 shrink-0 px-0"
                        aria-label="Split terminal"
                        onClick={onSplitTerminal}
                      />
                    }
                  >
                    <Columns2 className="size-3" />
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    Split terminal <BoundShortcut command="workbench.splitPane" variant="keycaps" />
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
            </projectAvailabilityUi.LiveActionGuard>
          </>
        ) : mode === 'scripts' ? (
          scripts.map((script) => (
            <DrawerItemTab
              key={script.data.id}
              id={`script-drawer-${script.data.id}`}
              icon={<ScriptStatus status={SCRIPT_STATUS_MAP[script.status]} size={12} />}
              label={script.data.label}
              isActive={activeScriptId === script.data.id}
              isFocused={isFocused}
              onSelect={() => onSelectScript(script.data.id)}
              iconAction={
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <button
                        type="button"
                        aria-label={
                          script.isRunning
                            ? `Stop ${script.data.label} script`
                            : `Run ${script.data.label} script`
                        }
                        className="flex size-3 items-center justify-center text-foreground-muted hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (script.isRunning) {
                            onStopScript(script.data.id);
                          } else {
                            onRunScript(script.data.id);
                          }
                        }}
                      />
                    }
                  >
                    {script.isRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
                  </Tooltip.Trigger>
                  <Tooltip.Content>{script.isRunning ? 'Stop' : 'Run'}</Tooltip.Content>
                </Tooltip.Root>
              }
            />
          ))
        ) : null}
      </div>
      <div className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <Tabs.Root value={mode} onValueChange={(value) => onModeChange(value as typeof mode)}>
        <Tabs.List>
          <Tabs.Tab value="terminals">Terminals</Tabs.Tab>
          <Tabs.Tab value="scripts">Scripts</Tabs.Tab>
          <Tabs.Tab value="problems">
            Problems
            {problemCount > 0 && (
              <span className="ml-1.5 rounded-full bg-background-3 px-1.5 text-xs tabular-nums">
                {problemCount}
              </span>
            )}
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    </div>
  );
});

export function NewTerminalButton({
  disabled = false,
  shellMenuState,
  onShellMenuOpen,
  onRetryShellAvailability,
  onAddTerminal,
}: {
  disabled?: boolean;
  shellMenuState: TerminalShellMenuState;
  onShellMenuOpen: () => void;
  onRetryShellAvailability: () => void;
  onAddTerminal: (shell?: TerminalShellId) => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Button
              disabled={disabled}
              variant="ghost"
              size="xs"
              icon
              className="size-6 rounded-r-none px-0"
              aria-label="New terminal"
              onClick={() => onAddTerminal()}
            />
          }
        >
          <Plus className="size-3" />
        </Tooltip.Trigger>
        <Tooltip.Content>
          New terminal <BoundShortcut command="task.newTerminal" variant="keycaps" />
        </Tooltip.Content>
      </Tooltip.Root>
      <DropdownMenu.Root onOpenChange={(open) => open && onShellMenuOpen()}>
        <DropdownMenu.Trigger
          render={
            <Button
              disabled={disabled}
              variant="ghost"
              size="xs"
              icon
              className="size-6 rounded-l-none px-0"
              aria-label="New terminal with shell"
            />
          }
        >
          <ChevronDown className="size-3" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" className="w-48">
          {shellMenuState.kind === 'loading' ? (
            <DropdownMenu.Item disabled>
              <LoaderCircle className="animate-spin" />
              Loading shells…
            </DropdownMenu.Item>
          ) : shellMenuState.kind === 'error' ? (
            <DropdownMenu.Item title={shellMenuState.message} onClick={onRetryShellAvailability}>
              <RefreshCw />
              Failed to load shells
            </DropdownMenu.Item>
          ) : shellMenuState.availability.length === 0 ? (
            <DropdownMenu.Item disabled>No shells found</DropdownMenu.Item>
          ) : (
            shellMenuState.availability.map((entry) => (
              <DropdownMenu.Item
                key={entry.id}
                disabled={!entry.available}
                title={entry.reason}
                onClick={() => onAddTerminal(entry.id)}
              >
                <TerminalShellOptionLabel entry={entry} />
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

interface DrawerItemTabProps {
  id: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onRename?: (name: string) => void;
  onHover?: () => void;
  iconAction?: ReactNode;
  action?: ReactNode;
  dragData?: TerminalDrawerDragData;
}

function DrawerItemTab({
  id,
  icon,
  label,
  isActive,
  isFocused,
  onSelect,
  onRename,
  onHover,
  iconAction,
  action,
  dragData,
}: DrawerItemTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id,
    data: dragData,
    disabled: !dragData,
  });

  return (
    <div
      ref={setDragRef}
      className={cn(
        'group relative flex h-full max-w-48 shrink-0 items-center text-xs transition-colors',
        isActive ? 'text-foreground' : 'text-foreground-muted hover:text-foreground',
        isDragging && 'opacity-50'
      )}
    >
      {isActive && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 h-0.5',
            isFocused ? 'bg-(--primary-button-background)' : 'bg-border-1'
          )}
        />
      )}
      {isEditing && onRename ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-3">
          <span className="shrink-0">{icon}</span>
          <InlineRenameInput
            initialValue={label}
            onConfirm={(name) => {
              setIsEditing(false);
              if (name && name !== label) onRename(name);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          role="tab"
          aria-selected={isActive}
          className={cn(
            'flex h-full min-w-0 flex-1 items-center gap-1.5 px-3 outline-none',
            dragData && 'cursor-grab active:cursor-grabbing'
          )}
          onClick={onSelect}
          onMouseEnter={onHover}
          onDoubleClick={(event) => {
            if (!onRename) return;
            event.stopPropagation();
            setIsEditing(true);
          }}
        >
          <span
            className={cn(
              'shrink-0 transition-opacity',
              iconAction && 'group-hover:opacity-0 group-focus-within:opacity-0'
            )}
          >
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </button>
      )}
      {!isEditing && iconAction && (
        <span className="absolute top-1/2 left-3 z-10 flex size-3 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {iconAction}
        </span>
      )}
      {!isEditing && action}
    </div>
  );
}

function InlineRenameInput({
  initialValue,
  onConfirm,
  onCancel,
}: {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="min-w-0 flex-1 rounded border border-border bg-transparent px-1 py-0.5 text-xs text-foreground outline-none"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onConfirm(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onConfirm(value);
        if (event.key === 'Escape') onCancel();
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
