import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompany } from '@/hooks/useElectronDB';
import { useAudio } from '@/contexts/AudioContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyManager } from '@/components/CompanyManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Image as ImageIcon, Plus, Copy, Printer, Download } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Company, Language, Invoice, Client } from '@/types';
import { InvoiceTemplateSelector } from '@/components/InvoiceTemplateSelector';
import { InvoiceTemplatePreview } from '@/components/InvoiceTemplatePreview';
import { TimesheetTemplateEditor } from '@/components/TimeTracking/TimesheetTemplateEditor';
import { TemplateLibraryModal } from '@/components/TimeTracking/TemplateLibraryModal';
import DocumentTemplateEditor from '@/components/Documents/DocumentTemplateEditor';
import InvoiceTemplateEditor from '@/components/InvoiceTemplateEditor.tsx';
import { CSVImport } from '@/components/CSVImport';
import { PEZET_WEEKBRIEF_TEMPLATE, DEFAULT_TEMPLATES } from '@/components/TimeTracking/Weekbrief/defaultTemplates';
import { getTemplateById, defaultTemplates } from '@/lib/invoice-templates';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { isMuted } = useAudio();
  const { t, i18n } = useTranslation();
  const { company, updateCompany, loading } = useCompany();
  
  // Default company data jeśli brak w bazie
  const defaultCompany = {
    id: '1',
    name: '',
    address: '',
    kvk: '',
    vat_number: '',
    eori: '',
    iban: '',
    bic: '',
    phone: '',
    phone_mobile: '',
    phone_whatsapp: '',
    website: '',
    email: '',
    email_alt: '',
    bank_name: '',
    account_number: '',
    default_payment_term_days: 14,
    default_vat_rate: 21,
    currency: 'EUR',
    logo_url: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const [formData, setFormData] = useState(company || defaultCompany);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Active Templates (localStorage)
  const [activeInvoiceTemplateId, setActiveInvoiceTemplateId] = useState(() => 
    localStorage.getItem('activeInvoiceTemplate') || 'classic'
  );
  const [activeTimesheetTemplateId, setActiveTimesheetTemplateId] = useState(() => 
    localStorage.getItem('activeTimesheetTemplate') || 'pezet-weekbrief-template'
  );
  
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeInvoiceTemplateId);
  const [networkUrl, setNetworkUrl] = useState('http://192.168.178.75:5002/');
  
  // Timesheet Templates State
  const [timesheetTemplates, setTimesheetTemplates] = useState(DEFAULT_TEMPLATES);
  const [showTimesheetEditor, setShowTimesheetEditor] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<typeof PEZET_WEEKBRIEF_TEMPLATE | null>(null);

  // Invoice Template Editor State
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);

  // Save active templates to localStorage
  useEffect(() => {
    localStorage.setItem('activeInvoiceTemplate', activeInvoiceTemplateId);
  }, [activeInvoiceTemplateId]);

  useEffect(() => {
    localStorage.setItem('activeTimesheetTemplate', activeTimesheetTemplateId);
  }, [activeTimesheetTemplateId]);

  // Get network URL automatically
  useEffect(() => {
    // Get current host and port
    const currentUrl = window.location.origin;
    const port = window.location.port || '5000';
    
    // Try to get actual network IP from electron if available
    if (window.electronAPI?.getNetworkAddress) {
      window.electronAPI.getNetworkAddress().then((ipAddress) => {
        setNetworkUrl(`http://${ipAddress}:${port}/`);
      });
    } else {
      // Fallback to current URL or localhost replacement
      if (currentUrl.includes('localhost')) {
        setNetworkUrl(`http://192.168.178.75:${port}/`);
      } else {
        setNetworkUrl(currentUrl);
      }
    }
  }, []);

  const sampleInvoice: Partial<Invoice> = {
    invoice_number: 'FV-2025-05-001',
    issue_date: '2025-05-15',
    due_date: '2025-05-29',
    currency: 'EUR',
    total_net: 500,
    total_vat: 105,
    total_gross: 605,
    payment_qr_payload: 'BCD\n001\n1\nSCT\nINGBNL2A\nYour Company\nNL00BANK0000000000\nEUR605.00\nFV-2025-05-001\nInvoice FV-2025-05-001',
    payment_reference: 'FV-2025-05-001',
    notes: 'Thank you for your business!',
    lines: [
      {
        id: '1',
        invoice_id: 'sample',
        description: 'Web Development Service',
        quantity: 10,
        unit_price: 50,
        vat_rate: 21,
        line_net: 500,
        line_vat: 105,
        line_gross: 605,
      },
    ],
  };

  const sampleClient: Client = {
    id: '1',
    name: 'Example Client B.V.',
    address: 'Rotterdam, Netherlands',
    country: 'NL',
    client_type: 'company',
    vat_number: 'NL123456789B01',
    kvk_number: '12345678',
    nip_number: '',
    email: 'client@example.com',
    phone: '+31 10 123 4567',
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Proszę wybrać plik obrazu');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Obraz musi być mniejszy niż 2MB');
      return;
    }

    try {
      console.log('Logo upload started:', file.name, file.size);
      
      // Try to save via Electron API if available
      if (window.electronAPI?.fileSystem?.saveCompanyLogo) {
        console.log('Using Electron API for logo save');
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const filename = `company-logo-${Date.now()}.${file.name.split('.').pop()}`;
        
        const savedPath = await window.electronAPI.fileSystem.saveCompanyLogo(filename, uint8Array);
        console.log('Logo saved to:', savedPath);
        setFormData({ ...formData, logo_url: savedPath });
        toast.success('Logo zapisane lokalnie');
      } else {
        console.log('Using fallback base64 for logo');
        // Fallback to base64 for web
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setFormData({ ...formData, logo_url: dataUrl });
          toast.success('Logo uploaded');
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData({ ...formData, logo_url: dataUrl });
        toast.success('Logo uploaded (base64)');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData) return;
    
    try {
      console.log('Saving company data:', formData);
      
      const result = await updateCompany({
        ...formData,
        updated_at: new Date().toISOString(),
      });
      
      console.log('Save result:', result);
      toast.success(t('settings.saved'));
    } catch (error) {
      toast.error('Błąd podczas zapisywania');
      console.error('Save error:', error);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    toast.success(t('common.success'));
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* UKŁAD: Film po lewej + Tekst po prawej */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* LEWA STRONA: Film */}
        <div className="relative overflow-hidden rounded-3xl bg-black border-4 border-sky-300 shadow-lg shadow-sky-200/50 h-64 md:h-72 lg:h-80">
          <video 
            autoPlay 
            loop 
            muted={isMuted}
            playsInline
            className="absolute top-0 left-0 w-full h-full object-contain"
          >
            <source src="/ustawienia .mp4" type="video/mp4" />
          </video>
        </div>

        {/* PRAWA STRONA: Tekst */}
        <div className="flex flex-col justify-center px-4 md:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-black mb-3 md:mb-4 tracking-tight">
            ⚙️ Ustawienia
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-black mb-6 md:mb-8 font-medium">
            Konfiguracja systemu i dane firmy
          </p>
        </div>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList>
          <TabsTrigger value="companies">{t('settings.companies.title')}</TabsTrigger>
          <TabsTrigger value="company">{t('settings.tabs.company')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('settings.tabs.preferences')}</TabsTrigger>
          <TabsTrigger value="backup">💾 Backup & Restore</TabsTrigger>
          <TabsTrigger value="csv-import">📊 CSV Import</TabsTrigger>
          <TabsTrigger value="templates">{t('settings.tabs.templates')}</TabsTrigger>
          <TabsTrigger value="timesheet-templates">{t('settings.tabs.timesheetTemplates')}</TabsTrigger>
          <TabsTrigger value="document-templates">{t('settings.tabs.documentTemplates')}</TabsTrigger>
          <TabsTrigger value="downloads">{t('settings.tabs.downloads')}</TabsTrigger>
          <TabsTrigger value="desktop">{t('settings.tabs.desktop')}</TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.companies.title')}</CardTitle>
              <CardDescription>{t('settings.companies.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.company')}</CardTitle>
              <CardDescription>{t('settings.companyDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start gap-6">
                  <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="w-24 h-24">
                        {formData.logo_url ? (
                          <AvatarImage src={formData.logo_url} alt="Company logo" />
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                            <ImageIcon size={32} />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mr-2" size={16} />
                          Upload Logo
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          aria-label="Upload company logo"
                          title="Select company logo file"
                        />
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG up to 2MB. Will appear on invoices.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('settings.name')} *</Label>
                  <Input
                    id="name"
                    placeholder="Company Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kvk">KvK-nummer (Kamer van Koophandel)</Label>
                  <Input
                    id="kvk"
                    placeholder="00000000"
                    value={formData.kvk}
                    onChange={(e) => setFormData({ ...formData, kvk: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">{t('settings.address')} *</Label>
                  <Input
                    id="address"
                    placeholder="Zuiderparklaaan 65, 2574HS 's-Gravenhage, Nederland"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vatNumber">BTW-nummer (BTW-identificatienummer)</Label>
                  <Input
                    id="vatNumber"
                    placeholder="NL005061645B57"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eori">EORI-nummer (voor export/import)</Label>
                  <Input
                    id="eori"
                    placeholder="NL005061645B57000000"
                    value={formData.eori}
                    onChange={(e) => setFormData({ ...formData, eori: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="iban">{t('settings.iban')} *</Label>
                  <Input
                    id="iban"
                    placeholder="NL25INGB0109126122"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bic">{t('settings.bic')} (SWIFT)</Label>
                  <Input
                    id="bic"
                    placeholder="INGBNL2A"
                    value={formData.bic}
                    onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">{t('settings.bankName')}</Label>
                  <Input
                    id="bankName"
                    placeholder="ING Bank"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('settings.email')} *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="servicedesk@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailAlt">{t('settings.emailAlt')}</Label>
                  <Input
                    id="emailAlt"
                    type="email"
                    placeholder="info@company.com"
                    value={formData.email_alt}
                    onChange={(e) => setFormData({ ...formData, email_alt: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('settings.phone')} (Tel.)</Label>
                  <Input
                    id="phone"
                    placeholder="+31 70 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneMobile">{t('settings.phoneMobile')} (Mobiel)</Label>
                  <Input
                    id="phoneMobile"
                    placeholder="+31 6 12345678"
                    value={formData.phone_mobile}
                    onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneWhatsapp">{t('settings.phoneWhatsapp')} (WhatsApp)</Label>
                  <Input
                    id="phoneWhatsapp"
                    placeholder="+31 6 87654321"
                    value={formData.phone_whatsapp}
                    onChange={(e) => setFormData({ ...formData, phone_whatsapp: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">{t('settings.website')}</Label>
                  <Input
                    id="website"
                    placeholder="www.company.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultPaymentTerm">{t('settings.defaultPaymentTerm')} (dagen)</Label>
                  <Input
                    id="defaultPaymentTerm"
                    type="number"
                    placeholder="14"
                    value={formData.default_payment_term_days}
                    onChange={(e) => setFormData({ ...formData, default_payment_term_days: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultVatRate">{t('settings.defaultVatRate')} (%)</Label>
                  <Input
                    id="defaultVatRate"
                    type="number"
                    step="0.01"
                    placeholder="21"
                    value={formData.default_vat_rate}
                    onChange={(e) => setFormData({ ...formData, default_vat_rate: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <Button onClick={handleSave} className="w-full md:w-auto">
                {t('settings.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.preferences')}</CardTitle>
              <CardDescription>{t('settings.preferencesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="language">{t('settings.language')}</Label>
                <Select value={i18n.language} onValueChange={(value) => handleLanguageChange(value as Language)}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pl">🇵🇱 Polski (PL)</SelectItem>
                    <SelectItem value="nl">🇳🇱 Nederlands (NL)</SelectItem>
                    <SelectItem value="en">🇬🇧 English (EN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Format */}
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Format daty</Label>
                <Select 
                  value={localStorage.getItem('dateFormat') || 'DD-MM-YYYY'}
                  onValueChange={(value) => {
                    localStorage.setItem('dateFormat', value);
                    toast.success('Format daty zapisany');
                  }}
                >
                  <SelectTrigger id="dateFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD-MM-YYYY">DD-MM-YYYY (31-12-2025)</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Decimal Separator */}
              <div className="space-y-2">
                <Label htmlFor="decimalSeparator">Separator dziesiętny</Label>
                <Select 
                  value={localStorage.getItem('decimalSeparator') || 'comma'}
                  onValueChange={(value) => {
                    localStorage.setItem('decimalSeparator', value);
                    toast.success('Separator zapisany');
                  }}
                >
                  <SelectTrigger id="decimalSeparator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comma">Przecinek (1.234,56)</SelectItem>
                    <SelectItem value="period">Kropka (1,234.56)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Strefa czasowa</Label>
                <Select 
                  value={localStorage.getItem('timezone') || 'Europe/Amsterdam'}
                  onValueChange={(value) => {
                    localStorage.setItem('timezone', value);
                    toast.success('Strefa czasowa zapisana');
                  }}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Amsterdam">🇳🇱 Europe/Amsterdam (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Warsaw">🇵🇱 Europe/Warsaw (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/London">🇬🇧 Europe/London (GMT/BST)</SelectItem>
                    <SelectItem value="America/New_York">🇺🇸 America/New_York (EST/EDT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Default Currency */}
              <div className="space-y-2">
                <Label htmlFor="defaultCurrency">Domyślna waluta</Label>
                <Select 
                  value={localStorage.getItem('defaultCurrency') || 'EUR'}
                  onValueChange={(value) => {
                    localStorage.setItem('defaultCurrency', value);
                    toast.success('Waluta zapisana');
                  }}
                >
                  <SelectTrigger id="defaultCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                    <SelectItem value="PLN">zł Złoty Polski (PLN)</SelectItem>
                    <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                    <SelectItem value="GBP">£ British Pound (GBP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <div className="space-y-6">
            {/* Export Backup */}
            <Card>
              <CardHeader>
                <CardTitle>📤 Export danych</CardTitle>
                <CardDescription>Pobierz kopię zapasową wszystkich danych jako plik JSON</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => {
                    const data = {
                      exportDate: new Date().toISOString(),
                      version: '1.0',
                      invoices: JSON.parse(localStorage.getItem('invoices') || '[]'),
                      clients: JSON.parse(localStorage.getItem('clients') || '[]'),
                      products: JSON.parse(localStorage.getItem('products') || '[]'),
                      companies: JSON.parse(localStorage.getItem('companies') || '[]'),
                      timesheets: JSON.parse(localStorage.getItem('timesheets') || '[]'),
                      appointments: JSON.parse(localStorage.getItem('appointments') || '[]'),
                      expenses: JSON.parse(localStorage.getItem('expenses') || '[]'),
                      kilometers: JSON.parse(localStorage.getItem('kilometers') || '[]'),
                      settings: {
                        language: i18n.language,
                        dateFormat: localStorage.getItem('dateFormat'),
                        decimalSeparator: localStorage.getItem('decimalSeparator'),
                        timezone: localStorage.getItem('timezone'),
                        defaultCurrency: localStorage.getItem('defaultCurrency'),
                      }
                    };
                    
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    link.href = url;
                    link.download = `messu-bouw-backup-${timestamp}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    toast.success('Backup pobrany!', {
                      description: `Plik: messu-bouw-backup-${timestamp}.json`
                    });
                  }}
                  className="w-full md:w-auto"
                >
                  <Download className="mr-2" size={20} />
                  Pobierz backup
                </Button>
                <p className="text-sm text-gray-600">
                  Ostatni backup: {localStorage.getItem('lastBackupDate') || 'Nigdy'}
                </p>
              </CardContent>
            </Card>

            {/* Import/Restore */}
            <Card>
              <CardHeader>
                <CardTitle>📥 Import danych</CardTitle>
                <CardDescription>Wczytaj dane z pliku backup JSON</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(event.target?.result as string);
                        
                        // Validate structure
                        if (!data.version || !data.exportDate) {
                          toast.error('Nieprawidłowy format pliku backup');
                          return;
                        }
                        
                        // Ask user: merge or replace
                        const shouldReplace = confirm(
                          '⚠️ UWAGA!\n\n' +
                          'Wybierz sposób importu:\n\n' +
                          '✅ OK = ZASTĄP wszystkie dane (usuń obecne)\n' +
                          '❌ ANULUJ = POŁĄCZ z obecnymi danymi\n\n' +
                          `Backup z: ${new Date(data.exportDate).toLocaleString()}`
                        );
                        
                        if (shouldReplace) {
                          // Replace mode
                          localStorage.setItem('invoices', JSON.stringify(data.invoices || []));
                          localStorage.setItem('clients', JSON.stringify(data.clients || []));
                          localStorage.setItem('products', JSON.stringify(data.products || []));
                          localStorage.setItem('companies', JSON.stringify(data.companies || []));
                          localStorage.setItem('timesheets', JSON.stringify(data.timesheets || []));
                          localStorage.setItem('appointments', JSON.stringify(data.appointments || []));
                          localStorage.setItem('expenses', JSON.stringify(data.expenses || []));
                          localStorage.setItem('kilometers', JSON.stringify(data.kilometers || []));
                          
                          toast.success('✅ Dane zastąpione!', {
                            description: 'Wszystkie dane zostały zastąpione danymi z backupu. Odśwież stronę.'
                          });
                        } else {
                          // Merge mode
                          const mergeArrays = (existing: any[], imported: any[]) => {
                            const existingIds = new Set(existing.map(item => item.id));
                            const newItems = imported.filter(item => !existingIds.has(item.id));
                            return [...existing, ...newItems];
                          };
                          
                          localStorage.setItem('invoices', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('invoices') || '[]'),
                            data.invoices || []
                          )));
                          localStorage.setItem('clients', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('clients') || '[]'),
                            data.clients || []
                          )));
                          localStorage.setItem('products', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('products') || '[]'),
                            data.products || []
                          )));
                          localStorage.setItem('companies', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('companies') || '[]'),
                            data.companies || []
                          )));
                          localStorage.setItem('timesheets', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('timesheets') || '[]'),
                            data.timesheets || []
                          )));
                          localStorage.setItem('appointments', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('appointments') || '[]'),
                            data.appointments || []
                          )));
                          localStorage.setItem('expenses', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('expenses') || '[]'),
                            data.expenses || []
                          )));
                          localStorage.setItem('kilometers', JSON.stringify(mergeArrays(
                            JSON.parse(localStorage.getItem('kilometers') || '[]'),
                            data.kilometers || []
                          )));
                          
                          toast.success('✅ Dane połączone!', {
                            description: 'Nowe dane dodane bez duplikatów. Odśwież stronę.'
                          });
                        }
                        
                        // Restore settings
                        if (data.settings) {
                          if (data.settings.dateFormat) localStorage.setItem('dateFormat', data.settings.dateFormat);
                          if (data.settings.decimalSeparator) localStorage.setItem('decimalSeparator', data.settings.decimalSeparator);
                          if (data.settings.timezone) localStorage.setItem('timezone', data.settings.timezone);
                          if (data.settings.defaultCurrency) localStorage.setItem('defaultCurrency', data.settings.defaultCurrency);
                        }
                        
                        localStorage.setItem('lastBackupDate', new Date().toISOString());
                        
                        // Refresh after 2s
                        setTimeout(() => window.location.reload(), 2000);
                        
                      } catch (error) {
                        console.error('Import error:', error);
                        toast.error('Błąd importu', {
                          description: 'Nie udało się wczytać pliku. Sprawdź czy to prawidłowy plik backup.'
                        });
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
                <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  ⚠️ Import danych połączy lub zastąpi obecne dane. Zalecamy najpierw pobrać backup obecnych danych.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="csv-import">
          <CSVImport />
        </TabsContent>

        <TabsContent value="templates">
          {showInvoiceEditor ? (
            <InvoiceTemplateEditor 
              onBack={() => setShowInvoiceEditor(false)}
            />
          ) : (
            <div className="space-y-6">
              {/* GÓRNA RAMKA - Edytor wizualny */}
              <Card className="border-2 border-sky-300 bg-linear-to-r from-sky-50 to-blue-50">
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100">
                      <svg className="w-8 h-8 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{t('settings.templates.visual_editor')}</h3>
                      <p className="text-gray-700 max-w-2xl mx-auto">
                        {t('settings.templates.visual_editor_description')}
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowInvoiceEditor(true)}
                      className="px-6 py-3 bg-linear-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all flex items-center gap-2 font-semibold shadow-lg shadow-sky-200/50 mx-auto"
                    >
                      <Plus size={20} weight="bold" />
                      {t('settings.templates.new_template')}
                    </button>
                  </div>
                </CardContent>
              </Card>

            {/* DOLNA RAMKA - Galeria wszystkich szablonów */}
            <Card>
              <CardHeader>
                <CardTitle>Dostępne szablony faktur ({defaultTemplates.length})</CardTitle>
                <CardDescription>
                  Wybierz szablon który będzie używany do generowania faktur PDF. Kliknij "Użyj" aby ustawić jako domyślny.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {defaultTemplates.map((template) => (
                    <div 
                      key={template.id} 
                      className={cn(
                        "bg-white rounded-lg overflow-hidden border-2 transition-all",
                        selectedTemplateId === template.id 
                          ? "border-sky-500 shadow-lg shadow-sky-200/50" 
                          : "border-sky-300 hover:border-sky-500 hover:shadow-lg hover:shadow-sky-200/50"
                      )}
                    >
                      {/* PODGLĄD GRAFICZNY */}
                      <div className="relative bg-gray-50 p-4 border-b-2 border-sky-200">
                        <div className="flex justify-center items-center" style={{ height: '240px' }}>
                          <InvoiceTemplatePreview
                            invoice={sampleInvoice}
                            client={sampleClient}
                            company={company}
                            template={template}
                            scale={0.18}
                          />
                        </div>
                        {activeInvoiceTemplateId === template.id && (
                          <span className="absolute top-2 right-2 px-2 py-1 bg-sky-500 text-white text-xs rounded font-semibold shadow-lg">
                            Aktywny
                          </span>
                        )}
                      </div>

                      {/* INFORMACJE */}
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg">{template.name}</h4>
                          <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                        </div>

                        {/* Mini badges */}
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-1 bg-sky-100 text-sky-700 text-xs rounded font-semibold">
                            {template.style}
                          </span>
                          {template.config.showLogo && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">{t('settings.templates.logo')}</span>
                          )}
                          {template.config.showQRCode && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">QR</span>
                          )}
                        </div>

                        {/* Przyciski akcji */}
                        <div className="flex gap-2 pt-2 border-t border-sky-200">
                          <button 
                            onClick={() => {
                              setActiveInvoiceTemplateId(template.id);
                              setSelectedTemplateId(template.id);
                              toast.success(`Szablon "${template.name}" ustawiony jako domyślny`);
                            }}
                            className={cn(
                              "flex-1 px-3 py-2 rounded transition font-semibold text-sm",
                              activeInvoiceTemplateId === template.id
                                ? "bg-gray-300 text-gray-500 cursor-default"
                                : "bg-sky-500 hover:bg-sky-600 text-white"
                            )}
                            disabled={activeInvoiceTemplateId === template.id}
                          >
                            {activeInvoiceTemplateId === template.id ? 'W użyciu' : 'Użyj'}
                          </button>
                          <button 
                            onClick={() => {
                              toast.info('Edytor wizualny wkrótce!');
                            }}
                            className="px-4 py-2 bg-white border-2 border-sky-400 text-sky-700 rounded hover:bg-sky-50 transition font-semibold text-sm"
                            title="Edytuj szablon"
                          >
                            Edytuj
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="timesheet-templates">
          <div className="space-y-6">
            {/* GÓRNA RAMKA - Edytor wizualny lub info */}
            {showTimesheetEditor ? (
              <TimesheetTemplateEditor
                template={editingTemplate || undefined}
                onSave={(template) => {
                  if (editingTemplate) {
                    setTimesheetTemplates(timesheetTemplates.map(t => t.id === template.id ? template : t));
                  } else {
                    setTimesheetTemplates([...timesheetTemplates, template]);
                  }
                  setShowTimesheetEditor(false);
                  setEditingTemplate(null);
                  toast.success('Szablon zapisany!');
                }}
                onCancel={() => {
                  setShowTimesheetEditor(false);
                  setEditingTemplate(null);
                }}
              />
            ) : (
              <Card className="border-2 border-sky-300 bg-linear-to-r from-sky-50 to-blue-50">
                <CardContent className="p-8">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100">
                      <svg className="w-8 h-8 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Edytor wizualny szablonów</h3>
                      <p className="text-gray-700 max-w-2xl mx-auto">
                        Kliknij "Nowy szablon" lub "Edytuj" na istniejącym szablonie aby otworzyć edytor wizualny. 
                        Możesz dostosować kolumny, kolory, czcionki i układ do swoich potrzeb.
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center pt-2">
                      <button 
                        onClick={() => setShowTemplateLibrary(true)}
                        className="px-6 py-3 bg-white border-2 border-sky-400 text-sky-700 rounded-lg hover:border-sky-600 hover:bg-sky-50 transition-all flex items-center gap-2 font-semibold"
                      >
                        <Copy size={20} weight="bold" />
                        Wybierz z biblioteki
                      </button>
                      <button 
                        onClick={() => {
                          setEditingTemplate(null);
                          setShowTimesheetEditor(true);
                        }}
                        className="px-6 py-3 bg-linear-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all flex items-center gap-2 font-semibold shadow-lg shadow-sky-200/50"
                      >
                        <Plus size={20} weight="bold" />
                        Nowy szablon
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* DOLNA RAMKA - Galeria wszystkich szablonów */}
            <Card>
              <CardHeader>
                <CardTitle>Zapisane szablony ({timesheetTemplates.length})</CardTitle>
                <CardDescription>
                  Wszystkie utworzone szablony bonów godzin pracy. Kliknij "Użyj" aby ustawić jako domyślny dla drukowania.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timesheetTemplates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg mb-2">Brak zapisanych szablonów</p>
                    <p className="text-sm">Kliknij "Nowy szablon" lub "Wybierz z biblioteki" aby rozpocząć</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {timesheetTemplates.map((template) => (
                      <div 
                        key={template.id} 
                        className={cn(
                          "bg-white rounded-lg overflow-hidden border-2 transition-all",
                          activeTimesheetTemplateId === template.id
                            ? "border-sky-500 shadow-lg shadow-sky-200/50"
                            : "border-sky-300 hover:border-sky-500 hover:shadow-lg hover:shadow-sky-200/50"
                        )}
                      >
                        {/* PODGLĄD GRAFICZNY (schematyczny) */}
                        <div className="relative bg-gray-50 p-4 border-b-2 border-sky-200">
                          <div className="bg-white rounded shadow-sm p-3 border border-gray-200">
                            {/* Header z gradientem */}
                            <div 
                              className="h-12 rounded mb-2 flex items-center justify-center text-white font-bold text-sm bg-sky-500"
                            >
                              {template.name.length > 15 ? template.name.substring(0, 15) + '...' : template.name}
                            </div>
                            
                            {/* Grid kolumn (miniaturowy) */}
                            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(template.config.columns.length, 8)}, 1fr)` }}>
                              {template.config.columns.slice(0, 8).map((col, idx) => (
                                <div 
                                  key={idx}
                                  className={cn(
                                    "h-16 rounded text-xs flex items-center justify-center font-semibold",
                                    col.type === 'text' ? 'bg-sky-100 text-sky-700' : 'bg-blue-100 text-blue-700'
                                  )}
                                  title={col.label}
                                >
                                  {col.label.substring(0, 2)}
                                </div>
                              ))}
                            </div>
                            
                            {/* Rows indicator */}
                            <div className="mt-2 text-xs text-gray-500 text-center">
                              {template.config.rows} wierszy
                            </div>
                          </div>
                          
                          {activeTimesheetTemplateId === template.id && (
                            <span className="absolute top-2 right-2 px-2 py-1 bg-sky-500 text-white text-xs rounded font-semibold shadow-lg">
                              Aktywny
                            </span>
                          )}
                        </div>

                        {/* INFORMACJE */}
                        <div className="p-4 space-y-3">
                          <div>
                            <h4 className="font-bold text-gray-900 text-lg">{template.name}</h4>
                            <p className="text-xs text-gray-600 mt-1">
                              {template.config.columns.length} kolumn • {template.config.rows} wierszy
                            </p>
                          </div>

                          {/* Mini badges */}
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              {template.config.columns.filter(c => c.type === 'number').length} dni
                            </span>
                            {template.config.pageSize && (
                              <span className="px-2 py-1 bg-sky-100 text-sky-700 text-xs rounded">
                                {template.config.pageSize}
                              </span>
                            )}
                          </div>

                          {/* Przyciski akcji */}
                          <div className="flex gap-2 pt-2 border-t border-sky-200">
                            <button 
                              onClick={() => {
                                setActiveTimesheetTemplateId(template.id);
                                toast.success(`Szablon "${template.name}" ustawiony jako domyślny`);
                              }}
                              className={cn(
                                "flex-1 px-3 py-2 rounded transition font-semibold text-sm",
                                activeTimesheetTemplateId === template.id
                                  ? "bg-gray-300 text-gray-500 cursor-default"
                                  : "bg-sky-500 hover:bg-sky-600 text-white"
                              )}
                              disabled={activeTimesheetTemplateId === template.id}
                            >
                              {activeTimesheetTemplateId === template.id ? 'W użyciu' : 'Użyj'}
                            </button>
                            <button 
                              onClick={() => {
                                setEditingTemplate(template);
                                setShowTimesheetEditor(true);
                              }}
                              className="px-4 py-2 bg-white border-2 border-sky-400 text-sky-700 rounded hover:bg-sky-50 transition font-semibold text-sm"
                              title="Edytuj szablon"
                            >
                              Edytuj
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="document-templates">
          <div className="space-y-6">
            <Card className="border-2 border-sky-300 bg-linear-to-r from-sky-50 to-blue-50">
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100">
                    <svg className="w-8 h-8 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">📄 System szablonów dokumentów biznesowych</h3>
                    <p className="text-gray-700 max-w-2xl mx-auto mb-4">
                      Twórz profesjonalne dokumenty: umowy o pracę, CV, podania, formularze KVK/Belasting, 
                      oferty, listy biznesowe, raporty i wiele więcej! TOP 50 najczęściej składanych dokumentów w Holandii.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-6">
                      <div className="bg-white rounded-lg p-3 border-2 border-sky-200">
                        <div className="text-2xl mb-1">💼</div>
                        <div className="text-xs font-semibold text-gray-800">{t('settings.categories.employment')}</div>
                        <div className="text-xs text-gray-600">Umowy, CV</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-sky-200">
                        <div className="text-2xl mb-1">🏛️</div>
                        <div className="text-xs font-semibold text-gray-800">Rząd/KVK</div>
                        <div className="text-xs text-gray-600">{t('settings.categories.registrations')}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-sky-200">
                        <div className="text-2xl mb-1">💰</div>
                        <div className="text-xs font-semibold text-gray-800">{t('settings.categories.taxes')}</div>
                        <div className="text-xs text-gray-600">BTW, deklaracje</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-sky-200">
                        <div className="text-2xl mb-1">📧</div>
                        <div className="text-xs font-semibold text-gray-800">{t('settings.categories.business')}</div>
                        <div className="text-xs text-gray-600">Oferty, listy</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center pt-2">
                    <button 
                      onClick={() => {
                        toast.info('Biblioteka dokumentów - wkrótce!');
                      }}
                      className="px-6 py-3 bg-white border-2 border-sky-400 text-sky-700 rounded-lg hover:border-sky-600 hover:bg-sky-50 transition-all flex items-center gap-2 font-semibold"
                    >
                      <Copy size={20} weight="bold" />
                      Wybierz szablon (50+)
                    </button>
                    <button 
                      onClick={() => {
                        toast.info('Edytor dokumentów - wkrótce!');
                      }}
                      className="px-6 py-3 bg-linear-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all flex items-center gap-2 font-semibold shadow-lg shadow-sky-200/50"
                    >
                      <Plus size={20} weight="bold" />
                      Nowy dokument
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dolna karta - TOP 8 szablonów (preview) */}
            <Card>
              <CardHeader>
                <CardTitle>📑 TOP dokumenty biznesowe w Holandii</CardTitle>
                <CardDescription>
                  Najczęściej składane dokumenty - gotowe szablony w języku holenderskim
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { name: 'Arbeidsovereenkomst', category: '💼 Employment', icon: '📝', desc: 'Umowa o pracę' },
                    { name: 'CV Professioneel', category: '💼 Employment', icon: '👤', desc: 'Curriculum vitae' },
                    { name: 'Sollicitatiebrief', category: '💼 Employment', icon: '✉️', desc: 'List motywacyjny' },
                    { name: 'KVK Inschrijving', category: '🏛️ Government', icon: '🏢', desc: 'Rejestracja firmy' },
                    { name: 'KVK Uitschrijving', category: '🏛️ Government', icon: '📤', desc: 'Zamknięcie firmy' },
                    { name: 'BTW Aangifte', category: '💰 Tax', icon: '💵', desc: 'Deklaracja VAT' },
                    { name: 'Zakelijke Brief', category: '📧 Business', icon: '📨', desc: 'List biznesowy' },
                    { name: 'Offerte', category: '📧 Business', icon: '💰', desc: 'Oferta handlowa' },
                  ].map((doc, idx) => (
                    <div key={idx} className="bg-white rounded-lg border-2 border-sky-200 hover:border-sky-500 hover:shadow-lg transition-all p-4">
                      <div className="text-3xl mb-2">{doc.icon}</div>
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{doc.name}</h4>
                      <p className="text-xs text-sky-600 font-semibold mb-2">{doc.category}</p>
                      <p className="text-xs text-gray-600 mb-3">{doc.desc}</p>
                      <button 
                        onClick={() => {
                          toast.success(`Szablon "${doc.name}" został załadowany!`);
                        }}
                        className="w-full px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded text-xs font-semibold transition"
                      >
                        Użyj szablonu
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-sky-50 rounded-lg border border-sky-200">
                  <p className="text-sm text-sky-800">
                    💡 <strong>Wkrótce dostępne:</strong> Pełna biblioteka 50+ szablonów dokumentów w 8 kategoriach 
                    (Employment, Government, Tax, Business, Legal, HR, Marketing, Reports). 
                    Edytor wizualny DRAG&DROP, motywy kolorów, export PDF/DOCX, merge fields [NAZWA], [DATA], etc.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="downloads">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.download.page_title')}</CardTitle>
                <CardDescription>
                  {t('settings.download.page_description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Desktop Download */}
                <div className="border rounded-lg p-6 bg-linear-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-start space-x-4">
                    <div className="shrink-0">
                      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-black">
                        {t('settings.download.windows_title')}
                      </h3>
                      <p className="text-sm text-black mt-1">
                        {t('settings.download.windows_description')}
                      </p>
                      <div className="mt-4 flex space-x-3">
                        <Button
                          size="sm"
                          onClick={() => {
                            // Download current source code as ZIP
                            const link = document.createElement('a');
                            link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(
                              'MESSU BOUW - Source Code\\n\\n' +
                              'Instrukcje instalacji:\\n' +
                              '1. Rozpakuj ZIP\\n' +
                              '2. Zainstaluj Node.js (18.x+)\\n' +
                              '3. W folderze: npm install\\n' +
                              '4. Uruchom: npm run electron:dev\\n\\n' +
                              'Wymagania: Node.js, Windows 10+'
                            )}`;
                            link.download = 'MESSU-BOUW-Installation-Guide.txt';
                            link.click();
                            toast.success(t('settings.download.instructions_downloaded'));
                          }}
                          className="bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
                        >
                          {t('settings.download.download_source')}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (window.electronAPI?.build) {
                              window.electronAPI.build.createInstaller();
                              toast.success(t('settings.download.creating_installer'));
                            } else {
                              toast.error(t('settings.download.desktop_mode_only'));
                            }
                          }}
                        >
                          {t('settings.download.build_installer')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Web App */}
                <div className="border rounded-lg p-6 bg-linear-to-r from-green-50 to-emerald-50">
                  <div className="flex items-start space-x-4">
                    <div className="shrink-0">
                      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 19H7V5h10m0-2H7c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h10c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-black">
                        {t('settings.download.mobile_title')}
                      </h3>
                      <p className="text-sm text-black mt-1">
                        {t('settings.download.mobile_description')}
                      </p>
                      
                      <div className="mt-3 p-3 bg-white/95 rounded border-l-4 border-blue-500">
                        <p className="text-sm font-medium text-blue-800">
                          {t('settings.download.current_address')}
                        </p>
                        <div className="mt-2 space-y-1">
                          <code className="block text-xs bg-blue-50 p-2 rounded font-mono">
                            {networkUrl}
                          </code>
                          <p className="text-xs text-black">
                            {t('settings.download.copy_instruction')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex space-x-3">
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (window.electronAPI?.copyToClipboard) {
                              await window.electronAPI.copyToClipboard(networkUrl);
                              toast.success(t('settings.download.address_copied'));
                            } else {
                              navigator.clipboard.writeText(networkUrl);
                              toast.success(t('settings.download.address_copied'));
                            }
                          }}
                          className="bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
                        >
                          {t('settings.download.copy_address')}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Generate QR code URL
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(networkUrl)}`;
                            window.open(qrUrl, '_blank');
                            toast.success(t('settings.download.qr_opened'));
                          }}
                        >
                          {t('settings.download.show_qr')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PWA */}
                <div className="border rounded-lg p-6 bg-linear-to-r from-sky-50 to-blue-50">
                  <div className="flex items-start space-x-4">
                    <div className="shrink-0">
                      <svg className="w-8 h-8 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-black">
                        ⚡ Progressive Web App (PWA)
                      </h3>
                      <p className="text-sm text-black mt-1">
                        Zainstaluj jako app na telefonie - działa jak natywna aplikacja
                      </p>
                      
                      <div className="mt-3 space-y-2 text-sm text-black">
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center text-white text-xs">1</span>
                          <span>Otwórz adres w przeglądarce telefonu</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center text-white text-xs">2</span>
                          <span>Kliknij "Dodaj do ekranu głównego" w menu przeglądarki</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center text-white text-xs">3</span>
                          <span>Aplikacja zostanie zainstalowana jak natywna app</span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            toast.success('Otwórz link w telefonie i dodaj do ekranu głównego!');
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          ℹ️ Instrukcje PWA
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">
                        💡 Porady instalacji
                      </h4>
                      <div className="mt-2 text-sm text-yellow-700 space-y-1">
                        <p><strong>Desktop:</strong> Pełna funkcjonalność, SQLite database, offline work</p>
                        <p><strong>Telefon:</strong> Responsive UI, localStorage, idealny do dodawania danych w ruchu</p>
                        <p><strong>Sync:</strong> Używaj desktop jako głównej bazy, telefon do szybkich wpisów</p>
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="desktop">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Desktop Application</CardTitle>
                <CardDescription>
                  Download and install MESSU BOUW as a desktop application for your computer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-4 p-4 bg-blue-50 rounded-lg">
                  <div className="shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">
                      Desktop App Features
                    </h3>
                    <p className="mt-1 text-sm text-blue-700">
                      • Offline work - wszystkie dane przechowywane lokalnie<br/>
                      • SQLite database - szybka i niezawodna baza danych<br/>
                      • Auto backup - automatyczne kopie zapasowe<br/>
                      • PDF generation - generowanie faktur w PDF<br/>
                      • No cloud dependencies - brak zależności od internetu
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">{t('settings.desktop.build_installer')}</h4>
                  <p className="text-sm text-muted-foreground">
                    Zbuduj installer dla Windows (.exe) który możesz zainstalować na dowolnym komputerze.
                  </p>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        // Trigger electron build
                        if (window.electronAPI) {
                          window.electronAPI.build.createInstaller();
                          toast.success('Rozpoczęto budowanie instalatora...');
                        } else {
                          toast.error('Funkcja dostępna tylko w aplikacji desktop');
                        }
                      }}
                      className="flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Build Windows Installer</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.electronAPI) {
                          window.electronAPI.build.openInstallerFolder();
                        } else {
                          toast.error('Funkcja dostępna tylko w aplikacji desktop');
                        }
                      }}
                    >
                      Open Installer Folder
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium">{t('settings.desktop.installation_instructions')}</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>Opcja 1: Installer (.exe)</strong></p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Zbuduj installer używając przycisku powyżej</li>
                      <li>Skopiuj plik .exe na pendrive lub prześlij przez email</li>
                      <li>Uruchom installer na docelowym komputerze</li>
                      <li>Aplikacja zostanie zainstalowana automatycznie</li>
                    </ol>
                    
                    <p className="mt-4"><strong>Opcja 2: Źródło aplikacji (dla programistów)</strong></p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Skopiuj cały folder projektu na pendrive</li>
                      <li>Na nowym komputerze zainstaluj Node.js (18.x lub nowszy)</li>
                      <li>Otwórz terminal w folderze projektu</li>
                      <li>Uruchom: <code className="bg-muted px-1 rounded">npm install</code></li>
                      <li>Uruchom: <code className="bg-muted px-1 rounded">npm run electron:dev</code></li>
                    </ol>
                    
                    <div className="mt-4 p-3 bg-green-50 rounded-md">
                      <p className="text-green-800 text-sm">
                        ✅ <strong>Zalecana opcja:</strong> Użyj installer (.exe) - automatycznie zainstaluje wszystkie potrzebne komponenty
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Library Modal */}
      <TemplateLibraryModal
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        onSelectTemplate={(template) => {
          setEditingTemplate(template);
          setShowTimesheetEditor(true);
        }}
      />
    </div>
  );
}
