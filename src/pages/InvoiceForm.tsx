import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoices, useClients, useProducts, useCompany } from '@/hooks/useElectronDB';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash, CalendarBlank, Hash } from '@phosphor-icons/react';
import { Invoice, InvoiceLine, Client, Product, Company, InvoiceCounter } from '@/types';
import { toast } from 'sonner';
import {
  calculateLineTotals,
  calculateInvoiceTotals,
  addDays,
  generateSEPAQRPayload,
  getNextInvoiceNumber,
  formatCurrency,
  getISOWeekNumber,
  getInvoiceNumberBreakdown,
} from '@/lib/invoice-utils';

interface InvoiceFormProps {
  onNavigate: (page: string) => void;
}

export default function InvoiceForm({ onNavigate }: InvoiceFormProps) {
  const { t, i18n } = useTranslation();
  const { clients } = useClients();
  const { products } = useProducts();
  const { company } = useCompany();
  const { invoices, createInvoice, updateInvoice } = useInvoices();
  
  // Temporary counter state - this should ideally be part of the database
  const [counters, setCounters] = useState<InvoiceCounter[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTermDays, setPaymentTermDays] = useState(company?.default_payment_term_days || 14);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [language, setLanguage] = useState('nl');
  const [lines, setLines] = useState<Array<Partial<InvoiceLine>>>([
    {
      description: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: company?.default_vat_rate || 21,
    },
  ]);

  const DUTCH_VAT_RATES = [
    { value: 0, label: '0% (VAT exempt / Export)' },
    { value: 9, label: '9% (Reduced rate)' },
    { value: 21, label: '21% (Standard rate)' },
  ];

  const invoiceBreakdown = useMemo(() => getInvoiceNumberBreakdown(issueDate), [issueDate]);
  const weekNumber = useMemo(() => getISOWeekNumber(issueDate), [issueDate]);

  const dueDate = useMemo(() => addDays(issueDate, paymentTermDays), [issueDate, paymentTermDays]);

  const totals = useMemo(() => {
    const validLines = lines.filter(l => l.description && l.quantity && l.unit_price !== undefined && l.vat_rate !== undefined);
    const calculatedLines = validLines.map(l => {
      const actualVatRate = reverseCharge ? 0 : (l.vat_rate || 0);
      const { lineNet, lineVat, lineGross } = calculateLineTotals(l.quantity!, l.unit_price!, actualVatRate);
      return { line_net: lineNet, line_vat: lineVat, line_gross: lineGross };
    });
    return calculateInvoiceTotals(calculatedLines);
  }, [lines, reverseCharge]);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        vat_rate: company?.default_vat_rate || 21,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (product) {
      const newLines = [...lines];
      newLines[index] = {
        ...newLines[index],
        product_id: product.id,
        description: product.name,
        unit_price: product.unit_price,
        vat_rate: product.vat_rate,
      };
      setLines(newLines);
    }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      [field]: value,
    };
    setLines(newLines);
  };

  const handleSaveInvoice = async () => {
    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }

    if (lines.length === 0 || !lines.some(l => l.description)) {
      toast.error('Please add at least one line item');
      return;
    }

    if (!company) {
      toast.error('Company information not found');
      return;
    }

    const client = clients?.find(c => c.id === selectedClientId);
    if (!client) {
      toast.error('Client not found');
      return;
    }

    const counterMap = new Map<string, number>();
    (counters || []).forEach(c => {
      counterMap.set(`${c.year}-${c.month}`, c.last_seq);
    });

    const { number, year, month, seq } = getNextInvoiceNumber(counterMap, issueDate);

    setCounters((prev) => {
      const existing = (prev || []).find(c => c.year === year && c.month === month);
      if (existing) {
        return (prev || []).map(c =>
          c.year === year && c.month === month ? { ...c, last_seq: seq } : c
        );
      } else {
        return [...(prev || []), { year, month, last_seq: seq }];
      }
    });

    const now = new Date().toISOString();
    const invoiceId = `invoice_${Date.now()}`;

    const invoiceLines: InvoiceLine[] = lines
      .filter(l => l.description)
      .map((l, i) => {
        const actualVatRate = reverseCharge ? 0 : (l.vat_rate || 0);
        const { lineNet, lineVat, lineGross } = calculateLineTotals(
          l.quantity!,
          l.unit_price!,
          actualVatRate
        );
        return {
          id: `line_${Date.now()}_${i}`,
          invoice_id: invoiceId,
          product_id: l.product_id,
          description: l.description!,
          quantity: l.quantity!,
          unit_price: l.unit_price!,
          vat_rate: actualVatRate,
          line_net: lineNet,
          line_vat: lineVat,
          line_gross: lineGross,
        };
      });

    const paymentReference = number;
    const paymentInfo = `${t('invoices.invoice')} ${number} – ${company.name}`;
    const qrPayload = generateSEPAQRPayload(
      company.bic,
      company.name,
      company.iban,
      totals.totalGross,
      paymentReference,
      paymentInfo
    );

    const vatNote = reverseCharge
      ? t('pdf.reverseChargeNote')
      : '';

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: number,
      company_id: company.id,
      client_id: selectedClientId,
      issue_date: issueDate,
      due_date: dueDate,
      currency: 'EUR',
      status: 'unpaid',
      total_net: totals.totalNet,
      total_vat: totals.totalVat,
      total_gross: totals.totalGross,
      vat_note: vatNote,
      payment_qr_payload: qrPayload,
      payment_reference: paymentReference,
      notes,
      created_at: now,
      updated_at: now,
      lines: invoiceLines,
    };

    try {
      // Disable button to prevent double-click
      const button = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (button) button.disabled = true;
      
      toast.loading('Saving invoice...', { id: 'save-invoice' });
      
      await createInvoice(newInvoice);
      
      toast.success(`✅ Invoice ${number} created`, { id: 'save-invoice' });
      
      // Navigate immediately without waiting
      onNavigate('invoices');
    } catch (error) {
      toast.error('❌ Error creating invoice', { id: 'save-invoice' });
      console.error('Create invoice error:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">{t('invoiceForm.title')}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="gap-1">
              <CalendarBlank size={14} />
              Week {weekNumber}, {invoiceBreakdown.year}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Hash size={14} />
              Month {invoiceBreakdown.month.toString().padStart(2, '0')}/{invoiceBreakdown.year}
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => onNavigate('invoices')}>
          {t('common.cancel')}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Factuurgegevens / Invoice Details</CardTitle>
            <CardDescription>Klant- en datuminformatie / Client and date information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">{t('invoiceForm.selectClient')} (Factuur voor / Invoice for) *</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder={t('invoiceForm.selectClient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients || []).map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issueDate">{t('invoiceForm.issueDate')} (Factuurdatum) *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTerm">Betalingstermijn / Payment term (dagen) *</Label>
                <Select 
                  value={paymentTermDays.toString()} 
                  onValueChange={(v) => setPaymentTermDays(parseInt(v))}
                >
                  <SelectTrigger id="paymentTerm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dagen</SelectItem>
                    <SelectItem value="14">14 dagen (Standaard NL)</SelectItem>
                    <SelectItem value="30">30 dagen</SelectItem>
                    <SelectItem value="60">60 dagen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">{t('invoiceForm.dueDate')} (Vervaldatum)</Label>
                <Input 
                  id="dueDate" 
                  type="date" 
                  value={dueDate} 
                  disabled 
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Taal / Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nl">Nederlands / Dutch (NL)</SelectItem>
                    <SelectItem value="en">English (EN)</SelectItem>
                    <SelectItem value="pl">Polski / Polish (PL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Valuta / Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="reverseCharge"
                checked={reverseCharge}
                onCheckedChange={(checked) => setReverseCharge(checked as boolean)}
              />
              <Label htmlFor="reverseCharge" className="font-normal">
                {t('invoiceForm.reverseCharge')} - Verleggingsregeling (0% BTW voor EU B2B)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('invoiceForm.lines')} / Factuurregels</CardTitle>
                <CardDescription>Producten, diensten en factuurregel items / Products, services and line items</CardDescription>
              </div>
              <Button onClick={handleAddLine} size="sm">
                <Plus className="mr-2" />
                {t('invoiceForm.addLine')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={index} className="p-4 border-2 border-sky-200 rounded-lg bg-card hover:border-sky-300 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Item {index + 1}</span>
                    {lines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLine(index)}
                      >
                        <Trash />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Product / Dienst selecteren</Label>
                      <Select
                        value={line.product_id || ''}
                        onValueChange={(value) => handleProductSelect(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('invoiceForm.selectProduct')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ad-hoc">{t('invoiceForm.adHoc')} (Aangepast)</SelectItem>
                          {(products || []).map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - {formatCurrency(product.unit_price, i18n.language)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Omschrijving / Description *</Label>
                      <Textarea
                        value={line.description || ''}
                        onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                        placeholder="Week 39 - Rioolreinigingsdiensten, inspectie en ontstopping"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Aantal / Amount *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1.00"
                        value={line.quantity || 0}
                        onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Eenheid / Unit</Label>
                      <Select defaultValue="piece">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piece">Stuks / Piece</SelectItem>
                          <SelectItem value="hour">Uur / Hour</SelectItem>
                          <SelectItem value="day">Dag / Day</SelectItem>
                          <SelectItem value="week">Week / Week</SelectItem>
                          <SelectItem value="month">Maand / Month</SelectItem>
                          <SelectItem value="service">Dienst / Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Prijs p.e. / Price excl. VAT (EUR) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1500.00"
                        value={line.unit_price || 0}
                        onChange={(e) => handleLineChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>BTW-tarief / VAT rate (%)</Label>
                      <Select
                        value={(reverseCharge ? 0 : (line.vat_rate || 0)).toString()}
                        onValueChange={(v) => handleLineChange(index, 'vat_rate', parseFloat(v))}
                        disabled={reverseCharge}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DUTCH_VAT_RATES.map((rate) => (
                            <SelectItem key={rate.value} value={rate.value.toString()}>
                              {rate.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Totaal excl. BTW</Label>
                          <div className="font-mono font-semibold text-sm mt-1">
                            {formatCurrency(
                              calculateLineTotals(
                                line.quantity || 0,
                                line.unit_price || 0,
                                0
                              ).lineNet,
                              i18n.language
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">BTW / VAT</Label>
                          <div className="font-mono font-semibold text-sm mt-1">
                            {formatCurrency(
                              calculateLineTotals(
                                line.quantity || 0,
                                line.unit_price || 0,
                                reverseCharge ? 0 : (line.vat_rate || 0)
                              ).lineVat,
                              i18n.language
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Totaal incl. BTW</Label>
                          <div className="font-mono font-bold text-base mt-1">
                            {formatCurrency(
                              calculateLineTotals(
                                line.quantity || 0,
                                line.unit_price || 0,
                                reverseCharge ? 0 : (line.vat_rate || 0)
                              ).lineGross,
                              i18n.language
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notities / Notes (Optioneel)</CardTitle>
            <CardDescription>Aanvullende informatie voor de klant / Additional information for the client</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opmerkingen / Remarks:&#10;Uw betaling dient uiterlijk 14 dagen na factuurdatum te zijn ontvangen op rekeningnummer NL25INGB0109126122 onder vermelding van het factuurnummer.&#10;&#10;Betaal met een bank-app of betaalverzoek de QR-code.&#10;Scan met een bank-app of betaalverzoek de QR-code."
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('invoiceForm.summary')} / Samenvatting</CardTitle>
            <CardDescription>Factuurtotalen / Invoice totals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-w-md ml-auto">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Totaal excl. BTW / Total excl. VAT:</span>
                <span className="font-mono font-semibold">{formatCurrency(totals.totalNet, i18n.language)}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Totaal BTW / Total VAT:</span>
                <span className="font-mono font-semibold">{formatCurrency(totals.totalVat, i18n.language)}</span>
              </div>
              {reverseCharge && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  Verleggingsregeling van toepassing - BTW wordt door de klant afgedragen / Reverse charge applies - VAT will be handled by the client
                </div>
              )}
              <div className="flex justify-between pt-3 border-t-2 border-primary">
                <span className="text-xl font-bold">Te betalen / Total incl. VAT:</span>
                <span className="text-xl font-mono font-bold text-primary">{formatCurrency(totals.totalGross, i18n.language)}</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                Betalingstermijn / Payment term: {paymentTermDays} dagen | Valuta / Currency: {currency}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => onNavigate('invoices')}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSaveInvoice} size="lg" className="min-w-40">
            {t('invoiceForm.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
