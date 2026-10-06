'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Pencil } from 'lucide-react';
import { emptyRoom, isPresetRoomId, SANDBOX_LIMITS, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { cn } from '@/ui/cn';
import { Slider } from '@/ui/primitives/Slider';
import { hideSeekSession } from '../../session/HideSeekSession';
import { draftRoom, roomById } from '../../session/sandboxRooms';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { CountStepper } from '../sandbox/CountStepper';
import { RoomEditorDialog } from '../sandbox/editor/RoomEditorDialog';
import { RoomPicker } from '../sandbox/RoomPicker';
import { SandboxRunBar } from '../sandbox/SandboxRunBar';
import { SandboxStatus } from '../sandbox/SandboxStatus';
import { useSandboxPulse } from '../sandbox/useSandboxPulse';

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex h-5 items-center justify-between">
        <h3 className="text-[11px] font-medium text-white/50">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * The Sandbox setup over the viewport: the room (presets, the user's own
 * and a new one), how many hiders and seekers, which generation's champion
 * each team plays, and Run, Pause and Restart. Any change rebuilds the
 * match at once; lesions carry over. The setup folds away to leave only
 * the status and the run controls over the arena.
 */
export function SandboxCard() {
  const mode = useHideSeekLab((s) => s.mode);
  const photo = useHideSeekLab((s) => s.photoMode);
  const sandbox = useHideSeekLab((s) => s.sandbox);
  const records = useHideSeekLab((s) => s.records);
  const setSandbox = useHideSeekLab((s) => s.setSandbox);
  const [editing, setEditing] = useState<{ room: SandboxRoom; saved: boolean } | null>(null);
  // Null follows the inputs overlay: the setup folds while the inputs card stacks above it, so both fit.
  const [unfolded, setUnfolded] = useState<boolean | null>(null);
  const inputsShown = useHideSeekLab((s) => s.inputsOverlay);
  const open = unfolded ?? !inputsShown;
  const pulse = useSandboxPulse();
  if (mode !== 'sandbox' || photo || !records.length) return null;
  const control = hideSeekSession().sandbox;
  const first = records[0].generation;
  const last = records[records.length - 1].generation;
  const room = roomById(sandbox.roomId, sandbox.rooms);
  const preset = isPresetRoomId(room.id);
  const max = SANDBOX_LIMITS.playersPerTeam;

  return (
    <div data-testid="sandbox-card" className="flex w-80 flex-col gap-3 rounded-lg border border-white/10 bg-black/65 p-3 text-white shadow-xl shadow-black/30 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setUnfolded(!open)}
          aria-expanded={open}
          aria-label={open ? 'Fold the Sandbox setup away' : 'Show the Sandbox setup'}
          className="-ml-1 flex items-center gap-1 rounded px-1 text-[11px] font-semibold tracking-wide text-white/60 uppercase transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
          Sandbox
        </button>
        <SandboxStatus pulse={pulse} />
      </div>
      {open && (
        <>
          <Section
            title="Room"
            aside={
              <button
                type="button"
                onClick={() => setEditing({ room: preset ? draftRoom(room) : structuredClone(room), saved: !preset })}
                className="flex items-center gap-1 rounded px-1 text-[11px] text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-3"
              >
                {preset ? <Copy /> : <Pencil />}
                {preset ? 'Edit a copy' : 'Edit room'}
              </button>
            }
          >
            <RoomPicker
              rooms={sandbox.rooms}
              value={sandbox.roomId}
              onPick={(id) => void control?.configure({ roomId: id })}
              onNew={() => setEditing({ room: draftRoom(emptyRoom('', '')), saved: false })}
            />
          </Section>

          <Section title="Players">
            <div className="grid grid-cols-2 gap-1.5">
              <CountStepper label="Hiders" dot="bg-hider" value={sandbox.hiders} min={1} max={max} onChange={(v) => void control?.configure({ hiders: v })} />
              <CountStepper label="Seekers" dot="bg-seeker" value={sandbox.seekers} min={1} max={max} onChange={(v) => void control?.configure({ seekers: v })} />
            </div>
          </Section>

          <Section title="Brains">
            {(['hider', 'seeker'] as const).map((team) => {
              const key = team === 'hider' ? 'hiderGeneration' : 'seekerGeneration';
              return (
                <div key={team} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-white/75">
                      <span className={`size-2 rounded-full ${team === 'hider' ? 'bg-hider' : 'bg-seeker'}`} />
                      {team === 'hider' ? 'Hider' : 'Seeker'} champion from generation
                    </span>
                    <span className="tabular font-mono">{sandbox[key] + 1}</span>
                  </div>
                  <Slider
                    label={`${team} generation`}
                    min={first}
                    max={last}
                    value={sandbox[key]}
                    disabled={first === last}
                    onChange={(v) => setSandbox({ [key]: v })}
                    onCommit={(v) => void control?.configure({ [key]: v })}
                  />
                </div>
              );
            })}
          </Section>
        </>
      )}

      <div className={cn(open && 'border-t border-white/10 pt-3')}>
        <SandboxRunBar control={control} playing={sandbox.playing} pulse={pulse} />
      </div>

      {editing && (
        <RoomEditorDialog
          room={editing.room}
          saved={editing.saved}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            setEditing(null);
            void control?.saveRoom(r);
          }}
          onDelete={(id) => {
            setEditing(null);
            void control?.deleteRoom(id);
          }}
        />
      )}
    </div>
  );
}
