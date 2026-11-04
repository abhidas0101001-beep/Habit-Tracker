import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Toasts for "ready to work offline" and "new version available". */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  // "Ready to work offline" is just information: hide it after a few seconds.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;
  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-xl md:bottom-6"
    >
      <p className="flex-1 text-sm">
        {needRefresh ? 'A new version is available.' : 'Ready to work offline.'}
      </p>
      {needRefresh && (
        <Button
          variant="primary"
          className="min-h-9"
          onClick={() => void updateServiceWorker(true)}
        >
          Update
        </Button>
      )}
      <Button variant="ghost" className="min-h-9" onClick={close}>
        {needRefresh ? 'Later' : 'OK'}
      </Button>
    </div>
  );
}
