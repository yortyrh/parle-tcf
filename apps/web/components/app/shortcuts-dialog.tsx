'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS } from '@/lib/shortcuts';

/** Lists the session keyboard shortcuts (opened with « ? »). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Raccourcis clavier</DialogTitle>
          <DialogDescription>Actifs pendant la session, hors champs de saisie.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between gap-4">
              <dt>{s.label}</dt>
              <dd>
                <kbd className="bg-muted rounded-md border px-2 py-0.5 font-mono text-xs">
                  {s.key}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
