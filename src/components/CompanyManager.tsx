import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '@/hooks/useElectronDB';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building, Plus, Trash, Edit, Check, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

export function CompanyManager() {
  const { t } = useTranslation();
  const { companies, activeCompanyId, createCompany, updateCompany, deleteCompany, setActiveCompany, loading } = useCompanies();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    kvk: '',
    vat_number: '',
    iban: '',
    phone: '',
    email: '',
    website: '',
    logo_url: ''
  });

  const handleOpenDialog = (company?: any) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name || '',
        address: company.address || '',
        kvk: company.kvk || '',
        vat_number: company.vat_number || '',
        iban: company.iban || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        logo_url: company.logo_url || ''
      });
      setLogoPreview(company.logo_url || null);
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        address: '',
        kvk: '',
        vat_number: '',
        iban: '',
        phone: '',
        email: '',
        website: '',
        logo_url: ''
      });
      setLogoPreview(null);
    }
    setIsDialogOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Sprawdź czy to obraz
      if (!file.type.startsWith('image/')) {
        toast.error(t('settings.companies.selectImage'));
        return;
      }

      // Sprawdź rozmiar (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('settings.companies.fileTooLarge'));
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setFormData({ ...formData, logo_url: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFormData({ ...formData, logo_url: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error(t('settings.companies.companyName') + ' ' + t('common.required'));
      return;
    }

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, formData);
        toast.success(t('common.success'));
      } else {
        await createCompany(formData);
        toast.success(t('settings.companies.addNew') + ' - ' + t('common.success'));
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(t('common.error'));
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.companies.confirmDelete'))) {
      return;
    }

    try {
      await deleteCompany(id);
      toast.success(t('common.delete') + ' - ' + t('common.success'));
    } catch (error) {
      toast.error(t('common.error'));
      console.error(error);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await setActiveCompany(id);
      toast.success(t('settings.companies.setAsActive') + ' - ' + t('common.success'));
    } catch (error) {
      toast.error(t('common.error'));
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.companies.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('settings.companies.description')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('settings.companies.addNew')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? t('settings.companies.editCompany') : t('settings.companies.addNew')}
              </DialogTitle>
              <DialogDescription>
                {t('settings.companies.description')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">{t('settings.companies.companyName')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                {/* Logo Upload */}
                <div className="col-span-2">
                  <Label>{t('settings.companies.logo')}</Label>
                  <div className="mt-2 space-y-3">
                    {logoPreview ? (
                      <div className="relative inline-block">
                        <img 
                          src={logoPreview} 
                          alt="Logo preview" 
                          className="h-24 w-auto object-contain border rounded-lg p-2 bg-white"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={handleRemoveLogo}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <Label
                          htmlFor="logo-upload"
                          className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {t('settings.companies.addLogo')}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {t('settings.companies.logoFormats')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="address">{t('clients.address')}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="kvk">KVK</Label>
                  <Input
                    id="kvk"
                    value={formData.kvk}
                    onChange={(e) => setFormData({ ...formData, kvk: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="vat_number">BTW/VAT</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t('clients.phone')}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t('clients.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('settings.companies.noCompanies')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('settings.companies.createFirst')}</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('settings.companies.addNew')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => (
            <Card key={company.id} className={company.id === activeCompanyId ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {company.logo_url ? (
                      <img 
                        src={company.logo_url} 
                        alt={`${company.name} logo`}
                        className="h-16 w-16 object-contain border rounded-lg p-1 bg-white"
                      />
                    ) : (
                      <Building className="h-16 w-16 text-primary p-2 border rounded-lg bg-muted" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        {company.id === activeCompanyId && (
                          <Badge variant="default" className="ml-2">
                            <Check className="mr-1 h-3 w-3" />
                            {t('settings.companies.activeCompany')}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {company.address && <div>{company.address}</div>}
                        {company.kvk && <div>KVK: {company.kvk}</div>}
                        {company.vat_number && <div>BTW: {company.vat_number}</div>}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {company.id !== activeCompanyId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetActive(company.id)}
                      >
                        {t('settings.companies.switchTo')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(company)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {companies.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(company.id)}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              {(company.email || company.phone || company.website || company.iban) && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {company.email && <div>📧 {company.email}</div>}
                    {company.phone && <div>📞 {company.phone}</div>}
                    {company.website && <div>🌐 {company.website}</div>}
                    {company.iban && <div>🏦 {company.iban}</div>}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
