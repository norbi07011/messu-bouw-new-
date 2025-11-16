import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Upload, Check } from 'lucide-react';
import { Company } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

export default function Companies() {
  const { t } = useLanguage();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Company>>({
    name: '',
    kvk: '',
    vat_number: '',
    address: '',
    phone: '',
    email: '',
    iban: '',
    bic: '',
    logo_url: '',
    website: '',
    phone_mobile: '',
    phone_whatsapp: '',
    email_alt: '',
    bank_name: '',
    account_number: '',
    eori: '',
    currency: 'EUR',
    default_payment_term_days: 14,
    default_vat_rate: 21,
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    // Load from localStorage for now
    const stored = localStorage.getItem('companies');
    if (stored) {
      setCompanies(JSON.parse(stored));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const now = new Date().toISOString();
    if (editingId) {
      const updated = companies.map(c => 
        c.id === editingId 
          ? { ...formData as Company, id: editingId, updated_at: now } 
          : c
      );
      setCompanies(updated);
      localStorage.setItem('companies', JSON.stringify(updated));
    } else {
      const newCompany: Company = {
        ...formData as Company,
        id: Date.now().toString(),
        created_at: now,
        updated_at: now,
      };
      const updated = [...companies, newCompany];
      setCompanies(updated);
      localStorage.setItem('companies', JSON.stringify(updated));
    }
    
    resetForm();
  };

  const handleEdit = (company: Company) => {
    setFormData(company);
    setEditingId(company.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('company.confirmDelete') || 'Verwijder bedrijf?')) {
      const updated = companies.filter(c => c.id !== id);
      setCompanies(updated);
      localStorage.setItem('companies', JSON.stringify(updated));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      kvk: '',
      vat_number: '',
      address: '',
      phone: '',
      email: '',
      iban: '',
      bic: '',
      logo_url: '',
      website: '',
      phone_mobile: '',
      phone_whatsapp: '',
      email_alt: '',
      bank_name: '',
      account_number: '',
      eori: '',
      currency: 'EUR',
      default_payment_term_days: 14,
      default_vat_rate: 21,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {t('company.title') || 'Bedrijven'}
          </h1>
          <p className="text-gray-600 mt-1">{t('company.subtitle') || 'Beheer uw bedrijfsgegevens'}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('company.add') || 'Nieuw bedrijf'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 border-2 border-purple-200">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            {editingId ? (t('company.edit') || 'Bewerk bedrijf') : (t('company.new') || 'Nieuw bedrijf')}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logo Upload */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>
                <div className="flex items-center gap-4">
                  {formData.logo_url && (
                    <img 
                      src={formData.logo_url} 
                      alt="Logo preview" 
                      className="w-24 h-24 object-contain border rounded-lg p-2"
                    />
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="btn btn-secondary">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrijfsnaam *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Messu Bouw B.V."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KVK nummer
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.kvk}
                  onChange={(e) => setFormData(prev => ({ ...prev, kvk: e.target.value }))}
                  placeholder="12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BTW nummer
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.vat_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, vat_number: e.target.value }))}
                  placeholder="NL123456789B01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.iban}
                  onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
                  placeholder="NL00 BANK 0000 0000 00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adres
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Straatnaam 123, 1234 AB Amsterdam"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefoon
                </label>
                <input
                  type="tel"
                  className="input"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+31 6 12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="info@messubouw.nl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="www.messubouw.nl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank naam
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.bank_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="ING Bank"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="submit" className="btn btn-primary">
                <Check className="w-4 h-4 mr-2" />
                {editingId ? 'Opslaan' : 'Aanmaken'}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Companies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div key={company.id} className="card hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              {company.logo_url ? (
                <img 
                  src={company.logo_url} 
                  alt={company.name} 
                  className="w-16 h-16 object-contain"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-purple-600" />
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">{company.name}</h3>
            
            <div className="space-y-1 text-sm text-gray-600 mb-4">
              {company.kvk && (
                <p><span className="font-medium">KVK:</span> {company.kvk}</p>
              )}
              {company.vat_number && (
                <p><span className="font-medium">BTW:</span> {company.vat_number}</p>
              )}
              {company.address && (
                <p>{company.address}</p>
              )}
              {company.phone && (
                <p>{company.phone}</p>
              )}
              {company.email && (
                <p className="text-purple-600">{company.email}</p>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => handleEdit(company)}
                className="flex-1 btn btn-secondary text-sm"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Bewerk
              </button>
              <button
                onClick={() => handleDelete(company.id)}
                className="btn btn-danger text-sm"
                title="Verwijder"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && !showForm && (
        <div className="text-center py-12">
          <div className="inline-flex p-4 rounded-full bg-gray-100 mb-4">
            <Building2 className="w-16 h-16 text-gray-400" />
          </div>
          <p className="text-gray-500 text-lg">Geen bedrijven gevonden</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary mt-4"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nieuw bedrijf
          </button>
        </div>
      )}
    </div>
  );
}
