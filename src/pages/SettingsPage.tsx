import { useRef, useState } from 'react';
import { Button, Card } from '../components/ui';
import { exportData, importData } from '../data/repo';
import { todayKey } from '../domain/dates';
import { isIOS, isStandalone, useInstallPrompt } from '../hooks/install';
import { updateSettings, useSettings, type Theme } from '../hooks/settings';

function InstallCard() {
  const { available, install } = useInstallPrompt();
  let body;
  if (isStandalone()) {
    body = <p className="text-sm text-muted">Installed. You’re using the app version.</p>;
  } else if (available) {
    body = (
      <>
        <p className="text-sm text-muted">
          Add Habit Tracker to your home screen or dock. It works offline.
        </p>
        <Button variant="primary" onClick={() => void install()}>
          Install app
        </Button>
      </>
    );
  } else if (isIOS()) {
    body = (
      <p className="text-sm text-muted">
        In Safari, tap <strong className="text-fg">Share</strong>, then{' '}
        <strong className="text-fg">Add to Home Screen</strong>.
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-muted">
        Use your browser’s <strong className="text-fg">Install</strong> or{' '}
        <strong className="text-fg">Add to Home Screen</strong> option. It works offline once
        installed.
      </p>
    );
  }
  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">Install</h2>
      {body}
    </Card>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="inline-flex rounded-lg border border-line p-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-md px-3 text-sm ${
              value === o.value ? 'bg-surface-2 font-semibold' : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habit-tracker-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${data.habits.length} habits and ${data.entries.length} entries.`);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await importData(JSON.parse(await file.text()));
      setMessage(
        `Imported ${result.habits} habits and ${result.entries} entries (newer records win).`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>

      <Card className="space-y-5">
        <Segmented<Theme>
          label="Theme"
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Segmented<0 | 1>
          label="First day of the week"
          value={settings.weekStart}
          onChange={(weekStart) => updateSettings({ weekStart })}
          options={[
            { value: 1, label: 'Monday' },
            { value: 0, label: 'Sunday' },
          ]}
        />
      </Card>

      <InstallCard />

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold">Your data</h2>
        <p className="text-sm text-muted">
          Everything is stored on this device and works offline. Export a backup now and then; sync
          across devices comes in a later version.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onExport}>Export JSON</Button>
          <Button onClick={() => fileInput.current?.click()}>Import JSON</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onImport(e.target.files?.[0])}
            data-testid="import-input"
          />
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </Card>
    </div>
  );
}
