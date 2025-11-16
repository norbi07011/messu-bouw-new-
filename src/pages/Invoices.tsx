import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoices, useClients, useCompany } from '@/hooks/useElectronDB';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAudio } from '@/contexts/AudioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Plus, FileText, DownloadSimple, CheckCircle, FilePdf, FileCsv, FileCode, FileXls, Trash, PencilSimple, Eye, EnvelopeSimple, DotsThree, WhatsappLogo, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { Invoice, Client, Company } from '@/types';
import { formatCurrency, formatDate } from '@/lib/invoice-utils';
import { toast } from 'sonner';
import { generateInvoicePDF, generateMobilePDF } from '@/lib/pdf-generator';
import { exportToCSV, exportToJSON, exportToExcel, exportToXML } from '@/lib/export-utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface InvoicesProps {
  onNavigate: (page: string) => void;
}

export default function Invoices({ onNavigate }: InvoicesProps) {
  const { t, i18n } = useTranslation();
  const { isMuted } = useAudio();
  const { invoices, loading: invoicesLoading, updateInvoice, deleteInvoice } = useInvoices();
  const { clients, loading: clientsLoading } = useClients();
  const { company, loading: companyLoading } = useCompany();
  const [selectedTemplateId] = useState('classic');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const isMobile = useIsMobile();

  const sortedInvoices = useMemo(() => {
    return (invoices || []).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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

  const handleGeneratePDF = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client || !company) {
      toast.error(t('invoices.missingData'));
      return;
    }

    try {
      // Wykryj czy to urządzenie mobilne
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobileDevice) {
        // Na telefonie użyj html2canvas + jsPDF
        toast.loading('📱 Generowanie PDF dla telefonu...', { duration: 2000 });
        await generateMobilePDF(invoice, company, client, invoice.lines, i18n.language, selectedTemplateId || 'classic');
        toast.success('✅ PDF zapisany! Sprawdź folder Pobrane', {
          duration: 6000,
        });
      } else {
        // Na desktopie użyj window.print()
        await generateInvoicePDF(invoice, company, client, invoice.lines, i18n.language, selectedTemplateId || 'classic');
        toast.success(t('invoices.pdfOpened'), {
          duration: 6000,
        });
      }
    } catch (error) {
      toast.error('❌ Błąd generowania PDF. Spróbuj ponownie.');
      console.error(error);
    }
  };

  const handleExportCSV = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client || !company) {
      toast.error(t('invoices.missingData'));
      return;
    }
    try {
      await exportToCSV(invoice, company, client);
      toast.success(t('invoices.csvExported'));
    } catch (error) {
      toast.error(t('invoices.csvError'));
      console.error(error);
    }
  };

  const handleExportJSON = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client || !company) {
      toast.error(t('invoices.missingData'));
      return;
    }
    try {
      await exportToJSON(invoice, company, client);
      toast.success(t('invoices.jsonExported'));
    } catch (error) {
      toast.error(t('invoices.jsonError'));
      console.error(error);
    }
  };

  const handleExportExcel = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client || !company) {
      toast.error(t('invoices.missingData'));
      return;
    }
    try {
      await exportToExcel(invoice, company, client);
      toast.success(t('invoices.excelExported'));
    } catch (error) {
      toast.error(t('invoices.excelError'));
      console.error(error);
    }
  };

  const handleExportXML = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client || !company) {
      toast.error(t('invoices.missingData'));
      return;
    }
    try {
      await exportToXML(invoice, company, client);
      toast.success(t('invoices.xmlExported'));
    } catch (error) {
      toast.error(t('invoices.xmlError'));
      console.error(error);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        await updateInvoice(invoiceId, { 
          ...invoice, 
          status: 'paid' as const, 
          updated_at: new Date().toISOString() 
        });
        toast.success(t('invoices.markedPaid'));
      }
    } catch (error) {
      toast.error(t('invoices.markPaidError'));
      console.error('Mark paid error:', error);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    // Potwierdzenie przed usunięciem
    const confirmed = window.confirm(t('invoices.confirmDeletePrompt') + '? ' + t('common.irreversible'));
    
    if (!confirmed) {
      return;
    }

    try {
      console.log('Attempting to delete invoice:', invoiceId);
      if (!deleteInvoice) {
        console.error('deleteInvoice function is not available');
        toast.error(t('invoices.deleteNotAvailable'));
        return;
      }
      await deleteInvoice(invoiceId);
      console.log('Invoice deleted successfully');
      toast.success(t('invoices.deleteSuccess'));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('invoices.deleteError') + ': ' + (error as Error).message);
    }
  };

  const handleEditInvoice = (invoiceId: string) => {
    console.log('📝 Kliknięto Edit dla faktury:', invoiceId);
    const navigationPath = `invoices-edit-${invoiceId}`;
    console.log('📍 Ścieżka nawigacji:', navigationPath);
    onNavigate(navigationPath);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewInvoice(invoice);
  };

  const handleViewNext = () => {
    if (!viewInvoice) return;
    const idx = sortedInvoices.findIndex(i => i.id === viewInvoice.id);
    if (idx >= 0 && idx < sortedInvoices.length - 1) {
      setViewInvoice(sortedInvoices[idx + 1]);
    }
  };

  const handleViewPrev = () => {
    if (!viewInvoice) return;
    const idx = sortedInvoices.findIndex(i => i.id === viewInvoice.id);
    if (idx > 0) {
      setViewInvoice(sortedInvoices[idx - 1]);
    }
  };

  const handleSendEmail = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client || !company) {
      toast.error(t('invoices.missingClientData'));
      return;
    }

    if (!client.email) {
      toast.error(t('invoices.noClientEmail'));
      return;
    }

    try {
      // Generuj HTML faktury
      await generateInvoicePDF(invoice, company, client, invoice.lines, i18n.language, selectedTemplateId || 'classic');
      
      // Otwórz Gmail z przygotowanym tematem i treścią
      const subject = `Faktura ${invoice.invoice_number} - ${company.name}`;
      const body = `Szanowni Państwo,

W załączeniu przesyłam fakturę nr ${invoice.invoice_number} z dnia ${formatDate(invoice.issue_date, i18n.language)}.

Kwota do zapłaty: ${formatCurrency(invoice.total_gross, i18n.language)}
Termin płatności: ${formatDate(invoice.due_date, i18n.language)}

Dane do przelewu:
IBAN: ${company.iban || ''}
BIC: ${company.bic || ''}

Pozdrawiam,
${company.name}

---
UWAGA: Faktura została pobrana jako plik HTML/PDF. Proszę załączyć ją ręcznie do tego emaila przed wysłaniem.`;

      // Sprawdź czy jest Gmail zainstalowany (priorytet dla Gmaila)
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Otwórz w nowej karcie
      const gmailWindow = window.open(gmailUrl, '_blank');
      
      if (gmailWindow) {
        toast.success('Otwarto Gmail - proszę załączyć pobrany plik faktury');
      } else {
        // Fallback na mailto: jeśli blokowane popup
        const mailtoLink = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
        toast.success('Otwarto klienta email - proszę załączyć pobrany plik faktury');
      }
    } catch (error) {
      toast.error('Błąd podczas przygotowywania emaila');
      console.error(error);
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    const client = clients?.find(c => c.id === invoice.client_id);
    if (!client) {
      toast.error('Brak danych klienta');
      return;
    }

    if (!client.phone) {
      toast.error('Klient nie ma numeru telefonu');
      return;
    }

    try {
      // Najpierw wygeneruj PDF faktury
      if (company) {
        await generateInvoicePDF(invoice, company, client, invoice.lines, i18n.language, selectedTemplateId || 'classic');
        toast.success('PDF wygenerowany - proszę pobrać przed wysłaniem na WhatsApp');
      }

      // Clean phone number
      let raw = String(client.phone || '').replace(/[^0-9+]/g, '');
      // remove leading + for wa.me but keep digits
      let digits = raw.replace(/^\+/, '');

      // If looks local (starts with 0) try to infer country from language
      if (/^0/.test(digits)) {
        const lang = i18n.language || 'nl';
        const cc = lang === 'pl' ? '48' : lang === 'nl' ? '31' : '';
        if (cc) {
          digits = cc + digits.replace(/^0+/, '');
        } else {
          // fallback: strip leading zero
          digits = digits.replace(/^0+/, '');
        }
      }

      const message = `Dzień dobry,

Przesyłam fakturę nr ${invoice.invoice_number} z dnia ${formatDate(invoice.issue_date, i18n.language)}.

💰 Kwota: ${formatCurrency(invoice.total_gross, i18n.language)}
📅 Termin płatności: ${formatDate(invoice.due_date, i18n.language)}

🏦 Dane do przelewu:
IBAN: ${company?.iban || 'n/a'}
${company?.bic ? `BIC: ${company.bic}` : ''}

📎 Faktura PDF została wygenerowana - proszę ją załączyć do wiadomości przed wysłaniem.

Pozdrawiam,
${company?.name || ''}`;

      const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      
      // Otwórz WhatsApp
      window.open(waUrl, '_blank');
      
      // Pokaż instrukcję
      setTimeout(() => {
        toast.info('💡 Instrukcja: Po otwarciu WhatsApp kliknij ikonę 📎 (załącznik) i wybierz wygenerowany plik PDF faktury', {
          duration: 8000,
        });
      }, 1000);
      
    } catch (err) {
      console.error('WhatsApp open error', err);
      toast.error('Nie można otworzyć WhatsApp');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* UKŁAD: Film po lewej + Tekst z przyciskiem po prawej */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* LEWA STRONA: Film */}
          <div className="relative overflow-hidden rounded-3xl bg-black border-4 border-black shadow-[0_0_40px_rgba(59,130,246,0.7)] h-64 md:h-72 lg:h-80">
            <video 
              autoPlay 
              loop 
              muted={isMuted}
              playsInline
              className="absolute top-0 left-0 w-full h-full object-contain"
            >
              <source src="/Faktury.mp4" type="video/mp4" />
            </video>
          </div>

          {/* PRAWA STRONA: Tekst i przyciski */}
          <div className="flex flex-col justify-center px-4 md:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-black mb-3 md:mb-4 tracking-tight">
              📄 Faktury
            </h1>
            <p className="text-xl lg:text-2xl text-black mb-8 font-medium">
              Zarządzaj wszystkimi fakturami w jednym miejscu
            </p>
            <button 
              onClick={() => onNavigate('invoices-new')}
              className="px-10 py-5 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-black text-lg shadow-lg hover:shadow-xl border-2 border-blue-200 transition-all duration-300 hover:scale-105 flex items-center gap-3 w-fit"
            >
              <Plus size={24} weight="bold" />
              Nowa faktura
            </button>
          </div>
        </div>

        {/* Modern Invoices Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white border-2 border-blue-200 shadow-lg hover:border-sky-300 hover:shadow-xl transition-all duration-300">
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black">{t('invoices.title')}</h2>
                <p className="text-black">{t('invoices.allInvoices')}</p>
              </div>
              <div className="p-3 bg-sky-100 rounded-xl">
                <FileText className="text-blue-700" size={24} />
              </div>
            </div>
            
            {sortedInvoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 bg-linear-to-br from-sky-100 to-blue-100 rounded-3xl inline-block mb-6">
                  <FileText className="text-sky-600" size={64} />
                </div>
                <h3 className="text-2xl font-bold text-black mb-3">{t('invoices.noInvoices')}</h3>
                <p className="text-black mb-6 text-lg">{t('invoices.createFirst')}</p>
                <button 
                  onClick={() => onNavigate('invoices-new')}
                  className="px-8 py-4 bg-linear-to-r from-sky-600 to-blue-600 text-white rounded-2xl hover:from-sky-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 font-bold text-lg shadow-xl"
                >
                  <Plus className="inline mr-2" size={20} />
                  {t('invoices.newInvoice')}
                </button>
              </div>
            ) : (
              <>
                {/* Widok mobilny - karty */}
                {isMobile ? (
                  <div className="space-y-4">
                    {sortedInvoices.map((invoice) => {
                      const client = clients?.find(c => c.id === invoice.client_id);
                      return (
                        <Card key={invoice.id} className="overflow-hidden border-2 hover:border-sky-300 transition-all">
                          <CardContent className="p-4">
                            {/* Nagłówek karty */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <p className="text-xs text-black mb-1">{t('invoices.invoiceNumberLabel')}</p>
                                <p className="font-mono font-bold text-lg text-black">{invoice.invoice_number}</p>
                              </div>
                              <div>
                                {getStatusBadge(invoice.status)}
                              </div>
                            </div>

                            {/* Klient */}
                            <div className="mb-3">
                              <p className="text-xs text-black mb-1">{t('invoices.clientLabel')}</p>
                              <p className="font-medium text-gray-800">{client?.name || t('invoices.unknown')}</p>
                            </div>

                            {/* Daty w dwóch kolumnach */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <p className="text-xs text-black mb-1">{t('invoices.issueDateLabel')}</p>
                                <p className="text-sm font-mono text-black">{formatDate(invoice.issue_date, i18n.language)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-black mb-1">{t('invoices.dueDate')}</p>
                                <p className="text-sm font-mono text-black">{formatDate(invoice.due_date, i18n.language)}</p>
                              </div>
                            </div>

                            {/* Kwota - wyróżniona */}
                            <div className="bg-sky-50 rounded-lg p-3 mb-3">
                              <p className="text-xs text-sky-600 mb-1">{t('invoices.grossAmount')}</p>
                              <p className="text-2xl font-bold text-sky-700">{formatCurrency(invoice.total_gross, i18n.language)}</p>
                            </div>

                            {/* Przyciski akcji */}
                            <div className="grid grid-cols-3 gap-2">
                              {/* Podgląd */}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleViewInvoice(invoice)}
                                    className="w-full"
                                  >
                                    <Eye className="mr-2 pointer-events-none" size={16} />
                                    {t('invoices.preview')}
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
                                  <DialogHeader className="flex items-start justify-between">
                                    <div>
                                      <DialogTitle>{t('invoices.invoice')} {invoice.invoice_number}</DialogTitle>
                                      <DialogDescription>{client?.name}</DialogDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={handleViewPrev} className="p-1 rounded hover:bg-gray-100" title={t('invoices.previous')}>
                                        <ArrowLeft size={18} />
                                      </button>
                                      <button onClick={handleViewNext} className="p-1 rounded hover:bg-gray-100" title={t('invoices.next')}>
                                        <ArrowRight size={18} />
                                      </button>
                                    </div>
                                  </DialogHeader>
                                  {viewInvoice && (
                                    <div className="space-y-4 text-sm">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <p className="font-semibold text-black">{t('invoices.issueDateLabel')}</p>
                                          <p>{formatDate(viewInvoice.issue_date, i18n.language)}</p>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-black">{t('invoices.dueDate')}</p>
                                          <p>{formatDate(viewInvoice.due_date, i18n.language)}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-black mb-2">{t('invoices.items')}</p>
                                        <div className="space-y-2">
                                          {viewInvoice.lines.map((line, idx) => (
                                            <div key={idx} className="bg-gray-50 p-2 rounded">
                                              <p className="font-medium">{line.description}</p>
                                              <p className="text-xs text-black">
                                                {line.quantity} × {formatCurrency(line.unit_price, i18n.language)} = {formatCurrency(line.unit_price * line.quantity, i18n.language)}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="border-t pt-3">
                                        <div className="flex justify-between font-bold text-lg">
                                          <span>{t('invoices.totalLabel')}:</span>
                                          <span>{formatCurrency(viewInvoice.total_gross, i18n.language)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                                {/* WhatsApp */}
                                <button
                                  onClick={() => handleSendWhatsApp(invoice)}
                                  className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                  title={t('invoices.sendWhatsApp')}
                                >
                                  <WhatsappLogo className="text-blue-700 pointer-events-none" size={18} />
                                </button>

                                {/* Menu więcej opcji */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full">
                                    <DotsThree className="mr-2 pointer-events-none" size={20} weight="bold" />
                                    {t('invoices.more')}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => handleEditInvoice(invoice.id)}>
                                    <PencilSimple className="mr-2 pointer-events-none" size={16} />
                                    {t('common.edit')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleGeneratePDF(invoice)}>
                                    <FilePdf className="mr-2 pointer-events-none" size={16} />
                                    {t('invoices.downloadPDF')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSendEmail(invoice)}>
                                    <EnvelopeSimple className="mr-2 pointer-events-none" size={16} />
                                    {t('invoices.sendEmail')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleMarkPaid(invoice)}>
                                    <CheckCircle className="mr-2 pointer-events-none" size={16} />
                                    {t('invoices.markPaid')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteInvoice(invoice)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash className="mr-2 pointer-events-none" size={16} />
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  /* Widok desktopowy - tabela */
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Modern Table Header */}
                  <div className="grid grid-cols-7 gap-4 p-4 bg-linear-to-r from-sky-500 to-blue-600 rounded-t-xl border-2 border-blue-200 text-white">
                    <div className="font-bold">{t('invoices.invoiceNumber')}</div>
                    <div className="font-bold">{t('invoices.client')}</div>
                    <div className="font-bold">{t('invoices.issueDate')}</div>
                    <div className="font-bold">{t('invoices.dueDate')}</div>
                    <div className="font-bold text-right">{t('invoices.total')}</div>
                    <div className="font-bold text-white">{t('invoices.status')}</div>
                    <div className="font-bold text-white text-right">{t('invoices.actions')}</div>
                  </div>
                  
                  {/* Modern Table Body */}
                  <div className="space-y-2 p-2">
                    {sortedInvoices.map((invoice, index) => {
                      const client = clients?.find(c => c.id === invoice.client_id);
                      return (
                        <div
                          key={invoice.id}
                          className="group relative overflow-hidden rounded-xl bg-white/95 backdrop-blur-md border border-blue-200 p-4 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01]"
                        >
                          <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-blue-500/5 group-hover:from-blue-500/10 group-hover:to-blue-500/10 transition-all duration-300"></div>
                          <div className="relative grid grid-cols-7 gap-4 items-center">
                            <div className="font-mono font-bold text-black">{invoice.invoice_number}</div>
                            <div className="font-medium text-black">{client?.name || t('invoices.unknown')}</div>
                            <div className="font-mono text-sm text-black">{formatDate(invoice.issue_date, i18n.language)}</div>
                            <div className="font-mono text-sm text-black">{formatDate(invoice.due_date, i18n.language)}</div>
                            <div className="text-right font-mono font-bold text-black">{formatCurrency(invoice.total_gross, i18n.language)}</div>
                            <div>{getStatusBadge(invoice.status)}</div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* View Invoice */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <button 
                                      onClick={() => handleViewInvoice(invoice)}
                                      className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                      title={t('invoices.viewInvoice')}
                                    >
                                      <Eye className="text-blue-600 pointer-events-none" size={18} />
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>{t('invoices.viewInvoice')} {invoice.invoice_number}</DialogTitle>
                                      <DialogDescription>
                                        {t('invoices.invoiceDetails')} {client?.name}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm font-semibold text-black">{t('invoices.issueDateLabel')}</p>
                                          <p className="text-lg">{formatDate(invoice.issue_date, i18n.language)}</p>
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-black">{t('invoices.dueDate')}</p>
                                          <p className="text-lg">{formatDate(invoice.due_date, i18n.language)}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-black">{t('invoices.clientLabel')}</p>
                                        <p className="text-lg">{client?.name}</p>
                                        <p className="text-sm text-black">{client?.email}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold text-black mb-2">{t('invoices.items')}</p>
                                        <div className="border rounded-lg overflow-hidden">
                                          <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                              <tr>
                                                <th className="px-4 py-2 text-left">{t('invoices.itemDescription')}</th>
                                                <th className="px-4 py-2 text-right">{t('invoices.quantity')}</th>
                                                <th className="px-4 py-2 text-right">{t('invoices.price')}</th>
                                                <th className="px-4 py-2 text-right">{t('invoices.sum')}</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {invoice.lines.map((line, idx) => (
                                                <tr key={idx} className="border-t">
                                                  <td className="px-4 py-2">{line.description}</td>
                                                  <td className="px-4 py-2 text-right">{line.quantity}</td>
                                                  <td className="px-4 py-2 text-right">{formatCurrency(line.unit_price, i18n.language)}</td>
                                                  <td className="px-4 py-2 text-right">{formatCurrency(line.total, i18n.language)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-center pt-4 border-t">
                                        <p className="text-lg font-semibold">{t('invoices.totalGross')}</p>
                                        <p className="text-2xl font-bold text-sky-600">{formatCurrency(invoice.total_gross, i18n.language)}</p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                {/* Send WhatsApp */}
                                <button
                                  onClick={() => handleSendWhatsApp(invoice)}
                                  className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                  title={t('invoices.sendWhatsApp')}
                                >
                                  <WhatsappLogo className="text-blue-700 pointer-events-none" size={18} />
                                </button>

                                {/* Send Email */}
                                <button 
                                  onClick={() => handleSendEmail(invoice)}
                                  className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                  title={t('invoices.sendEmail')}
                                >
                                  <EnvelopeSimple className="text-blue-700 pointer-events-none" size={18} />
                                </button>

                                {/* Edit Invoice */}
                                <button 
                                  onClick={() => handleEditInvoice(invoice.id)}
                                  className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                  title={t('invoices.editInvoice')}
                                >
                                  <PencilSimple className="text-blue-700 pointer-events-none" size={18} />
                                </button>

                                {/* Download Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button 
                                      className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                      title={t('invoices.downloadInvoice')}
                                    >
                                      <DownloadSimple className="text-blue-700 pointer-events-none" size={18} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-sm border border-white/30">
                                    <DropdownMenuItem onClick={() => handleGeneratePDF(invoice)}>
                                      <FilePdf className="mr-2" size={16} />
                                      {t('invoices.downloadPDFHTML')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportExcel(invoice)}>
                                      <FileXls className="mr-2" size={16} />
                                      {t('invoices.downloadExcel')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleExportCSV(invoice)}>
                                      <FileCsv className="mr-2" size={16} />
                                      {t('invoices.exportCSV')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportJSON(invoice)}>
                                      <FileCode className="mr-2" size={16} />
                                      {t('invoices.exportJSON')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportXML(invoice)}>
                                      <FileCode className="mr-2" size={16} />
                                      {t('invoices.exportXML')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Mark as Paid */}
                                {invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => handleMarkPaid(invoice.id)}
                                    className="p-2 bg-sky-100 hover:bg-sky-200 rounded-xl transition-colors duration-200"
                                    title={t('invoices.markPaid')}
                                  >
                                    <CheckCircle className="text-blue-700 pointer-events-none" size={18} />
                                  </button>
                                )}

                                {/* Delete Invoice */}
                                <button 
                                  type="button"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    const confirmed = confirm(`${t('invoices.confirmDeletePrompt')} ${invoice.invoice_number}?`);
                                    if (!confirmed) return;
                                    
                                    try {
                                      console.log('Deleting invoice:', invoice.id);
                                      
                                      // Usunięcie z localStorage
                                      const stored = localStorage.getItem('invoices');
                                      if (stored) {
                                        const invoices = JSON.parse(stored);
                                        const updated = invoices.filter((inv: any) => inv.id !== invoice.id);
                                        localStorage.setItem('invoices', JSON.stringify(updated));
                                        console.log('Invoice deleted from localStorage');
                                        
                                        // Odświeżenie strony
                                        window.location.reload();
                                      }
                                    } catch (error) {
                                      console.error('Delete error:', error);
                                      alert('Błąd podczas usuwania faktury');
                                    }
                                  }}
                                  className="p-2 bg-red-100 hover:bg-red-200 rounded-xl transition-colors duration-200 cursor-pointer"
                                  title="Usuń fakturę"
                                  style={{ pointerEvents: 'auto', zIndex: 9999 }}
                                >
                                  <Trash className="text-red-600 pointer-events-none" size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-sky-200/20 rounded-full blur-xl group-hover:bg-sky-300/30 transition-all duration-300"></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
