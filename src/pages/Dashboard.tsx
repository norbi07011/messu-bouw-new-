import { useTranslation } from 'react-i18next';
import { useInvoices, useClients } from '@/hooks/useElectronDB';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Users, Package, ChartBar, Download, DeviceMobile } from '@phosphor-icons/react';
import { Invoice, Client } from '@/types';
import { formatCurrency, formatDate } from '@/lib/invoice-utils';
import { useMemo } from 'react';
import { toast } from 'sonner';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { t, i18n } = useTranslation();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { clients, loading: clientsLoading } = useClients();

  // Download handlers (same as in App.tsx)
  const handleDownloadDesktop = async () => {
    try {
      // Próbuj pobrać gotowy installer
      const installerUrl = '/MESSU-BOUW-Simple-Installer.zip';
      
      const link = document.createElement('a');
      link.href = installerUrl;
      link.download = 'MESSU-BOUW-Simple-Installer.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('🎯 Pobieranie instalatora Windows...', {
        description: 'Rozpakuj ZIP i uruchom INSTALL.bat jako administrator'
      });
      
    } catch (error) {
      console.error('Download error:', error);
      
      // Fallback - instrukcje tekstowe
      const instructionsText = `MESSU BOUW - Instrukcje Instalacji
      
🚀 GOTOWY INSTALLER:
1. Pobierz: MESSU-BOUW-Simple-Installer.zip
2. Rozpakuj ZIP 
3. Uruchom INSTALL.bat jako administrator
4. Postępuj zgodnie z instrukcjami
5. Aplikacja zostanie zainstalowana w C:\\MESSU-BOUW\\

📋 WYMAGANIA:
- Windows 10/11
- Uprawnienia administratora
- 500MB wolnego miejsca

💾 RĘCZNA INSTALACJA (jeśli installer nie działa):
1. Pobierz i zainstaluj Node.js: https://nodejs.org/
2. Rozpakuj folder aplikacji 
3. Otwórz folder w Terminal/PowerShell jako administrator
4. Wpisz: npm install
5. Wpisz: npm run electron
6. Aplikacja się uruchomi!

📞 POMOC TECHNICZNA:
Email: support@messubouw.com

Wersja: 1.0.0 (Build: ${new Date().toISOString().split('T')[0]})`;

      const blob = new Blob([instructionsText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'MESSU-BOUW-Instrukcje.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('📁 Instrukcje pobrane!', {
        description: 'Sprawdź plik w Downloads'
      });
    }
  };

  const handleDownloadMobile = async () => {
    try {
      let networkUrl = 'http://192.168.178.75:5002/';
      
      if (window.electronAPI?.getNetworkAddress) {
        try {
          const ipAddress = await window.electronAPI.getNetworkAddress();
          networkUrl = `http://${ipAddress}:5002/`;
        } catch (e) {
          // Use fallback
        }
      }
      
      // Copy to clipboard
      try {
        if (window.electronAPI?.copyToClipboard) {
          await window.electronAPI.copyToClipboard(networkUrl);
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(networkUrl);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = networkUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        
        toast.success('📱 Adres skopiowany!', {
          description: `${networkUrl} - Wklej w przeglądarce telefonu`
        });
        
        // Open QR code
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(networkUrl)}&format=png`;
        window.open(qrUrl, '_blank', 'width=400,height=400');
        
      } catch (clipboardError) {
        alert(`📱 Skopiuj ten adres i wklej w przeglądarce telefonu:\n\n${networkUrl}`);
      }
      
    } catch (error) {
      toast.error('❌ Błąd');
    }
  };

  const stats = useMemo(() => {
    if (invoicesLoading || !invoices) return {
      unpaid: 0,
      thisMonth: 0,
      thisYear: 0,
      totalInvoices: 0,
    };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const unpaidTotal = invoices
      ?.filter(inv => inv.status === 'unpaid')
      .reduce((sum, inv) => sum + inv.total_gross, 0) || 0;

    const thisMonthTotal = invoices
      ?.filter(inv => {
        const date = new Date(inv.issue_date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + inv.total_gross, 0) || 0;

    const thisYearTotal = invoices
      ?.filter(inv => {
        const date = new Date(inv.issue_date);
        return date.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + inv.total_gross, 0) || 0;

    return {
      unpaid: unpaidTotal,
      thisMonth: thisMonthTotal,
      thisYear: thisYearTotal,
      totalInvoices: invoices?.length || 0,
    };
  }, [invoices, invoicesLoading]);

  const recentInvoices = useMemo(() => {
    return (invoices || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [invoices]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      unpaid: 'destructive',
      partial: 'secondary',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{t(`invoices.${status}`)}</Badge>;
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
      {/* Background Logo */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
        <img 
          src="/messu-bouw-logo.jpg" 
          alt="MESSU BOUW" 
          className="max-w-2xl max-h-2xl object-contain"
        />
      </div>
      
      <div className="max-w-7xl mx-auto p-6 space-y-8 relative z-10">
        {/* ★★★★★ CZARNE FALE MORSKIE - WYRAŹNY EFEKT WODY ★★★★★ */}
        <div className="premium-border-animated relative overflow-hidden rounded-3xl shadow-2xl animate-slide-up transition-all duration-500 hover:scale-[1.01]" style={{height: '280px'}}>
          
          {/* TŁO - głęboki ocean */}
          <div className="absolute inset-0 bg-linear-to-b from-slate-950 via-black to-slate-900"></div>
          
          {/* FALA 1 - najgłębsza (ciemna) */}
          <div 
            className="absolute inset-x-0 bottom-0 h-full opacity-50"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(255,255,255,0.03) 80px, rgba(255,255,255,0.03) 160px)',
              animation: 'ocean-wave 25s linear infinite'
            }}
          >
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 30%, rgba(30,30,30,0.9) 70%, rgba(0,0,0,1) 100%)'
            }}></div>
          </div>
          
          {/* FALA 2 - średnia (jasniejsza linia) */}
          <div 
            className="absolute inset-x-0 bottom-0 h-3/4 opacity-40"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(255,255,255,0.08) 60px, rgba(255,255,255,0.08) 120px)',
              animation: 'ocean-wave 20s linear infinite reverse',
              animationDelay: '-5s'
            }}
          >
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom, transparent 0%, rgba(40,40,40,0.6) 40%, rgba(20,20,20,0.8) 100%)'
            }}></div>
          </div>
          
          {/* FALA 3 - płytka (najbardziej widoczne linie) */}
          <div 
            className="absolute inset-x-0 bottom-0 h-1/2 opacity-60"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.12) 40px, rgba(255,255,255,0.12) 80px)',
              animation: 'ocean-wave 15s linear infinite',
              animationDelay: '-10s'
            }}
          >
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom, transparent 20%, rgba(60,60,60,0.5) 60%, rgba(30,30,30,0.7) 100%)'
            }}></div>
          </div>
          
          {/* ŚWIETLISTE LINIE FALI - wyraźne białe paski */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/3 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-white/30 to-transparent" style={{animation: 'ocean-wave 18s ease-in-out infinite'}}></div>
            <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-linear-to-r from-transparent via-white/40 to-transparent" style={{animation: 'ocean-wave 15s ease-in-out infinite reverse', animationDelay: '-3s'}}></div>
            <div className="absolute top-2/3 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-white/25 to-transparent" style={{animation: 'ocean-wave 20s ease-in-out infinite', animationDelay: '-7s'}}></div>
          </div>
          
          {/* BĄBELKI POWIETRZA - pływające w górę */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute bottom-0 bg-white/20 rounded-full border border-white/20"
                style={{
                  left: `${5 + i * 8}%`,
                  width: `${6 + Math.random() * 12}px`,
                  height: `${6 + Math.random() * 12}px`,
                  animation: `water-bubble ${7 + Math.random() * 5}s ease-in infinite`,
                  animationDelay: `${i * 0.8}s`,
                  boxShadow: 'inset -2px -2px 4px rgba(255,255,255,0.3)'
                }}
              ></div>
            ))}
          </div>
          
          {/* PROMIENIE ŚWIATŁA POD WODĄ - pionowe */}
          <div className="absolute inset-0 opacity-15">
            <div className="absolute top-0 left-[20%] w-[3px] h-full bg-linear-to-b from-white/60 via-white/20 to-transparent" style={{animation: 'pulse-soft 4s ease-in-out infinite'}}></div>
            <div className="absolute top-0 left-[45%] w-[2px] h-full bg-linear-to-b from-white/40 via-white/10 to-transparent" style={{animation: 'pulse-soft 5s ease-in-out infinite', animationDelay: '1s'}}></div>
            <div className="absolute top-0 left-[70%] w-[3px] h-full bg-linear-to-b from-white/50 via-white/15 to-transparent" style={{animation: 'pulse-soft 6s ease-in-out infinite', animationDelay: '2s'}}></div>
          </div>
          
          {/* TEKST NA OCEANIE - wyraźnie nad wodą */}
          <div className="relative h-full flex flex-col items-center justify-center text-center px-8 z-20">
            <h1 className="text-6xl font-black mb-4 text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)] tracking-tight" style={{textShadow: '0 0 40px rgba(255,255,255,0.8), 0 4px 20px rgba(0,0,0,1)'}}>
              🎯 Panel główny
            </h1>
            <p className="text-2xl text-white font-bold drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)] tracking-wide" style={{textShadow: '0 0 20px rgba(255,255,255,0.6), 0 2px 10px rgba(0,0,0,1)'}}>
              Profesjonalny system zarządzania finansami
            </p>
            
            {/* PRZYCISK - płynie nad falami */}
            <button 
              onClick={() => onNavigate('invoices-new')}
              className="mt-8 group relative px-10 py-5 bg-white text-black rounded-2xl font-black text-xl shadow-2xl overflow-hidden transition-all duration-500 hover:scale-110 hover:shadow-[0_20px_80px_rgba(255,255,255,0.6)]"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-black/20 to-transparent"></div>
              <span className="relative flex items-center gap-3">
                <Plus size={28} weight="bold" />
                Nowa faktura
              </span>
            </button>
          </div>
          
          {/* ODBLASKI NA POWIERZCHNI - górna krawędź oceanu */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-white/50 to-transparent"></div>
          <div className="absolute top-1 left-0 right-0 h-[1px] bg-linear-to-r from-transparent via-white/30 to-transparent"></div>
        </div>

        {/* Download Cards - ORYGINALNY STYL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up" style={{animationDelay: '0.1s'}}>
          <div className="relative group overflow-hidden rounded-2xl bg-linear-to-br from-sky-500 to-blue-600 p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent"></div>
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Download size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">💻 Pobierz na komputer</h3>
                  <p className="text-sky-100">{t('dashboard.desktopApp')}</p>
                </div>
              </div>
              <button
                onClick={handleDownloadDesktop}
                className="w-full py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl hover:bg-white/30 transition-all duration-300 font-semibold"
              >
                Pobierz teraz
              </button>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          </div>

          <div className="relative group overflow-hidden rounded-2xl bg-linear-to-br from-blue-500 to-sky-600 p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent"></div>
            <div className="relative">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                  <DeviceMobile size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">📱 Pobierz na telefon</h3>
                  <p className="text-blue-100">{t('dashboard.copyAddress')}</p>
                </div>
              </div>
              <button
                onClick={handleDownloadMobile}
                className="w-full py-4 bg-white/25 backdrop-blur-md border-2 border-white/40 rounded-2xl hover:bg-white/35 hover:border-white/60 transition-all duration-500 font-bold text-lg shadow-2xl group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
              >
                <span className="drop-shadow-lg">{t('dashboard.copyAddress')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards - ORYGINALNY STYL */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="relative group overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-sky-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-linear-to-br from-sky-500/5 to-blue-500/5"></div>
            <div className="relative flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">{t('dashboard.unpaid')}</h3>
              <FileText className="text-sky-600" size={24} />
            </div>
            <div className="relative text-3xl font-bold text-black">
              {formatCurrency(stats.unpaid, i18n.language)}
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-sky-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 to-sky-500/5"></div>
            <div className="relative flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">{t('dashboard.thisMonth')}</h3>
              <ChartBar className="text-blue-600" size={24} />
            </div>
            <div className="relative text-3xl font-bold text-black">
              {formatCurrency(stats.thisMonth, i18n.language)}
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-sky-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-linear-to-br from-sky-600/5 to-blue-600/5"></div>
            <div className="relative flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">{t('dashboard.thisYear')}</h3>
              <ChartBar className="text-sky-600" size={24} />
            </div>
            <div className="relative text-3xl font-bold text-black">
              {formatCurrency(stats.thisYear, i18n.language)}
            </div>
          </div>

          <div className="relative group overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-sky-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 to-sky-600/5"></div>
            <div className="relative flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">{t('dashboard.totalInvoices')}</h3>
              <FileText className="text-blue-600" size={24} />
            </div>
            <div className="relative text-3xl font-bold text-black">
              {stats.totalInvoices}
            </div>
          </div>
        </div>

        {/* Recent Invoices - ORYGINALNY STYL */}
        <div className="relative overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm border border-sky-200 p-6 shadow-lg">
          <div className="absolute inset-0 bg-linear-to-br from-sky-500/5 to-blue-500/5"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black">{t('dashboard.recentInvoices')}</h2>
                <p className="text-black">Ostatnie 5 faktur w systemie</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl">
                <FileText className="text-slate-600" size={24} />
              </div>
            </div>
            
            {recentInvoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 bg-linear-to-br from-blue-100 to-indigo-100 rounded-3xl inline-block mb-6">
                  <FileText className="text-blue-600" size={64} />
                </div>
                <h3 className="text-2xl font-bold text-black mb-3">{t('dashboard.noInvoices')}</h3>
                <p className="text-black mb-6 text-lg">{t('dashboard.createFirst')}</p>
                <button 
                  onClick={() => onNavigate('invoices-new')}
                  className="px-8 py-4 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl transition-all duration-300 transform hover:scale-105 font-bold text-lg shadow-xl"
                >
                  <Plus className="inline mr-2" size={20} />
                  {t('dashboard.newInvoice')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentInvoices.map((invoice) => {
                  const client = clients?.find(c => c.id === invoice.client_id);
                  return (
                    <div
                      key={invoice.id}
                      className="group relative overflow-hidden rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 p-6 hover:bg-white/80 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
                      onClick={() => onNavigate(`invoices-${invoice.id}`)}
                    >
                      <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-sky-500/5 group-hover:from-blue-500/10 group-hover:to-sky-500/10 transition-all duration-300"></div>
                      <div className="relative flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-mono font-bold text-lg text-black mb-1">
                            {invoice.invoice_number}
                          </div>
                          <div className="text-black font-medium">
                            {client?.name || 'Unknown'}
                          </div>
                        </div>
                        <div className="text-right mr-6">
                          <div className="font-mono font-bold text-xl text-black">
                            {formatCurrency(invoice.total_gross, i18n.language)}
                          </div>
                          <div className="text-black">
                            {formatDate(invoice.issue_date, i18n.language)}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(invoice.status)}
                        </div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-blue-200/20 rounded-full blur-xl group-hover:bg-blue-200/30 transition-all duration-300"></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
