import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useExpenses, useClients } from '@/hooks/useElectronDB';
import { useAudio } from '@/contexts/AudioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, PencilSimple, Trash, DownloadSimple, Receipt, CreditCard, Camera, Image as ImageIcon, X, Scan } from '@phosphor-icons/react';
import { Expense, EXPENSE_CATEGORIES, ExpenseCategory, ExpenseAttachment } from '@/types/expenses';
import { formatCurrency, formatDate } from '@/lib/invoice-utils';
import { calculateNetFromGross, calculateGrossFromNet, type VATRate } from '@/lib/vat-calculator';
import { toast } from 'sonner';
import { scanReceipt, type ReceiptData } from '@/lib/receiptScanner';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export default function Expenses() {
  const { t, i18n } = useTranslation();
  const { isMuted } = useAudio();
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { clients } = useClients();
  const { showError, handleAsync } = useErrorHandler();
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // OCR scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  // NOWY STATE: Przełącznik "Kwota zawiera VAT"
  const [amountIncludesVAT, setAmountIncludesVAT] = useState(true); // Domyślnie TRUE (kwota z rachunku)
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'it_software' as ExpenseCategory,
    supplier: '',
    description: '',
    amount_net: '',
    vat_rate: '21',
    payment_method: 'bank_transfer',
    is_vat_deductible: true,
    is_business_expense: true,
    invoice_number: '',
    notes: '',
  });

  // Calculate amounts - NOWA LOGIKA z przełącznikiem VAT
  const calculateAmounts = (amount: number, vatRate: number) => {
    // SCENARIUSZ 1: Kwota ZAWIERA VAT (z rachunku) - ODLICZ VAT
    if (amountIncludesVAT) {
      const result = calculateNetFromGross(amount, vatRate as VATRate);
      return {
        net: result.net,
        vat: result.vat,
        gross: result.gross,
      };
    }
    // SCENARIUSZ 2: Kwota NETTO (bez VAT) - DODAJ VAT
    else {
      const result = calculateGrossFromNet(amount, vatRate as VATRate);
      return {
        net: result.net,
        vat: result.vat,
        gross: result.gross,
      };
    }
  };

  // Filter expenses by selected month
  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(exp => {
      return exp.date.startsWith(selectedMonth);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedMonth]);

  // Calculate totals
  const totals = useMemo(() => {
    const filtered = filteredExpenses;
    return {
      count: filtered.length,
      net: filtered.reduce((sum, exp) => sum + (exp.amount_net || 0), 0),
      vat: filtered.reduce((sum, exp) => sum + (exp.vat_amount || 0), 0),
      gross: filtered.reduce((sum, exp) => sum + (exp.amount_gross || 0), 0),
      deductibleVat: filtered.reduce((sum, exp) => 
        sum + (exp.is_vat_deductible ? (exp.vat_amount || 0) : 0), 0
      ),
    };
  }, [filteredExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier || !formData.amount_net) {
      toast.error('⚠️ Wypełnij wymagane pola: Dostawca i Kwota');
      return;
    }

    const inputAmount = parseFloat(formData.amount_net);
    const vatRate = parseFloat(formData.vat_rate);
    
    if (isNaN(inputAmount) || inputAmount <= 0) {
      toast.error('⚠️ Kwota musi być liczbą większą od zera');
      return;
    }
    
    const { net, vat, gross } = calculateAmounts(inputAmount, vatRate);

    const expenseData = {
      date: formData.date,
      category: formData.category,
      supplier: formData.supplier,
      description: formData.description,
      amount_net: net,      // Zawsze zapisujemy obliczone netto
      vat_rate: vatRate,
      vat_amount: vat,      // Zawsze zapisujemy obliczony VAT
      amount_gross: gross,  // Zawsze zapisujemy obliczone brutto
      currency: 'EUR',
      payment_method: formData.payment_method,
      is_vat_deductible: formData.is_vat_deductible,
      is_business_expense: formData.is_business_expense,
      invoice_number: formData.invoice_number,
      notes: formData.notes,
      attachments: attachments,
    };

    // Użyj profesjonalnej obsługi błędów
    await handleAsync(
      async () => {
        if (editingExpense) {
          await updateExpense(editingExpense.id, expenseData);
        } else {
          await createExpense(expenseData);
        }
        
        setShowDialog(false);
        resetForm();
      },
      {
        successMessage: editingExpense 
          ? '✅ Wydatek zaktualizowany' 
          : '✅ Wydatek dodany',
        context: {
          action: editingExpense ? 'update_expense' : 'create_expense',
          supplier: formData.supplier,
          amount: gross,
        },
      }
    );
  };

  // Funkcja do konwersji pliku na base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Obsługa dodawania zdjęć z galerii lub aparatu
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const newAttachments: ExpenseAttachment[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Sprawdź typ pliku
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
          toast.error(`Plik ${file.name} nie jest obrazem ani PDF`);
          continue;
        }

        // Konwertuj na base64
        const base64 = await fileToBase64(file);
        
        // Oblicz numer sekwencyjny
        const sequenceNumber = attachments.length + newAttachments.length + 1;
        
        const attachment: ExpenseAttachment = {
          id: `att_${Date.now()}_${i}`,
          expense_id: editingExpense?.id || '',
          file_name: file.name,
          file_path: base64,
          file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
          file_size: file.size,
          sequence_number: sequenceNumber,
          created_at: new Date().toISOString(),
        };
        
        newAttachments.push(attachment);
      }
      
      setAttachments([...attachments, ...newAttachments]);
      toast.success(`Dodano ${newAttachments.length} załącznik(ów)`);
      
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    } catch (error) {
      console.error('Error adding attachments:', error);
      toast.error('Błąd podczas dodawania załączników');
    }
  };

  // ==================== OCR SCANNING ====================
  /**
   * Skanuj paragon ze zdjęcia i automatycznie wypełnij formularz
   */
  const handleScanReceipt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Sprawdź typ pliku
    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz zdjęcie paragonu (JPG, PNG)');
      return;
    }

    setIsScanning(true);
    setScanProgress(0);

    try {
      toast.info('📷 Rozpoznawanie tekstu z paragonu...');

      // Wykryj język na podstawie ustawień
      const language = i18n.language === 'pl' ? 'pol' : i18n.language === 'nl' ? 'nld' : 'eng';
      
      // Skanuj paragon z OCR
      const receiptData: ReceiptData = await scanReceipt(
        file,
        language,
        (progress) => setScanProgress(progress)
      );

      console.log('📝 Dane z paragonu:', receiptData);

      // Automatyczne wypełnienie formularza
      if (receiptData.total || receiptData.totalNet) {
        // Preferuj total (brutto) jeśli dostępne
        const amount = receiptData.total || receiptData.totalNet || 0;
        setFormData(prev => ({
          ...prev,
          amount_net: amount.toFixed(2),
        }));
        
        // Ustaw przełącznik VAT
        if (receiptData.total) {
          setAmountIncludesVAT(true); // Kwota zawiera VAT
        } else {
          setAmountIncludesVAT(false); // Kwota netto
        }
      }

      if (receiptData.vatRate) {
        setFormData(prev => ({
          ...prev,
          vat_rate: receiptData.vatRate!.toString(),
        }));
      }

      if (receiptData.date) {
        setFormData(prev => ({
          ...prev,
          date: receiptData.date!,
        }));
      }

      if (receiptData.supplier) {
        setFormData(prev => ({
          ...prev,
          supplier: receiptData.supplier!,
        }));
      }

      if (receiptData.invoiceNumber) {
        setFormData(prev => ({
          ...prev,
          invoice_number: receiptData.invoiceNumber!,
        }));
      }

      // Dodaj paragon jako załącznik
      const base64 = await fileToBase64(file);
      const attachment: ExpenseAttachment = {
        id: `att_${Date.now()}`,
        expense_id: editingExpense?.id || '',
        file_name: file.name,
        file_path: base64,
        file_type: 'image',
        file_size: file.size,
        sequence_number: attachments.length + 1,
        created_at: new Date().toISOString(),
      };
      
      setAttachments([...attachments, attachment]);

      // Pokaż wyniki
      const confidence = receiptData.confidence || 0;
      const fields = [
        receiptData.total && `💰 Kwota: ${receiptData.total.toFixed(2)}`,
        receiptData.date && `📅 Data: ${receiptData.date}`,
        receiptData.supplier && `🏪 Sklep: ${receiptData.supplier}`,
        receiptData.vatRate && `📊 VAT: ${receiptData.vatRate}%`,
      ].filter(Boolean).join('\n');

      if (confidence < 50) {
        toast.warning(
          `⚠️ Niska pewność rozpoznania (${confidence.toFixed(0)}%)\n\n${fields}\n\nSprawdź i popraw dane ręcznie.`,
          { duration: 6000 }
        );
      } else {
        toast.success(
          `✅ Paragon zeskanowany (pewność ${confidence.toFixed(0)}%)\n\n${fields}`,
          { duration: 5000 }
        );
      }

      // Reset input
      if (event.target) {
        event.target.value = '';
      }

    } catch (error) {
      console.error('OCR Error:', error);
      
      // Użyj profesjonalnej obsługi błędów
      showError(error, {
        action: 'OCR Scanning',
        fileName: file.name,
        fileSize: file.size,
      });
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };
  // ==================== END OCR SCANNING ====================


  // Usuń załącznik
  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(attachments.filter(a => a.id !== attachmentId));
    toast.success('Załącznik usunięty');
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      category: expense.category,
      supplier: expense.supplier,
      description: expense.description || '',
      amount_net: expense.amount_net.toString(),
      vat_rate: expense.vat_rate.toString(),
      payment_method: expense.payment_method,
      is_vat_deductible: expense.is_vat_deductible,
      is_business_expense: expense.is_business_expense,
      invoice_number: expense.invoice_number || '',
      notes: expense.notes || '',
    });
    setAttachments(expense.attachments || []);
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten wydatek?')) {
      return;
    }
    
    const expense = expenses?.find(e => e.id === id);
    
    await handleAsync(
      async () => {
        await deleteExpense(id);
      },
      {
        successMessage: '🗑️ Wydatek usunięty',
        context: {
          action: 'delete_expense',
          expenseId: id,
          supplier: expense?.supplier,
          amount: expense?.amount_gross,
        },
      }
    );
  };

  const resetForm = () => {
    setEditingExpense(null);
    setAttachments([]);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: 'it_software',
      supplier: '',
      description: '',
      amount_net: '',
      vat_rate: '21',
      payment_method: 'bank_transfer',
      is_vat_deductible: true,
      is_business_expense: true,
      invoice_number: '',
      notes: '',
    });
  };

  const handleExportCSV = () => {
    const csv = [
      ['Data', 'Kategoria', 'Dostawca', 'Opis', 'Netto', 'VAT', 'Brutto', 'Nr faktury'].join(','),
      ...filteredExpenses.map(exp => [
        exp.date,
        EXPENSE_CATEGORIES[exp.category]?.name || exp.category,
        exp.supplier,
        exp.description || '',
        exp.amount_net,
        exp.vat_amount,
        exp.amount_gross,
        exp.invoice_number || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wydatki_${selectedMonth}.csv`;
    link.click();
    
    toast.success('Eksport CSV gotowy');
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
              <source src="/wydatki.mp4" type="video/mp4" />
            </video>
          </div>

          {/* PRAWA STRONA: Tekst i przyciski */}
          <div className="flex flex-col justify-center px-4 md:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-black mb-3 md:mb-4 tracking-tight">
              💳 Wydatki
            </h1>
            <p className="text-xl lg:text-2xl text-black mb-8 font-medium">
              Zarządzaj kosztami biznesowymi i rozliczaj VAT
            </p>
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <button className="px-10 py-5 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-black text-lg shadow-2xl transition-all duration-500 hover:scale-105 flex items-center gap-3 w-fit">
                  <Plus size={24} weight="bold" />
                  Nowy wydatek
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingExpense ? '✏️ Edytuj wydatek' : '➕ Nowy wydatek'}
                  </DialogTitle>
                  <DialogDescription>
                    Dodaj fakturę zakupu lub wydatek biznesowy
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data *</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label>Kategoria *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value as ExpenseCategory })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                            <SelectItem key={key} value={key}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Dostawca / Vendor *</Label>
                    <Input
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      placeholder="np. Adobe, Google, IKEA"
                      required
                    />
                  </div>

                  <div>
                    <Label>Opis</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Dodatkowy opis wydatku"
                    />
                  </div>

                  {/* NOWY ELEMENT: Przełącznik VAT */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-semibold text-blue-900">
                        💡 Sposób wprowadzania kwoty
                      </Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          checked={amountIncludesVAT}
                          onChange={() => setAmountIncludesVAT(true)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={`text-sm ${amountIncludesVAT ? 'font-bold text-blue-900' : 'text-black'}`}>
                          ☑️ Kwota ZAWIERA VAT (z rachunku)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          checked={!amountIncludesVAT}
                          onChange={() => setAmountIncludesVAT(false)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={`text-sm ${!amountIncludesVAT ? 'font-bold text-blue-900' : 'text-black'}`}>
                          ☐ Kwota NETTO (bez VAT)
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-black mt-2">
                      {amountIncludesVAT 
                        ? '📄 Przykład: Rachunek IKEA 193.60€ → System odliczy VAT → Netto: 160€, VAT: 33.60€'
                        : '💼 Przykład: Usługa 160€ netto → System doliczy VAT → Brutto: 193.60€'
                      }
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>{amountIncludesVAT ? 'Kwota brutto (€) *' : 'Kwota netto (€) *'}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.amount_net}
                        onChange={(e) => setFormData({ ...formData, amount_net: e.target.value })}
                        placeholder={amountIncludesVAT ? '193.60' : '160.00'}
                        required
                      />
                      <p className="text-xs text-black mt-1">
                        {amountIncludesVAT ? '(kwota z rachunku)' : '(kwota bez VAT)'}
                      </p>
                    </div>
                    
                    <div>
                      <Label>Stawka VAT (%)</Label>
                      <Select
                        value={formData.vat_rate}
                        onValueChange={(value) => setFormData({ ...formData, vat_rate: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="9">9%</SelectItem>
                          <SelectItem value="21">21%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>
                        {amountIncludesVAT ? 'Netto (obliczone)' : 'Brutto (obliczone)'}
                      </Label>
                      <Input
                        type="text"
                        value={formData.amount_net && formData.vat_rate ? 
                          (() => {
                            const amount = parseFloat(formData.amount_net);
                            const rate = parseFloat(formData.vat_rate);
                            const result = calculateAmounts(amount, rate);
                            return amountIncludesVAT 
                              ? `${result.net.toFixed(2)} € (netto)` 
                              : `${result.gross.toFixed(2)} € (brutto)`;
                          })() : 
                          '0.00 €'
                        }
                        disabled
                        className="bg-gray-100 font-semibold"
                      />
                      <p className="text-xs text-green-600 mt-1">
                        VAT: {formData.amount_net && formData.vat_rate ? 
                          calculateAmounts(parseFloat(formData.amount_net), parseFloat(formData.vat_rate)).vat.toFixed(2) : 
                          '0.00'
                        } €
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Metoda płatności</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">Przelew bankowy</SelectItem>
                          <SelectItem value="card">Karta płatnicza</SelectItem>
                          <SelectItem value="cash">Gotówka</SelectItem>
                          <SelectItem value="direct_debit">Polecenie zapłaty</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Numer faktury</Label>
                      <Input
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                        placeholder="Opcjonalnie"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Notatki</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Dodatkowe informacje..."
                      rows={3}
                    />
                  </div>

                  {/* Sekcja załączników (zdjęcia paragonów/faktur) */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                    <Label className="text-base font-semibold">📸 Załączniki (zdjęcia paragonów/faktur)</Label>
                    
                    {/* Przyciski dodawania */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <Camera size={18} />
                        Aparat
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon size={18} />
                        Galeria / Pliki
                      </Button>
                      
                      {/* NOWY PRZYCISK: Skanuj Paragon z OCR */}
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => scanInputRef.current?.click()}
                        disabled={isScanning}
                        className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                        title="Automatycznie odczytaj dane z paragonu (OCR)"
                        aria-label="Skanuj paragon z rozpoznawaniem tekstu OCR"
                      >
                        {isScanning ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            {scanProgress > 0 ? `${scanProgress}%` : 'Skanowanie...'}
                          </>
                        ) : (
                          <>
                            <Scan size={18} weight="bold" />
                            Skanuj Paragon OCR
                          </>
                        )}
                      </Button>
                      
                      {/* Input dla OCR scanning */}
                      <input
                        ref={scanInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleScanReceipt}
                        className="hidden"
                        aria-label="Skanuj paragon z OCR"
                        title="Automatycznie odczytaj dane z paragonu"
                      />
                      
                      {/* Input dla aparatu (capture="environment" aktywuje tylną kamerę) */}
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-label="Zrób zdjęcie wydatku"
                        title="Zrób zdjęcie wydatku"
                      />
                      
                      {/* Input dla galerii/plików */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        aria-label="Wybierz plik wydatku"
                        title="Wybierz plik wydatku"
                      />
                    </div>

                    {/* Podgląd załączników */}
                    {attachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-black mb-2">
                          Załączniki ({attachments.length}):
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {attachments.map((att) => (
                            <div key={att.id} className="relative group">
                              <div className="aspect-square bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                                {att.file_type === 'image' ? (
                                  <img
                                    src={att.file_path}
                                    alt={`Załącznik ${att.sequence_number}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                                    <Receipt size={32} className="text-red-600 mb-2" />
                                    <span className="text-xs text-black">PDF</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Numer sekwencyjny */}
                              <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                {att.sequence_number}
                              </div>
                              
                              {/* Przycisk usuń */}
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Usuń załącznik"
                              >
                                <X size={14} weight="bold" />
                              </button>
                              
                              {/* Rozmiar pliku */}
                              <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {(att.file_size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {attachments.length === 0 && (
                      <p className="text-sm text-black italic">
                        Brak załączników. Dodaj zdjęcia paragonów lub faktur używając przycisku powyżej.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => {
                      setShowDialog(false);
                      resetForm();
                    }}>
                      Anuluj
                    </Button>
                    <Button type="submit" className="flex-1">
                      {editingExpense ? 'Zaktualizuj' : 'Dodaj wydatek'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/95 backdrop-blur-md border border-blue-200 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-black">{t('expenses.totalNet')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(totals.net, i18n.language)}
              </div>
              <div className="text-xs text-black mt-1">{totals.count} wydatków</div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-md border border-blue-200 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-black">VAT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(totals.vat, i18n.language)}
              </div>
              <div className="text-xs text-black mt-1">{t('expenses.totalVat')}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-md border border-blue-200 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-black">{t('expenses.totalVatDeductible')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(totals.deductibleVat, i18n.language)}
              </div>
              <div className="text-xs text-black mt-1">{t('expenses.vatDeductible')}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-md border border-blue-200 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-black">{t('expenses.totalGross')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(totals.gross, i18n.language)}
              </div>
              <div className="text-xs text-black mt-1">Całkowity koszt</div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card className="bg-white/80 backdrop-blur-sm border border-blue-200 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista wydatków</CardTitle>
                <CardDescription>Wszystkie wydatki biznesowe</CardDescription>
              </div>
              <div className="flex gap-3 items-center">
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-48"
                />
                <Button variant="outline" onClick={handleExportCSV}>
                  <DownloadSimple className="mr-2" size={16} />
                  Eksport CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Ładowanie...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-6 bg-linear-to-br from-sky-100 to-blue-100 rounded-3xl inline-block mb-6">
                  <Receipt size={64} className="text-sky-600" />
                </div>
                <h3 className="text-2xl font-bold text-black mb-3">Brak wydatków</h3>
                <p className="text-black mb-6 text-lg">Dodaj pierwszy wydatek, aby zacząć</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Kategoria</TableHead>
                      <TableHead>Dostawca</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead className="text-center">📎</TableHead>
                      <TableHead className="text-right">{t('expenses.net')}</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead className="text-right">{t('expenses.gross')}</TableHead>
                      <TableHead className="text-right">{t('expenses.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(expense.date, i18n.language)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {EXPENSE_CATEGORIES[expense.category]?.icon} {' '}
                            {EXPENSE_CATEGORIES[expense.category]?.name.replace(/^[^\s]+ /, '')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{expense.supplier}</TableCell>
                        <TableCell className="text-sm text-black">
                          {expense.description || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {expense.attachments && expense.attachments.length > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <ImageIcon size={16} className="text-blue-600" />
                              <span className="text-xs font-semibold text-blue-600">
                                {expense.attachments.length}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(expense.amount_net, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(expense.vat_amount, i18n.language)}
                          {' '}
                          <span className="text-gray-400">({expense.vat_rate}%)</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatCurrency(expense.amount_gross, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(expense)}
                              className="p-2 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors duration-200"
                              title="Edytuj"
                            >
                              <PencilSimple size={18} className="text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="p-2 bg-red-100 hover:bg-red-200 rounded-xl transition-colors duration-200"
                              title="Usuń"
                            >
                              <Trash size={18} className="text-red-600" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

