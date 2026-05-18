'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (sessionStorage.getItem('pwa-banner-dismissed')) { setDismissed(true); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem('pwa-banner-dismissed', '1');
    setPrompt(null);
  }

  if (!prompt || dismissed) return null;

  return (
    <div className="pwa-install-banner">
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Install Anex Sales</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>
          Add to home screen for offline access and push notifications
        </div>
      </div>
      <button className="pwa-install-btn" onClick={handleInstall}>Install</button>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}
