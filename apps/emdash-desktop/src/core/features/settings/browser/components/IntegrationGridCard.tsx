import { Tooltip } from '@emdash/ui/react/primitives';
import { card } from '@emdash/ui/styles/recipes/card';
import { CircleAlert } from 'lucide-react';
import { IntegrationIcon } from '@core/features/integrations/contributions/browser/integration-icon';
import { cn } from '@core/primitives/styling/browser/cn';
import type { IntegrationItem } from './IntegrationsCard';

export function IntegrationGridCard({
  integration,
  selected,
  onSelect,
}: {
  integration: IntegrationItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex h-full min-h-0">
      <button
        type="button"
        onClick={onSelect}
        data-selected={selected || undefined}
        // Same card surface as the rest of Settings, so themes and glass treat it alike.
        className={cn(
          card({ level: 'base', radius: 'lg', padding: 'lg', interactive: true }),
          'group relative flex w-full items-center gap-4 text-left text-card-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background-2 transition-colors group-hover:bg-background-3">
          <IntegrationIcon provider={integration.id} icon={integration.icon} size={32} />
        </span>
        <span
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-0.5',
            integration.connectionError && 'pr-6'
          )}
        >
          <span className="text-sm font-medium text-foreground">{integration.name}</span>
          <span className="truncate text-sm text-foreground-muted">{integration.description}</span>
        </span>
        {integration.connectionError && (
          <ConnectionIssueIndicator
            providerName={integration.name}
            error={integration.connectionError}
          />
        )}
      </button>
    </div>
  );
}

export function ConnectionIssueIndicator({
  providerName,
  error,
}: {
  providerName: string;
  error: string;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <span
            className="text-destructive absolute top-3 right-3 inline-flex h-5 w-5 items-center justify-center rounded-full"
            aria-label={`${providerName} connection issue`}
          >
            <CircleAlert className="h-4 w-4" />
          </span>
        }
      />
      <Tooltip.Content side="top">{error || 'Connection issue'}</Tooltip.Content>
    </Tooltip.Root>
  );
}
