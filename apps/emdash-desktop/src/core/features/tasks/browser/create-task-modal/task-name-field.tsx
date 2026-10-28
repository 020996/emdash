import { Field, Input } from '@emdash/ui/react/primitives';
import { useState } from 'react';
import { type TaskNameState } from '@core/features/tasks/api/browser/create-task-modal/use-task-name';

interface TaskNameFieldProps {
  state: TaskNameState;
}

export function TaskNameField({ state }: TaskNameFieldProps) {
  const { taskName, placeholder, handleTaskNameChange, showSlugHint, readOnly } = state;
  const [edited, setEdited] = useState(false);

  return (
    <Field.Root className="flex flex-col gap-1">
      <Input
        aria-label="Task name"
        bare
        autoFocus
        // The generated name starts as a real, editable value. Once edited the field shows exactly
        // what was typed; an emptied field falls back to the generated name (shown as the hint).
        value={readOnly ? placeholder : edited ? taskName : taskName || placeholder}
        readOnly={readOnly}
        placeholder={placeholder || 'Task name...'}
        className="px-0 text-lg!"
        onChange={(e) => {
          setEdited(true);
          handleTaskNameChange(e.target.value);
        }}
      />
      {showSlugHint && (
        <p className="text-muted-foreground mt-1 text-xs">
          Task names only allow letters, numbers, and hyphens.
        </p>
      )}
    </Field.Root>
  );
}
