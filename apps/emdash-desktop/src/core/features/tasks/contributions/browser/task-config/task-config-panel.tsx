import { Tabs } from '@emdash/ui/react/primitives';
import { useState } from 'react';
import { cn } from '@core/primitives/styling/browser/cn';

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface TaskConfigPanelProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function TaskConfigPanel({ tabs, defaultTab }: TaskConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.value ?? '');

  return (
    <div className="flex flex-col gap-2">
      <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(String(value))}>
        <Tabs.List>
          {tabs.map(({ value, label }, index) => (
            // Flat tabs: drop the first tab's inset so its label lines up with field labels.
            <Tabs.Tab
              key={value}
              value={value}
              className={cn('text-sm! font-normal!', index === 0 && 'pl-0!')}
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {tabs.map(({ value, content }) => (
          <Tabs.Panel key={value} value={value} keepMounted>
            {content}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </div>
  );
}
