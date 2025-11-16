import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useClients } from '@/hooks/useElectronDB';
import { useAudio } from '@/contexts/AudioContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, PencilSimple, Trash, Users, User, Buildings, MagnifyingGlass, Check } from '@phosphor-icons/react';
import { Client } from '@/types';
import { toast } from 'sonner';
import { searchByKvkNumber, searchByName, generateVATFromKVK, type KVKSearchResult } from '../lib/kvkApi';

// Słownik krajów
const COUNTRIES = {
  'PL': 'Polska',
  'NL': 'Holandia',
  'DE': 'Niemcy',
  'BE': 'Belgia',
  'FR': 'Francja',
  'ES': 'Hiszpania',
  'IT': 'Włochy',
  'GB': 'Wielka Brytania',
  'US': 'Stany Zjednoczone',
  'CA': 'Kanada',
  'AU': 'Australia',
  'Other': 'Inne'
};
export default function Clients() {
  const { t } = useTranslation();
  const { isMuted } = useAudio();
  const { clients, createClient, updateClient, deleteClient, loading, refetch } = useClients();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Debug logs
  console.log('Clients component rendering with:', { 
    clientsCount: clients?.length,
    loading,
    isElectron: window.electronAPI?.isElectron,
    searchTerm
  });

  // Migracja starych klientów do nowego formatu
  const migratedClients = useMemo(() => {
    if (!clients) return [];
    return clients.map(client => ({
      ...client,
      country: client.country || 'PL',
      client_type: client.client_type || 'company',
      kvk_number: client.kvk_number || '',
      nip_number: client.nip_number || ''
    }));
  }, [clients]);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    country: 'PL',
    client_type: 'company' as 'individual' | 'company',
    vat_number: '',
    kvk_number: '',
    nip_number: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [kvkLoading, setKvkLoading] = useState(false);
  const [kvkResults, setKvkResults] = useState<KVKSearchResult[]>([]);
  const [showKvkResults, setShowKvkResults] = useState(false);

  // Funkcja wyszukiwania po numerze KVK
  const handleSearchByKVK = async () => {
    console.log('🔍 handleSearchByKVK called');
    console.log('Current KVK number:', formData.kvk_number);
    
    if (!formData.kvk_number || formData.kvk_number.trim().length < 8) {
      console.log('⚠️ KVK number too short');
      toast.error('Wpisz prawidłowy numer KVK (8 cyfr)');
      return;
    }

    try {
      console.log('🚀 Starting KVK search...');
      setKvkLoading(true);
      const result = await searchByKvkNumber(formData.kvk_number);
      console.log('✅ Search completed, result:', result);
      
      if (result) {
        // Auto-wypełnij formularz
        setFormData({
          ...formData,
          name: result.name || formData.name,
          address: `${result.address}, ${result.postalCode} ${result.city}`.trim() || formData.address,
          vat_number: result.vatNumber || generateVATFromKVK(result.kvkNumber),
          country: 'NL' // KVK to tylko Holandia
        });
        
        console.log('✅ Form updated with KVK data');
        toast.success(`Znaleziono: ${result.name}`);
      } else {
        console.log('⚠️ No result returned');
      }
    } catch (error) {
      console.error('❌ KVK search failed:', error);
      toast.error((error as Error).message);
    } finally {
      setKvkLoading(false);
      console.log('🏁 Search finished');
    }
  };

  // Funkcja wyszukiwania po nazwie firmy
  const handleSearchByName = async () => {
    console.log('🔍 handleSearchByName called');
    console.log('Current name:', formData.name);
    
    if (!formData.name || formData.name.trim().length < 2) {
      console.log('⚠️ Name too short');
      toast.error('Wpisz co najmniej 2 znaki nazwy firmy');
      return;
    }

    try {
      console.log('🚀 Starting name search...');
      setKvkLoading(true);
      setKvkResults([]);
      setShowKvkResults(false);
      
      const results = await searchByName(formData.name);
      console.log('✅ Search completed, results:', results);
      
      if (results.length === 0) {
        console.log('⚠️ No results found');
        toast.info('Nie znaleziono firm o podanej nazwie');
        return;
      }
      
      if (results.length === 1) {
        // Tylko jeden wynik - auto-wypełnij
        console.log('✅ Single result, auto-filling form');
        const result = results[0];
        setFormData({
          ...formData,
          kvk_number: result.kvkNumber,
          name: result.name,
          address: result.address,
          vat_number: result.vatNumber || generateVATFromKVK(result.kvkNumber),
          country: 'NL'
        });
        toast.success(`Automatycznie wypełniono dane: ${result.name}`);
      } else {
        // Wiele wyników - pokaż listę do wyboru
        console.log(`✅ Multiple results (${results.length}), showing selection list`);
        setKvkResults(results);
        setShowKvkResults(true);
        toast.info(`Znaleziono ${results.length} firm - wybierz właściwą`);
      }
    } catch (error) {
      console.error('❌ Name search failed:', error);
      toast.error((error as Error).message);
    } finally {
      setKvkLoading(false);
      console.log('🏁 Name search finished');
    }
  };

  // Wybierz firmę z listy wyników
  const handleSelectKVKResult = (result: KVKSearchResult) => {
    setFormData({
      ...formData,
      kvk_number: result.kvkNumber,
      name: result.name,
      address: result.address,
      vat_number: result.vatNumber || generateVATFromKVK(result.kvkNumber),
      country: 'NL'
    });
    setShowKvkResults(false);
    setKvkResults([]);
    toast.success(`Wybrano: ${result.name}`);
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm) return migratedClients || [];
    const term = searchTerm.toLowerCase();
    return (migratedClients || []).filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.vat_number.toLowerCase().includes(term) ||
        (c.nip_number && c.nip_number.toLowerCase().includes(term))
    );
  }, [migratedClients, searchTerm]);

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        address: client.address,
        country: client.country || 'PL',
        client_type: client.client_type || 'company',
        vat_number: client.vat_number,
        kvk_number: client.kvk_number || '',
        nip_number: client.nip_number || '',
        email: client.email,
        phone: client.phone,
        notes: client.notes,
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        address: '',
        country: 'PL',
        client_type: 'company',
        vat_number: '',
        kvk_number: '',
        nip_number: '',
        email: '',
        phone: '',
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    console.log('Saving client data:', formData); // Debug

    if (!formData.name) {
      toast.error('Nazwa jest wymagana');
      return;
    }

    try {
      if (editingClient) {
        console.log('Updating client:', editingClient.id, formData); // Debug
        await updateClient(editingClient.id, formData);
        toast.success('Klient zaktualizowany');
      } else {
        console.log('Creating new client:', formData); // Debug
        await createClient(formData);
        toast.success('Klient utworzony');
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error('Save error:', error); // Debug
      toast.error('Błąd zapisu klienta: ' + (error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('clients.confirmDelete'))) {
      try {
        await deleteClient(id);
        toast.success('Client deleted');
      } catch (error) {
        toast.error('Error deleting client');
        console.error('Delete error:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* UKŁAD: Film po lewej + Tekst z przyciskiem po prawej */}
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
              <source src="/klijenci.mp4" type="video/mp4" />
            </video>
          </div>

          {/* PRAWA STRONA: Tekst i przyciski */}
          <div className="flex flex-col justify-center px-4 md:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-black mb-3 md:mb-4 tracking-tight">
              👥 Klienci
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-black mb-6 md:mb-8 font-medium">
              Zarządzaj bazą danych klientów
            </p>
            <button onClick={() => handleOpenDialog()}
              className="group relative px-10 py-5 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-black text-lg shadow-2xl transition-all duration-500 hover:scale-105 overflow-hidden w-fit"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/30 to-transparent"></div>
              <span className="relative flex items-center gap-3">
                <Plus size={24} weight="bold" />
                Nowy klient
              </span>
            </button>
          </div>
        </div>

        {/* Modern Clients Card - PREMIUM 3D */}
        <div className="premium-card relative overflow-hidden bg-white/95 backdrop-blur-md p-6 border-2 border-blue-200">
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-black">{t('clients.title')}</h2>
                <p className="text-black">{t('clients.allClients')}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="text-blue-700" size={24} />
              </div>
            </div>

            {/* Modern Search */}
            <div className="mb-6">
              <div className="relative">
                <Input
                  placeholder={t('clients.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="premium-input w-full max-w-md bg-white/95 text-black placeholder:text-black/50"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="p-6 bg-blue-100 rounded-3xl inline-block mb-6 animate-pulse">
                  <Users className="text-teal-600" size={64} />
                </div>
                <h3 className="text-2xl font-bold text-black mb-3">Ładowanie klientów...</h3>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 bg-linear-to-br from-sky-100 to-blue-100 rounded-3xl inline-block mb-6">
                  <Users className="text-sky-600" size={64} />
                </div>
                <h3 className="text-2xl font-bold text-black mb-3">{t('clients.noClients')}</h3>
                <p className="text-black mb-6 text-lg">{t('clients.addFirst')}</p>
                <button
                  onClick={() => handleOpenDialog()}
                  className="px-8 py-4 bg-linear-to-r from-sky-500 to-blue-600 text-white rounded-2xl hover:from-sky-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 font-bold text-lg shadow-xl"
                >
                  <Plus className="inline mr-2" size={20} />
                  {t('clients.newClient')}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Modern Table Header */}
                  <div className="grid grid-cols-7 gap-4 p-4 bg-linear-to-r from-sky-500 to-blue-600 rounded-t-xl border-b-2 border-sky-400">
                    <div className="font-bold text-white">{t('clients.name')}</div>
                    <div className="font-bold text-white">{t('clients.clientType')}</div>
                    <div className="font-bold text-white">{t('clients.country')}</div>
                    <div className="font-bold text-white">{t('clients.email')}</div>
                    <div className="font-bold text-white">{t('clients.phone')}</div>
                    <div className="font-bold text-white">{t('clients.vatNumber')}</div>
                    <div className="font-bold text-white text-right">{t('clients.actions')}</div>
                  </div>

                  {/* Modern Table Body */}
                  <div className="space-y-2 p-2">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        className="premium-card group relative overflow-hidden bg-white/95 backdrop-blur-md p-4 border-2 border-blue-200"
                      >
                        <div className="relative grid grid-cols-7 gap-4 items-center">
                          <div className="font-bold text-black">{client.name}</div>
                          <div>
                            <Badge variant={client.client_type === 'company' ? 'default' : 'secondary'} className="bg-blue-100 text-blue-800">
                              {client.client_type === 'company' ? (
                                <><Buildings className="mr-1" size={14} /> Firma</>
                              ) : (
                                <><User className="mr-1" size={14} /> Prywatny</>
                              )}
                            </Badge>
                          </div>
                          <div className="font-medium text-black">{COUNTRIES[client.country as keyof typeof COUNTRIES] || client.country || 'PL'}</div>
                          <div className="text-black">{client.email}</div>
                          <div className="text-black">{client.phone}</div>
                          <div className="font-mono text-sm text-black">
                            {client.country === 'PL' && client.nip_number ? client.nip_number : client.vat_number}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenDialog(client)}
                                className="premium-button p-2 bg-teal-100 hover:bg-teal-200"
                                title="Edit client"
                              >
                                <PencilSimple className="text-teal-600" size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(client.id)}
                                className="premium-button p-2 bg-red-100 hover:bg-red-200"
                                title="Delete client"
                              >
                                <Trash className="text-red-600" size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? t('clients.edit') : t('clients.newClient')}
            </DialogTitle>
            <DialogDescription>
              {editingClient ? 'Edit client information' : 'Add a new client to your database'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Nazwa firmy z wyszukiwaniem KVK */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('clients.name')} *</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  placeholder="Kogbox Waterinstallaties / Jan Kowalski"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Button
                  type="button"
                  onClick={handleSearchByName}
                  disabled={kvkLoading || !formData.name || formData.name.length < 2}
                  variant="outline"
                  className="shrink-0"
                >
                  <MagnifyingGlass className="mr-2" size={16} />
                  {kvkLoading ? 'Szukam...' : 'KVK'}
                </Button>
              </div>
              
              {/* Lista wyników wyszukiwania KVK po nazwie */}
              {showKvkResults && kvkResults.length > 0 && (
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700 px-2 py-1">
                    Znaleziono {kvkResults.length} firm - wybierz właściwą:
                  </p>
                  {kvkResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start justify-between p-3 bg-white rounded-md border border-slate-200 hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => handleSelectKVKResult(result)}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-black">{result.name}</div>
                        <div className="text-sm text-slate-600">
                          KVK: {result.kvkNumber}
                        </div>
                        <div className="text-sm text-slate-500">
                          {result.address}, {result.postalCode} {result.city}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectKVKResult(result);
                        }}
                        className="shrink-0 ml-2"
                      >
                        <Check size={16} className="mr-1" />
                        Wybierz
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowKvkResults(false);
                      setKvkResults([]);
                    }}
                    className="w-full"
                  >
                    Zamknij
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_type">{t('clients.clientType')} *</Label>
                <Select
                  value={formData.client_type}
                  onValueChange={(value: 'individual' | 'company') =>
                    setFormData({ ...formData, client_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">
                      🏢 {t('clients.company')}
                    </SelectItem>
                    <SelectItem value="individual">
                      👤 {t('clients.individual')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{t('clients.country')} *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COUNTRIES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {code === 'Other' ? name : `${name} (${code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t('clients.address')} *</Label>
              <Textarea
                id="address"
                placeholder="Straatweg 20, 3131 CR Vlaardiingen, Nederland"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('clients.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="info@kogbox.nl"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('clients.phone')}</Label>
                <Input
                  id="phone"
                  placeholder="+31 6 12345678 / +48 123 456 789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Dynamiczne pola podatkowe w zależności od kraju */}
            {formData.country === 'PL' && (
              <div className="space-y-2">
                <Label htmlFor="nip_number">{t('clients.nipNumber')} (NIP)</Label>
                <Input
                  id="nip_number"
                  placeholder="123-456-78-90"
                  value={formData.nip_number}
                  onChange={(e) => setFormData({ ...formData, nip_number: e.target.value })}
                />
              </div>
            )}

            {formData.country === 'NL' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kvk_number">{t('clients.kvkNumber')} (KVK)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="kvk_number"
                      placeholder="12345678"
                      value={formData.kvk_number}
                      onChange={(e) => setFormData({ ...formData, kvk_number: e.target.value })}
                    />
                    <Button
                      type="button"
                      onClick={handleSearchByKVK}
                      disabled={kvkLoading || !formData.kvk_number || formData.kvk_number.length !== 8}
                      variant="outline"
                      className="shrink-0"
                      title="Wyszukaj dane firmy po numerze KVK"
                    >
                      <MagnifyingGlass size={16} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_number">{t('clients.vatNumber')} (BTW)</Label>
                  <Input
                    id="vat_number"
                    placeholder="NL003314048B23"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                  />
                </div>
              </div>
            )}

            {formData.country !== 'PL' && formData.country !== 'NL' && (
              <div className="space-y-2">
                <Label htmlFor="vat_number">{t('clients.vatNumber')} (VAT/BTW)</Label>
                <Input
                  id="vat_number"
                  placeholder="DE123456789 / FR12345678901"
                  value={formData.vat_number}
                  onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">{t('clients.notes')}</Label>
              <Textarea
                id="notes"
                placeholder="Aanvullende informatie over de klant..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('clients.cancel')}
            </Button>
            <Button onClick={handleSave}>{t('clients.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
