import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '../ui/button';

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-install-dismissed') === 'true');
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay());

  const isIos = useMemo(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
      localStorage.setItem('pwa-install-dismissed', 'true');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (dismissed || isStandalone || (!installEvent && !isIos)) {
    return null;
  }

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem('pwa-install-dismissed', 'true');
      setDismissed(true);
    }
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setDismissed(true);
  };

  return (
    <aside className="install-prompt" aria-label="Install DapurNyonya app">
      <div className="install-prompt__copy">
        <p className="install-prompt__title">Install DapurNyonya</p>
        <p className="install-prompt__text">
          {installEvent ? 'Add this app to your device for faster access.' : 'Use Share, then Add to Home Screen.'}
        </p>
      </div>
      {installEvent && (
        <Button size="sm" className="brand-button" onClick={handleInstall}>
          <Download className="h-4 w-4" />
          Install
        </Button>
      )}
      <Button variant="ghost" size="icon" className="install-prompt__close" onClick={handleDismiss} aria-label="Dismiss install prompt">
        <X className="h-4 w-4" />
      </Button>
    </aside>
  );
}
