import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Upload, Check, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useClients, useProducts } from '@/hooks/useElectronDB';

type ImportType = 'clients' | 'products';
type CSVRow = Record<string, string>;

interface ColumnMapping {
  csvColumn: string;
  targetField: string;
}

const CLIENT_FIELDS = [
  { value: 'name', label: 'Nazwa' },
  { value: 'address', label: 'Adres' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefon' },
  { value: 'vat_number', label: 'NIP/VAT' },
  { value: 'kvk_number', label: 'KVK' },
];

const PRODUCT_FIELDS = [
  { value: 'name', label: 'Nazwa' },
  { value: 'description', label: 'Opis' },
  { value: 'price', label: 'Cena' },
  { value: 'vat_rate', label: 'Stawka VAT (%)' },
  { value: 'unit', label: 'Jednostka' },
];

export function CSVImport() {
  const { createClient } = useClients();
  const { createProduct } = useProducts();
  
  const [importType, setImportType] = useState<ImportType>('clients');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'complete'>('upload');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('Plik CSV musi mieć nagłówki i przynajmniej 1 wiersz danych');
          return;
        }

        // Parse CSV (basic, assumes comma-separated)
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row: CSVRow = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });

        setCsvHeaders(headers);
        setCsvData(rows);
        
        // Auto-map columns based on name matching
        const autoMappings = headers.map(header => {
          const targetFields = importType === 'clients' ? CLIENT_FIELDS : PRODUCT_FIELDS;
          const match = targetFields.find(field => 
            field.label.toLowerCase() === header.toLowerCase() ||
            field.value.toLowerCase() === header.toLowerCase()
          );
          return {
            csvColumn: header,
            targetField: match?.value || ''
          };
        });
        
        setColumnMappings(autoMappings);
        setStep('map');
        toast.success(`Załadowano ${rows.length} wierszy z pliku CSV`);
        
      } catch (error) {
        console.error('CSV parse error:', error);
        toast.error('Błąd parsowania pliku CSV');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const errors: string[] = [];
    let imported = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const mappedData: any = {};
      
      // Map columns to target fields
      columnMappings.forEach(mapping => {
        if (mapping.targetField && mapping.csvColumn) {
          mappedData[mapping.targetField] = row[mapping.csvColumn];
        }
      });

      // Validate required fields
      if (importType === 'clients') {
        if (!mappedData.name) {
          errors.push(`Wiersz ${i + 1}: Brak nazwy klienta`);
          continue;
        }

        try {
          await createClient({
            id: `import-${Date.now()}-${i}`,
            name: mappedData.name,
            address: mappedData.address || '',
            email: mappedData.email || '',
            phone: mappedData.phone || '',
            vat_number: mappedData.vat_number || '',
            kvk_number: mappedData.kvk_number || '',
            nip_number: mappedData.nip_number || '',
            country: 'NL',
            client_type: 'company',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          imported++;
        } catch (error) {
          errors.push(`Wiersz ${i + 1}: Błąd zapisu - ${error}`);
        }
        
      } else if (importType === 'products') {
        if (!mappedData.name || !mappedData.price) {
          errors.push(`Wiersz ${i + 1}: Brak nazwy lub ceny produktu`);
          continue;
        }

        try {
          await createProduct({
            id: `import-${Date.now()}-${i}`,
            name: mappedData.name,
            description: mappedData.description || '',
            price: parseFloat(mappedData.price) || 0,
            vat_rate: parseFloat(mappedData.vat_rate) || 21,
            unit: mappedData.unit || 'szt',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          imported++;
        } catch (error) {
          errors.push(`Wiersz ${i + 1}: Błąd zapisu - ${error}`);
        }
      }
    }

    setValidationErrors(errors);
    setImportedCount(imported);
    setStep('complete');

    if (errors.length > 0) {
      toast.warning(`Zaimportowano ${imported}/${csvData.length} rekordów`, {
        description: `${errors.length} błędów - sprawdź szczegóły poniżej`
      });
    } else {
      toast.success(`✅ Zaimportowano ${imported} rekordów!`);
    }
  };

  const resetImport = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMappings([]);
    setStep('upload');
    setValidationErrors([]);
    setImportedCount(0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📊 Import CSV</CardTitle>
          <CardDescription>
            Importuj dane hurtowo z pliku CSV (Excel "Zapisz jako CSV")
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Typ importu</Label>
            <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clients">👥 Klienci</SelectItem>
                <SelectItem value="products">📦 Produkty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 py-4">
            <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-sky-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-sky-100' : 'bg-gray-100'}`}>
                <Upload size={16} />
              </div>
              <span>Upload</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200" />
            <div className={`flex items-center gap-2 ${step === 'map' ? 'text-sky-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'map' ? 'bg-sky-100' : 'bg-gray-100'}`}>
                <FileText size={16} />
              </div>
              <span>Mapuj</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200" />
            <div className={`flex items-center gap-2 ${step === 'preview' || step === 'complete' ? 'text-sky-600 font-semibold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'preview' || step === 'complete' ? 'bg-sky-100' : 'bg-gray-100'}`}>
                <Check size={16} />
              </div>
              <span>Import</span>
            </div>
          </div>

          {/* Step Content */}
          {step === 'upload' && (
            <div className="space-y-4">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
              />
              <p className="text-sm text-gray-600">
                Format CSV: Nagłówki w pierwszym wierszu, wartości oddzielone przecinkami
              </p>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                Dopasuj kolumny z CSV do pól w systemie. Pola oznaczone * są wymagane.
              </p>
              <div className="space-y-3">
                {csvHeaders.map((header, index) => (
                  <div key={header} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="font-medium text-gray-700">
                      CSV: <span className="text-sky-600">{header}</span>
                    </div>
                    <Select
                      value={columnMappings[index]?.targetField || ''}
                      onValueChange={(value) => {
                        const newMappings = [...columnMappings];
                        newMappings[index] = { csvColumn: header, targetField: value };
                        setColumnMappings(newMappings);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pomiń" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">⊘ Pomiń</SelectItem>
                        {(importType === 'clients' ? CLIENT_FIELDS : PRODUCT_FIELDS).map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={resetImport}>
                  Anuluj
                </Button>
                <Button onClick={() => setStep('preview')}>
                  Dalej →
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded border border-yellow-200">
                ⚠️ Podgląd pierwszych 5 rekordów. Sprawdź czy dane są prawidłowo zmapowane.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      {columnMappings
                        .filter(m => m.targetField)
                        .map((mapping, i) => (
                          <TableHead key={i}>{mapping.targetField}</TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 5).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        <TableCell>{rowIndex + 1}</TableCell>
                        {columnMappings
                          .filter(m => m.targetField)
                          .map((mapping, colIndex) => (
                            <TableCell key={colIndex}>
                              {row[mapping.csvColumn] || '-'}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep('map')}>
                  ← Wstecz
                </Button>
                <Button onClick={handleImport}>
                  Importuj {csvData.length} rekordów
                </Button>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Import zakończony!
                </h3>
                <p className="text-gray-600">
                  Zaimportowano: <strong>{importedCount}</strong> / {csvData.length}
                </p>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 p-4 rounded border border-red-200">
                  <h4 className="font-semibold text-red-900 mb-2">
                    Błędy ({validationErrors.length}):
                  </h4>
                  <ul className="space-y-1 text-sm text-red-700">
                    {validationErrors.slice(0, 10).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-red-500">... i {validationErrors.length - 10} więcej</li>
                    )}
                  </ul>
                </div>
              )}

              <Button onClick={resetImport} className="w-full">
                Nowy import
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
