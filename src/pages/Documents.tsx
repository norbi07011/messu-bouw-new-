import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, Trash, Download, MagnifyingGlass, Calendar, ArrowLeft, FloppyDisk, Eye } from '@phosphor-icons/react';
import { toast } from 'sonner';
import RichTextEditor from '@/components/Documents/RichTextEditor';
import { ALL_DOCUMENT_TEMPLATES } from '@/components/Documents/documentPresets';
import type { DocumentTemplate } from '@/types/documentTemplate';

interface Document {
  id: string;
  name: string;
  template_id: string;
  template_name: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function Documents() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  
  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Kategorie dokumentów
  const categories = [
    { id: 'all', name: 'Wszystkie', icon: '📋', color: 'sky' },
    { id: 'employment', name: 'Zatrudnienie', icon: '💼', color: 'blue' },
    { id: 'government', name: 'Rząd/KVK', icon: '🏛️', color: 'indigo' },
    { id: 'tax', name: 'Podatki', icon: '💰', color: 'green' },
    { id: 'business', name: 'Biznes', icon: '📧', color: 'cyan' },
    { id: 'legal', name: 'Prawne', icon: '⚖️', color: 'violet' },
    { id: 'hr', name: 'HR/Personel', icon: '👥', color: 'rose' },
    { id: 'marketing', name: 'Marketing', icon: '📢', color: 'amber' },
    { id: 'reports', name: 'Raporty', icon: '📊', color: 'emerald' },
  ];

  // Załaduj dokumenty
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // MOCK DATA
      const mockDocuments: Document[] = [
        {
          id: '1',
          name: 'Umowa o pracę - Jan Kowalski',
          template_id: 'arbeidsovereenkomst-bepaalde-tijd',
          template_name: 'Arbeidsovereenkomst (bepaalde tijd)',
          category: 'employment',
          content: '<h2>ARBEIDSOVEREENKOMST VOOR BEPAALDE TIJD</h2><p>De ondergetekenden...</p>',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'CV - Maria Nowak',
          template_id: 'cv-professional',
          template_name: 'CV Professioneel',
          category: 'employment',
          content: '<h1>Maria Nowak</h1><p>Adres: Amsterdam | Email: maria@example.com</p>',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
      setDocuments(mockDocuments);
    } catch (error) {
      console.error('Błąd ładowania dokumentów:', error);
      toast.error('Nie udało się załadować dokumentów');
    } finally {
      setLoading(false);
    }
  };

  // Filtrowanie dokumentów
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.template_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Statystyki
  const stats = {
    total: documents.length,
    employment: documents.filter(d => d.category === 'employment').length,
    tax: documents.filter(d => d.category === 'tax').length,
    business: documents.filter(d => d.category === 'business').length,
  };

  // Otwórz edytor (nowy dokument)
  const handleNewDocument = () => {
    setShowEditor(true);
    setEditingDocument(null);
    setDocumentName('');
    setSelectedTemplate(null);
    setEditorContent('');
    setShowPreview(false);
  };

  // Otwórz edytor (edycja)
  const handleEditDocument = (doc: Document) => {
    setShowEditor(true);
    setEditingDocument(doc);
    setDocumentName(doc.name);
    const template = ALL_DOCUMENT_TEMPLATES.find(t => t.id === doc.template_id);
    setSelectedTemplate(template || null);
    setEditorContent(doc.content);
    setShowPreview(false);
  };

  // Wybierz szablon
  const handleTemplateSelect = (templateId: string) => {
    const template = ALL_DOCUMENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(template);
    
    // Generuj początkowy content z blocków szablonu
    const initialContent = template.blocks
      .map(block => {
        let html = '';
        const style = `
          text-align: ${block.alignment || 'left'};
          font-weight: ${block.fontWeight || 'normal'};
          font-style: ${block.fontStyle || 'normal'};
          font-size: ${block.fontSize || template.styles.fontSize}px;
          color: ${block.color || template.styles.textColor};
        `.trim();

        switch (block.type) {
          case 'header':
            html = `<div style="${style}">${block.content.replace(/\n/g, '<br>')}</div>`;
            break;
          case 'title':
            html = `<h2 style="${style}">${block.content}</h2>`;
            break;
          case 'text':
            html = `<p style="${style}">${block.content.replace(/\n/g, '<br>')}</p>`;
            break;
          case 'signature':
            html = `<div style="${style}">${block.content.replace(/\n/g, '<br>')}</div>`;
            break;
          default:
            html = `<p style="${style}">${block.content}</p>`;
        }
        return html;
      })
      .join('\n\n');

    setEditorContent(initialContent);
    toast.success(`Szablon "${template.name}" załadowany`);
  };

  // Zapisz dokument
  const handleSave = async () => {
    if (!documentName.trim()) {
      toast.error('Podaj nazwę dokumentu');
      return;
    }

    if (!selectedTemplate) {
      toast.error('Wybierz szablon');
      return;
    }

    if (!editorContent.trim()) {
      toast.error('Dokument nie może być pusty');
      return;
    }

    try {
      const newDoc: Document = {
        id: editingDocument?.id || `doc-${Date.now()}`,
        name: documentName,
        template_id: selectedTemplate.id,
        template_name: selectedTemplate.name,
        category: selectedTemplate.category,
        content: editorContent,
        created_at: editingDocument?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (editingDocument) {
        setDocuments(prev => prev.map(d => d.id === newDoc.id ? newDoc : d));
        toast.success('Dokument zaktualizowany');
      } else {
        setDocuments(prev => [newDoc, ...prev]);
        toast.success('Dokument utworzony');
      }

      setShowEditor(false);
    } catch (error) {
      console.error('Błąd zapisu:', error);
      toast.error('Nie udało się zapisać dokumentu');
    }
  };

  // Usuń dokument
  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno usunąć ten dokument?')) return;

    try {
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Dokument usunięty');
    } catch (error) {
      console.error('Błąd usuwania:', error);
      toast.error('Nie udało się usunąć dokumentu');
    }
  };

  // Export PDF
  const handleExportPDF = (doc: Document) => {
    toast.info('Export do PDF - wkrótce');
  };

  // Anuluj edycję
  const handleCancel = () => {
    if (confirm('Czy na pewno zamknąć edytor? Niezapisane zmiany zostaną utracone.')) {
      setShowEditor(false);
    }
  };

  // WIDOK EDYTORA
  if (showEditor) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-sky-600">
              {editingDocument ? '✏️ Edytuj dokument' : '📝 Nowy dokument'}
            </h1>
            <p className="text-gray-600 mt-1">Wybierz szablon i uzupełnij treść</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('common.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Edytor' : 'Podgląd'}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-linear-to-r from-sky-500 to-blue-600 text-white gap-2"
            >
              <FloppyDisk className="h-4 w-4" />
              {t('common.save')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lewa kolumna: Ustawienia */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sky-600">⚙️ Ustawienia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="doc-name">Nazwa dokumentu</Label>
                <Input
                  id="doc-name"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="np. Umowa o pracę - Jan Kowalski"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="template">Szablon</Label>
                <Select
                  value={selectedTemplate?.id || ''}
                  onValueChange={handleTemplateSelect}
                >
                  <SelectTrigger id="template" className="mt-1">
                    <SelectValue placeholder="Wybierz szablon..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.id !== 'all').map(category => (
                      <div key={category.id}>
                        <div className="px-2 py-1.5 text-sm font-semibold text-gray-500">
                          {category.icon} {category.name}
                        </div>
                        {ALL_DOCUMENT_TEMPLATES
                          .filter(t => t.category === category.id)
                          .map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="mt-4 p-3 bg-sky-50 rounded-lg border border-sky-200">
                  <h4 className="font-semibold text-sky-700 mb-1">{selectedTemplate.name}</h4>
                  <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedTemplate.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-700 mb-2">📎 Pola dynamiczne</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Użyj pól, które zostaną automatycznie wypełnione:
                </p>
                <div className="space-y-1 text-sm">
                  <div><code className="bg-blue-100 px-1 rounded">[NAZWA]</code> - Twoja nazwa/imię</div>
                  <div><code className="bg-blue-100 px-1 rounded">[DATA]</code> - Dzisiejsza data</div>
                  <div><code className="bg-blue-100 px-1 rounded">[FIRMA]</code> - Nazwa firmy</div>
                  <div><code className="bg-blue-100 px-1 rounded">[ADRES]</code> - Adres firmy</div>
                  <div><code className="bg-blue-100 px-1 rounded">[EMAIL]</code> - Email</div>
                  <div><code className="bg-blue-100 px-1 rounded">[TELEFON]</code> - Telefon</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prawa kolumna: Edytor/Podgląd */}
          <div className="lg:col-span-2">
            {showPreview ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sky-600">👁️ Podgląd</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none p-6 bg-white border rounded"
                    dangerouslySetInnerHTML={{ __html: editorContent }}
                  />
                </CardContent>
              </Card>
            ) : (
              <RichTextEditor
                value={editorContent}
                onChange={setEditorContent}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // WIDOK LISTY DOKUMENTÓW
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-sky-600">📄 Dokumenty</h1>
        <p className="text-gray-600 mt-1">Zarządzaj dokumentami biznesowymi - umowy, CV, formularze, raporty</p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-sky-600">{stats.total}</div>
              <div className="text-sm text-gray-600 mt-1">{t('documents.allDocuments')}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.employment}</div>
              <div className="text-sm text-gray-600 mt-1">💼 Zatrudnienie</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.tax}</div>
              <div className="text-sm text-gray-600 mt-1">💰 Podatki</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-600">{stats.business}</div>
              <div className="text-sm text-gray-600 mt-1">📧 Biznes</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtry */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Szukaj dokumentów..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button
              onClick={handleNewDocument}
              className="bg-linear-to-r from-sky-500 to-blue-600 text-white gap-2"
            >
              <Plus className="h-5 w-5" />
              Nowy dokument
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={
                  selectedCategory === category.id
                    ? 'bg-sky-500 text-white'
                    : 'hover:bg-sky-50'
                }
              >
                {category.icon} {category.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista dokumentów */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Ładowanie...</div>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {searchTerm || selectedCategory !== 'all' ? (
              <div>
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Nie znaleziono dokumentów</p>
                <p className="text-sm mt-1">Spróbuj zmienić filtry</p>
              </div>
            ) : (
              <div>
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Brak dokumentów</p>
                <p className="text-sm mt-1">Kliknij "Nowy dokument" aby utworzyć pierwszy</p>
                <Button
                  onClick={handleNewDocument}
                  className="mt-4 bg-linear-to-r from-sky-500 to-blue-600 text-white"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nowy dokument
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const category = categories.find(c => c.id === doc.category);
            return (
              <Card
                key={doc.id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-sky-200"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{category?.icon}</span>
                        <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded">
                          {category?.name}
                        </span>
                      </div>
                      <CardTitle
                        className="text-sky-700 hover:text-sky-800 cursor-pointer"
                        onClick={() => handleEditDocument(doc)}
                      >
                        {doc.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {doc.template_name}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Calendar className="h-4 w-4" />
                    {new Date(doc.created_at).toLocaleDateString('pl-PL')}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditDocument(doc)}
                      className="flex-1"
                    >
                      ✏️ Edytuj
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportPDF(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
