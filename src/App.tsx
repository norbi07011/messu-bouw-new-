import { useState } from 'react';
import { Toaster } from 'sonner';
import './i18n';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FileText, Users, Package, ChartBar, Gear, Download, DeviceMobile, Car, Receipt, Clock, File } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AudioProvider } from '@/contexts/AudioContext';
import { AudioToggle } from '@/components/AudioToggle';
import { Timesheets } from '@/pages/Timesheets';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Kilometers from './pages/Kilometers';
import { BTWAangifte } from './pages/BTWAangifte';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents.tsx';

type Page = 'reports' | 'invoices' | 'invoices-new' | 'clients' | 'products' | 'expenses' | 'kilometers' | 'timesheets' | 'btw' | 'settings' | 'documents';

function App() {
  return (
    <ThemeProvider>
      <AudioProvider>
        <AppContent />
      </AudioProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<Page>('reports');

  // Download handlers
  const handleDownloadDesktop = async () => {
    console.log('Desktop download clicked');
    
    try {
      // Sprawdź czy jesteśmy w Electron app
      if (window.electronAPI?.build?.createInstaller) {
        console.log('Creating installer via Electron...');
        toast.success('🔧 Tworzenie installer Windows...', {
          description: 'Proszę czekać, to może potrwać kilka minut...'
        });
        
        try {
          const success = await window.electronAPI.build.createInstaller();
          if (success) {
            toast.success('✅ Installer utworzony!', {
              description: 'Sprawdź folder release/ - tam jest plik .exe do instalacji'
            });
            
            // Automatycznie otwórz folder z instalatorem
            if (window.electronAPI.build.openInstallerFolder) {
              await window.electronAPI.build.openInstallerFolder();
            }
          } else {
            throw new Error('Installer creation failed');
          }
        } catch (error) {
          console.error('Installer creation error:', error);
          toast.error('❌ Błąd tworzenia installer', {
            description: 'Spróbuj ponownie lub skontaktuj się z pomocą techniczną'
          });
        }
        return;
      }
      
      // Jeśli nie ma Electron API, przekieruj do gotowej aplikacji
      console.log('No Electron API, offering direct download...');
      
      // Sprawdź czy jest dostępny gotowy installer w folderze release
      const downloadUrl = window.location.origin + '/release/MESSU-BOUW-Setup.exe';
      
      try {
        const response = await fetch(downloadUrl, { method: 'HEAD' });
        if (response.ok) {
          // Jest gotowy installer - pobierz go
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = 'MESSU-BOUW-Setup.exe';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast.success('📦 Pobieranie installer...', {
            description: 'Plik MESSU-BOUW-Setup.exe zostanie pobrany'
          });
          return;
        }
      } catch (e) {
        console.log('No installer available, creating instructions');
      }
      
      // Fallback - stwórz instrukcje instalacji
      const instructionsText = `🚀 MESSU BOUW - Gotowa Aplikacja Desktop

SPOSÓB 1 - SZYBKA INSTALACJA (Zalecany):
================================
1. Pobierz Node.js: https://nodejs.org/ (wybierz LTS)
2. Rozpakuj folder aplikacji MESSU BOUW 
3. Kliknij prawym na folder → "Otwórz w terminalu"
4. Wpisz: npm install (poczekaj na instalację)
5. Wpisz: npm run dist
6. W folderze release/ znajdziesz MESSU-BOUW-Setup.exe
7. Uruchom installer i gotowe!

SPOSÓB 2 - BEZPOŚREDNIE URUCHOMIENIE:
===================================
1. Po instalacji Node.js i npm install
2. Wpisz: npm run electron:dev
3. Aplikacja uruchomi się od razu

📋 WYMAGANIA:
- Windows 10/11
- Node.js 18+ (https://nodejs.org/)
- 4GB RAM, 2GB wolnego miejsca

🔄 SYNCHRONIZACJA DANYCH:
- Wszystkie dane zapisywane lokalnie w SQLite
- Automatyczny backup co tydzień
- Export/Import do przenoszenia między komputerami
- Folder danych: Documents/MESSU BOUW/

💡 WAŻNE:
Po instalacji aplikacja działa całkowicie OFFLINE!
Nie potrzebuje internetu do działania.

Adres lokalny: http://localhost:5002/
Adres sieciowy: http://192.168.178.75:5002/

🆘 POMOC: norbs.support@email.com`;

      // Pobierz instrukcje
      const blob = new Blob([instructionsText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'NORBS-Faktur-Instalacja-Desktop.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('📁 Instrukcje pobrane!', {
        description: 'Sprawdź plik w Downloads - dokładne kroki instalacji'
      });
      
    } catch (error) {
      console.error('Desktop download error:', error);
      toast.error('❌ Błąd pobierania', {
        description: 'Spróbuj ponownie lub skontaktuj się z pomocą'
      });
    }
  };

  const handleDownloadMobile = async () => {
    console.log('Mobile download clicked');
    
    try {
      // Automatycznie wykryj adres sieciowy
      let networkUrl = 'http://192.168.178.75:5002/';
      
      // Spróbuj pobrać aktualny IP z Electron
      if (window.electronAPI?.getNetworkAddress) {
        try {
          const ipAddress = await window.electronAPI.getNetworkAddress();
          networkUrl = `http://${ipAddress}:5002/`;
          console.log('Got network IP from Electron:', ipAddress);
        } catch (e) {
          console.log('Failed to get IP from Electron, using fallback');
        }
      }
      
      // Skopiuj adres do schowka
      try {
        if (window.electronAPI?.copyToClipboard) {
          await window.electronAPI.copyToClipboard(networkUrl);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(networkUrl);
        } else {
          // Fallback dla starszych przeglądarek
          const textArea = document.createElement('textarea');
          textArea.value = networkUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        
        // Stwórz szczegółowe instrukcje dla telefonu
        const mobileInstructions = `📱 MESSU BOUW - Aplikacja na Telefon

🎯 SZYBKA INSTALACJA (3 kroki):
==============================

1️⃣ OTWÓRZ W PRZEGLĄDARCE TELEFONU:
   ${networkUrl}
   (Telefon musi być w tej samej sieci Wi-Fi!)

2️⃣ ZAINSTALUJ JAKO APLIKACJĘ:
   
   📱 ANDROID:
   - Kliknij ⋮ (3 kropki) w prawym górnym rogu
   - Wybierz "Dodaj do ekranu głównego" lub "Zainstaluj aplikację"
   - Potwierdź instalację
   
   🍎 iPhone/iPad:
   - Kliknij przycisk "Udostępnij" 📤 
   - Wybierz "Dodaj do ekranu głównego"
   - Kliknij "Dodaj"

3️⃣ GOTOWE! 
   Aplikacja będzie na ekranie głównym jak normalna app!

🔄 SYNCHRONIZACJA DANYCH:
- Dane zapisywane lokalnie w przeglądarce telefonu
- Możliwość eksportu/importu między urządzeniami
- Backup do chmury (opcjonalnie)

💡 WSKAZÓWKI:
- Aplikacja działa OFFLINE po pierwszym załadowaniu
- Wygląda i działa jak natywna aplikacja
- Powiadomienia i skróty klawiszowe
- Pełna funkcjonalność fakturowania

🌐 DOSTĘP Z PRACY:
Żeby używać z pracy, możesz:
1. Hostować na serwerze firmowym
2. Używać VPN do domu  
3. Eksportować/importować dane przez email

⚠️ BEZPIECZEŃSTWO:
- Wszystkie dane lokalnie na telefonie
- Bez wysyłania do internetu
- Szyfrowanie bazy danych

🆘 POMOC: support@messubouw.com`;

        // Pobierz instrukcje mobilne
        const blob = new Blob([mobileInstructions], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'MESSU-BOUW-Telefon-Instrukcje.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success('📱 Adres skopiowany + instrukcje pobrane!', {
          description: `${networkUrl} - Otwórz w przeglądarce telefonu i zainstaluj jako app`
        });
        
        // Dodatkowo otwórz QR kod w nowym oknie
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(networkUrl)}&format=png&margin=20`;
        const qrWindow = window.open(qrUrl, '_blank', 'width=500,height=600,scrollbars=yes');
        
        // Dodaj instrukcje do okna QR
        if (qrWindow) {
          qrWindow.document.title = 'MESSU BOUW - QR Code';
          setTimeout(() => {
            if (qrWindow && !qrWindow.closed) {
              qrWindow.document.body.innerHTML = `
                <div style="text-align: center; font-family: Arial; padding: 20px;">
                  <h2>📱 MESSU BOUW - Zainstaluj na telefonie</h2>
                  <img src="${qrUrl}" alt="QR Code" style="max-width: 400px; border: 2px solid #ccc; border-radius: 10px;"/>
                  <h3>Instrukcje:</h3>
                  <ol style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <li>Zeskanuj QR kod telefonem</li>
                    <li>Otwórz link w przeglądarce</li>
                    <li>Kliknij "Dodaj do ekranu głównego"</li>
                    <li>Gotowe - masz aplikację!</li>
                  </ol>
                  <p><strong>Adres:</strong> <code>${networkUrl}</code></p>
                  <p><em>Telefon musi być w tej samej sieci Wi-Fi</em></p>
                </div>`;
            }
          }, 1000);
        }
        
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        // Jeśli kopiowanie się nie uda, pokaż adres w alertcie
        alert(`📱 Skopiuj ten adres i wklej w przeglądarce telefonu:\n\n${networkUrl}\n\n✅ INSTRUKCJE:\n1. Otwórz link w przeglądarce telefonu\n2. Kliknij "Dodaj do ekranu głównego"\n3. Potwierdź instalację\n4. Gotowe - masz aplikację!\n\n(Telefon musi być w tej samej sieci Wi-Fi)`);
      }
      
    } catch (error) {
      console.error('Mobile download error:', error);
      toast.error('❌ Błąd', {
        description: 'Nie udało się przygotować instalacji mobilnej'
      });
    }
  };

  const navItems = [
    { id: 'reports' as Page, icon: ChartBar, label: t('nav.reports') },
    { id: 'invoices' as Page, icon: FileText, label: t('nav.invoices') },
    { id: 'documents' as Page, icon: File, label: '📄 Dokumenty' },
    { id: 'clients' as Page, icon: Users, label: t('nav.clients') },
    { id: 'products' as Page, icon: Package, label: t('nav.products') },
    { id: 'expenses' as Page, icon: Receipt, label: t('nav.expenses') },
    { id: 'kilometers' as Page, icon: Car, label: t('nav.kilometers') },
    { id: 'timesheets' as Page, icon: Clock, label: 'Godziny Pracy' },
    { id: 'btw' as Page, icon: ChartBar, label: t('nav.btw') },
    { id: 'settings' as Page, icon: Gear, label: t('nav.settings') },
  ];

  const renderPage = () => {
    const handleNavigate = (page: string) => setCurrentPage(page as Page);
    
    switch (currentPage) {
      case 'reports':
        return <Reports />;
      case 'invoices':
        return <Invoices onNavigate={handleNavigate} />;
      case 'invoices-new':
        return <InvoiceForm onNavigate={handleNavigate} />;
      case 'documents':
        return <Documents />;
      case 'clients':
        return <Clients />;
      case 'products':
        return <Products />;
      case 'expenses':
        return <Expenses />;
      case 'kilometers':
        return <Kilometers />;
      case 'timesheets':
        return <Timesheets />;
      case 'btw':
        return <BTWAangifte />;
      case 'settings':
        return <Settings />;
      default:
        return <Reports />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-sky-50 via-blue-50 to-sky-100 dark:bg-black transition-colors duration-300">
      <div className="flex gap-6 p-6">
        <aside className="premium-card w-72 h-fit bg-white/95 dark:bg-black/95 backdrop-blur-md sticky top-6 self-start">
          {/* Logo Section with Audio Toggle */}
          <div className="p-6 border-b-2 border-sky-300 dark:border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-sky-400 dark:border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] dark:shadow-[0_0_20px_rgba(59,130,246,0.6)]">
                  <img 
                    src="/messu-bouw-logo.jpg" 
                    alt="MESSU BOUW" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">MESSU BOUW</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Invoice Management System</p>
                </div>
              </div>
              {/* Audio Toggle - moved from header */}
              <AudioToggle />
            </div>
          </div>
          <nav className="px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id || 
                (item.id === 'invoices' && currentPage === 'invoices-new');
              return (
                <button
                  key={item.id}
                  className={`premium-button w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 text-left font-medium rounded-xl ${
                    isActive 
                      ? 'bg-linear-to-r from-sky-500 to-blue-600 dark:from-blue-500 dark:to-blue-600 text-white shadow-[0_4px_20px_rgba(59,130,246,0.5)] dark:shadow-[0_8px_30px_rgba(59,130,246,0.8),0_4px_15px_rgba(59,130,246,0.6)]' 
                      : 'text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-black/50 hover:bg-sky-50 dark:hover:bg-black/70 hover:text-sky-700 dark:hover:text-blue-400'
                  }`}
                  onClick={() => setCurrentPage(item.id)}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          {renderPage()}
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;