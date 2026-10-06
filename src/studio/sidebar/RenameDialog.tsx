'use client';

import { useState } from 'react';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { Field, TextInput } from '@/ui/primitives/Field';

interface Props {
  name: string;
  onClose: () => void;
  onRename: (name: string) => void;
}

/** Asks for a new script name. Mounted only while open, so it starts from the current name each time. */
export function RenameDialog({ name, onClose, onRename }: Props) {
  const [value, setValue] = useState(name);
  const valid = value.trim().length > 0;
  const submit = () => {
    if (!valid) return;
    onRename(value.trim());
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Rename script"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            Rename
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name">
          <TextInput autoFocus value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
