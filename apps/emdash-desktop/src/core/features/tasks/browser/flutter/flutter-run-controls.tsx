import { Button, DropdownMenu, Tooltip } from '@emdash/ui/react/primitives';
import { Loader2, Play, RotateCcw, Square } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useTaskViewContext } from '@core/features/tasks/contributions/browser/task-view-context';
import {
  usePreviewServers,
  useTerminals,
  useWorkspaceId,
} from '@core/features/workbench/api/browser/task-composition-context';
import { log } from '@core/primitives/logging/browser/logger';
import { cn } from '@core/primitives/styling/browser/cn';
import { getFlutterRunner, type FlutterRunTarget } from './flutter-runner';

/** Run / Stop / Hot Restart buttons for Flutter workspaces; DevTools shows up as a preview pill. */
export const FlutterRunControls = observer(function FlutterRunControls() {
  const { projectId, taskId } = useTaskViewContext();
  const runner = getFlutterRunner(
    projectId,
    taskId,
    useWorkspaceId(),
    useTerminals(),
    usePreviewServers()
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    runner.detectFlutter().catch((error) => log.warn('Flutter detection failed', { error }));
  }, [runner]);

  if (!runner.isFlutter) return null;

  const state = runner.state;
  const run = (target: FlutterRunTarget) => {
    setPickerOpen(false);
    runner.run(target).catch((error) => log.warn('Flutter run failed', { error }));
  };
  const openPicker = (open: boolean) => {
    setPickerOpen(open);
    if (!open) return;
    runner.refreshTargets().catch((error) => log.warn('Listing Flutter devices failed', { error }));
  };

  if (state === 'starting' || state === 'running') {
    return (
      <div className="flex items-center gap-1">
        <IconButton
          label={state === 'starting' ? 'Cancel build' : 'Stop'}
          className="group"
          onClick={() => void runner.stop()}
        >
          {state === 'starting' && (
            <Loader2 className="size-3.5 animate-spin text-foreground-muted group-hover:hidden" />
          )}
          <Square
            className={cn(
              'size-3.5 text-foreground-destructive',
              state === 'starting' && 'hidden group-hover:block'
            )}
          />
        </IconButton>
        <IconButton
          label="Hot Restart"
          disabled={state !== 'running'}
          onClick={() => void runner.hotRestart()}
        >
          <RotateCcw className="size-3.5 text-foreground-success" />
        </IconButton>
      </div>
    );
  }

  const busy = state === 'busy';
  const targets = runner.targets;
  const lastDevice = runner.lastDevice;
  // Last-used device first, so re-running stays at the top of the list.
  const devices = targets
    ? [...targets.devices].sort(
        (a, b) => Number(b.id === lastDevice?.id) - Number(a.id === lastDevice?.id)
      )
    : [];
  return (
    <div className="flex items-center">
      <DropdownMenu.Root open={pickerOpen} onOpenChange={openPicker}>
        <DropdownMenu.Trigger
          aria-label="Run on a device"
          disabled={busy}
          className="flex size-7 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-1 hover:text-foreground disabled:opacity-50"
        >
          <Play className="size-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content width="content" align="end" className="min-w-56">
          {!targets ? (
            <DropdownMenu.Group>
              <DropdownMenu.Label>Loading devices…</DropdownMenu.Label>
            </DropdownMenu.Group>
          ) : (
            <>
              <DropdownMenu.Group>
                <DropdownMenu.Label>Devices</DropdownMenu.Label>
                {targets.devices.length === 0 && (
                  <DropdownMenu.Label>No running devices</DropdownMenu.Label>
                )}
                {devices.map((device) => (
                  <DropdownMenu.Item
                    key={device.id}
                    onClick={() => run({ kind: 'device', device })}
                  >
                    <Play className="size-3.5" />
                    {device.name}
                    <DropdownMenu.Shortcut>{device.platform}</DropdownMenu.Shortcut>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Group>
              {targets.emulators.length > 0 && (
                <>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Group>
                    <DropdownMenu.Label>Offline emulators</DropdownMenu.Label>
                    {targets.emulators.map((emulator) => (
                      <DropdownMenu.Item
                        key={emulator.id}
                        onClick={() => run({ kind: 'emulator', emulator })}
                      >
                        <Play className="size-3.5" />
                        Start {emulator.name}
                        <DropdownMenu.Shortcut>{emulator.platform}</DropdownMenu.Shortcut>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Group>
                </>
              )}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
});

function IconButton({
  label,
  className,
  disabled,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  disabled?: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Button
          variant="ghost"
          size="xs"
          className={className}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}
