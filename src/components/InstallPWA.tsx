import { useState, useEffect } from 'react';
import { Download, X } from '@phosphor-icons/react';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Pokaż banner tylko jeśli użytkownik nie odrzucił wcześniej
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`PWA install outcome: ${outcome}`);
    
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-linear-to-r from-blue-600 to-sky-500 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Zamknij"
        title="Zamknij banner instalacji"
      >
        <X size={20} />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <Download size={32} weight="duotone" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">Zainstaluj MESSU BOUW</h3>
          <p className="text-sm text-white/90 mb-3">
            Dodaj aplikację do ekranu głównego dla szybszego dostępu i pracy offline
          </p>
          <button
            onClick={handleInstall}
            className="w-full bg-white text-blue-600 font-bold py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Zainstaluj teraz
          </button>
        </div>
      </div>
    </div>
  );
}
