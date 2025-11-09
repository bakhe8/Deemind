import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

type Props = {
  onPick?: (files: FileList | null) => void;
  busy?: boolean;
};

export default function FileDropZone({ onPick, busy = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length || busy) return;
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onPick?.(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer?.files || null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.currentTarget === event.target) {
      setDragging(false);
    }
  };

  const stateClasses = dragging
    ? 'border-primary bg-primary/5 text-primary'
    : 'border-slate-300 text-slate-700';

  return (
    <div
      className={`border-2 border-dashed rounded-2xl bg-white p-6 text-center cursor-pointer transition ${
        stateClasses
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
      onClick={() => (!busy ? inputRef.current?.click() : undefined)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="text-xl font-semibold">{busy ? 'Uploading theme…' : 'Drop your theme archive or click to select'}</p>
      <p className="text-sm text-slate-500">
        Use a .zip export of your prototype; Deemind will unpack it into /input.
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={busy}
        accept=".zip"
      />
    </div>
  );
}
