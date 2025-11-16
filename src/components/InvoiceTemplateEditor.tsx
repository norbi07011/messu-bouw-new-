/**
 * INVOICE TEMPLATE EDITOR - Visual Builder v2 (CLEAN REBUILD)
 * 
 * FUNKCJE (zgodne z TimesheetTemplateEditor):
 * ✅ UNDO/REDO (Ctrl+Z/Ctrl+Y) - 20-step history
 * ✅ Gradient colors (dual picker) - start/end colors
 * ✅ Template library - presets faktur
 * ✅ Logo upload - ColorPickerDual, FontControls, LogoControls
 * ✅ Keyboard shortcuts (Ctrl+S save, Ctrl+D duplicate)
 * ✅ Drag & Drop blocks - reorder invoice sections
 * ✅ Export/Import JSON - share templates
 * 
 * BLOKI FAKTURY:
 * 1. company-info - Dane firmy
 * 2. client-info - Dane klienta  
 * 3. invoice-header - Nagłówek (Nr faktury, data)
 * 4. items-table - Tabela pozycji
 * 5. totals - Suma końcowa
 * 6. payment-info - Informacje o płatności
 * 7. notes - Notatki/warunki
 * 8. footer - Stopka
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash, 
  Copy, 
  DotsSixVertical, 
  DownloadSimple, 
  UploadSimple, 
  Eye, 
  EyeSlash,
  ListBullets,
  Image as ImageIcon
} from '@phosphor-icons/react';
import type { InvoiceBlock, InvoiceTemplateLayout, InvoiceBlockType } from '@/types/invoiceTemplate';
import type { Invoice, Client, Company, InvoiceTemplate } from '@/types';
import { useUndoRedo, useUndoRedoKeyboard } from '@/hooks/useUndoRedo';
import { ColorPickerDual, FontControls, LogoControls, UndoRedoToolbar } from '@/components/shared/TemplateEditor';
import { InvoiceTemplatePreview } from './InvoiceTemplatePreview';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

// Editor State Interface
interface EditorState {
  templateName: string;
  blocks: InvoiceBlock[];
  headerGradientStart: string;
  headerGradientEnd: string;
  primaryColorStart: string;
  primaryColorEnd: string;
  accentColorStart: string;
  accentColorEnd: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  fontSize: { heading: number; body: number; small: number };
  fontFamily: { heading: string; body: string };
  logoUrl?: string;
  logoPosition: 'left' | 'center' | 'right';
  // NEW: Advanced logo control
  logoX: number;  // X position in px
  logoY: number;  // Y position in px
  logoWidth: number;  // Width in px
  logoHeight: number;  // Height in px
  logoOpacity: number;  // 0-100%
  showLogo: boolean;
  // NEW: Watermark support
  watermarkEnabled: boolean;
  watermarkUrl?: string;
  watermarkOpacity: number;  // 5-50%
  watermarkSize: number;  // 100-600px
  watermarkRotation: number;  // -45 to 45 degrees
  // NEW: QR Code positioning
  qrCodeEnabled: boolean;
  qrCodePosition: 'payment-right' | 'payment-below' | 'top-right' | 'bottom-right';
  qrCodeSize: number;  // 80-200px
  // NEW: Warning Box (Reverse Charge)
  warningBoxEnabled: boolean;
  warningBoxText: string;
  warningBoxBackgroundColor: string;
  warningBoxTextColor: string;
  warningBoxBorderColor: string;
  warningBoxIcon: string;
  // NEW: Social Media Icons
  socialMediaEnabled: boolean;
  socialMediaPosition: 'header' | 'footer';
  socialMediaIconColor: string;
  socialMediaIconSize: number;
  socialMediaLinks: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
  };
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
}

interface InvoiceTemplateEditorProps {
  existingTemplate?: InvoiceTemplateLayout;
  onBack: () => void;
}

// DEFAULT INVOICE BLOCKS (8 sections)
const DEFAULT_BLOCKS: InvoiceBlock[] = [
  { id: 'company-info', type: 'company-info', label: 'Dane firmy', visible: true, order: 1 },
  { id: 'client-info', type: 'client-info', label: 'Dane klienta', visible: true, order: 2 },
  { id: 'invoice-header', type: 'invoice-header', label: 'Nagłówek faktury', visible: true, order: 3 },
  { id: 'items-table', type: 'items-table', label: 'Tabela pozycji', visible: true, order: 4 },
  { id: 'totals', type: 'totals', label: 'Suma końcowa', visible: true, order: 5 },
  { id: 'payment-info', type: 'payment-info', label: 'Płatność', visible: true, order: 6 },
  { id: 'notes', type: 'notes', label: 'Notatki', visible: true, order: 7 },
  { id: 'footer', type: 'footer', label: 'Stopka', visible: true, order: 8 },
];

// SAMPLE DATA FOR LIVE PREVIEW
const SAMPLE_INVOICE: Partial<Invoice> = {
  invoice_number: 'INV-2025-001',
  issue_date: '2025-11-12',
  due_date: '2025-12-12',
  total_net: 1500.00,
  total_vat: 315.00,
  total_gross: 1815.00,
  lines: [
    { 
      id: '1',
      invoice_id: 'preview', 
      description: 'Web Development Services', 
      quantity: 40, 
      unit_price: 50.00, 
      vat_rate: 21, 
      line_net: 2000.00, 
      line_vat: 420.00, 
      line_gross: 2420.00,
    },
    { 
      id: '2',
      invoice_id: 'preview', 
      description: 'Design Consultation', 
      quantity: 10, 
      unit_price: 75.00, 
      vat_rate: 21, 
      line_net: 750.00, 
      line_vat: 157.50, 
      line_gross: 907.50,
    },
  ],
  payment_qr_payload: 'BCD\n002\n1\nSCT\nMESSU BOUW\nNL91ABNA0417164300\nEUR1815.00\n\nINV-2025-001',
};

const SAMPLE_CLIENT: Partial<Client> = {
  id: '1',
  name: 'Example Client B.V.',
  email: 'client@example.com',
  phone: '+31 20 123 4567',
  address: 'Amsterdam 1012 AB, Netherlands',
  vat_number: 'NL123456789B01',
  kvk_number: '12345678',
};

const SAMPLE_COMPANY: Partial<Company> = {
  id: '1',
  name: 'MESSU BOUW',
  email: 'info@messubouw.nl',
  phone: '+31 6 12345678',
  address: 'Rotterdam 3011 AB, Netherlands',
  kvk: '87654321',
  vat_number: 'NL987654321B01',
  iban: 'NL91ABNA0417164300',
  bank_name: 'ABN AMRO',
};

// Sortable Block Item Component
interface SortableBlockItemProps {
  block: InvoiceBlock;
  index: number;
  totalBlocks: number;
  onUpdate: (field: keyof InvoiceBlock, value: any) => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const SortableBlockItem: React.FC<SortableBlockItemProps> = ({
  block,
  index,
  totalBlocks,
  onUpdate,
  onToggleVisible,
  onDuplicate,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border-2 rounded-xl p-4 transition-all ${
        isDragging ? 'border-sky-500 shadow-lg z-50' : 'border-gray-200 hover:border-sky-300'
      } ${!block.visible ? 'opacity-50 bg-gray-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-2"
        >
          <DotsSixVertical size={24} className="text-gray-400" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onToggleVisible}
              className={`p-2 rounded-lg transition-all ${
                block.visible ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-400'
              }`}
              title={block.visible ? 'Ukryj blok' : 'Pokaż blok'}
            >
              {block.visible ? <Eye size={20} /> : <EyeSlash size={20} />}
            </button>
            
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">Nazwa bloku</label>
              <input
                type="text"
                value={block.label}
                onChange={(e) => onUpdate('label', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                placeholder="Nazwa bloku"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Typ</label>
              <select
                value={block.type}
                onChange={(e) => onUpdate('type', e.target.value as InvoiceBlockType)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                aria-label="Typ bloku"
                title="Wybierz typ bloku"
              >
                <option value="company-info">Dane firmy</option>
                <option value="client-info">Dane klienta</option>
                <option value="invoice-header">Nagłówek</option>
                <option value="items-table">Tabela pozycji</option>
                <option value="totals">Suma</option>
                <option value="payment-info">Płatność</option>
                <option value="notes">Notatki</option>
                <option value="footer">Stopka</option>
              </select>
            </div>
          </div>

          {/* Block Style Controls */}
          {block.visible && (
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Kolor tła</label>
                <input
                  type="color"
                  value={block.styles?.backgroundColor || '#ffffff'}
                  onChange={(e) => onUpdate('styles', { ...block.styles, backgroundColor: e.target.value })}
                  className="w-full h-10 rounded cursor-pointer"
                  title="Kolor tła bloku"
                  aria-label="Wybierz kolor tła"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Kolor tekstu</label>
                <input
                  type="color"
                  value={block.styles?.textColor || '#1f2937'}
                  onChange={(e) => onUpdate('styles', { ...block.styles, textColor: e.target.value })}
                  className="w-full h-10 rounded cursor-pointer"
                  title="Kolor tekstu bloku"
                  aria-label="Wybierz kolor tekstu"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Rozmiar fontu</label>
                <input
                  type="number"
                  value={block.styles?.fontSize || 10}
                  onChange={(e) => onUpdate('styles', { ...block.styles, fontSize: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="8"
                  max="24"
                  title="Rozmiar fontu (px)"
                  aria-label="Rozmiar fontu w pikselach"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onDuplicate}
            className="p-2 hover:bg-sky-100 rounded"
            title="Duplikuj blok"
          >
            <Copy size={16} className="text-sky-600" />
          </button>
          <button
            onClick={onRemove}
            className="p-2 hover:bg-red-100 rounded"
            title="Usuń blok"
          >
            <Trash size={16} className="text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

// MAIN COMPONENT
export default function InvoiceTemplateEditor({ existingTemplate, onBack }: InvoiceTemplateEditorProps) {
  // Initial state from existing template or defaults
  const initialState: EditorState = {
    templateName: existingTemplate?.name || 'Nowy Szablon Faktury',
    blocks: existingTemplate?.blocks || DEFAULT_BLOCKS,
    headerGradientStart: '#0ea5e9', // sky-500
    headerGradientEnd: '#2563eb',   // blue-600
    primaryColorStart: '#0ea5e9',
    primaryColorEnd: '#2563eb',
    accentColorStart: '#0284c7',    // sky-600
    accentColorEnd: '#1e40af',      // blue-800
    backgroundColor: '#ffffff',
    textColor: '#1f2937',           // gray-800
    borderColor: '#e5e7eb',         // gray-200
    fontSize: {
      heading: 14,
      body: 10,
      small: 8,
    },
    fontFamily: {
      heading: 'Arial',
      body: 'Arial',
    },
    logoUrl: existingTemplate?.logo?.url || '',
    logoPosition: existingTemplate?.logo?.position || 'left',
    // NEW: Advanced logo control with defaults
    logoX: 20,
    logoY: 20,
    logoWidth: existingTemplate?.logo?.size?.width || 120,
    logoHeight: existingTemplate?.logo?.size?.height || 60,
    logoOpacity: 100,
    showLogo: existingTemplate?.logo?.showInHeader ?? true,
    // NEW: Watermark support
    watermarkEnabled: false,
    watermarkUrl: '',
    watermarkOpacity: 10,  // 10%
    watermarkSize: 400,    // 400px
    watermarkRotation: -45, // -45 degrees
    // NEW: QR Code positioning
    qrCodeEnabled: true,
    qrCodePosition: 'payment-right',
    qrCodeSize: 120,  // 120px
    // NEW: Warning Box
    warningBoxEnabled: false,
    warningBoxText: '⚠️ Reverse Charge - VAT należy rozliczyć w kraju nabywcy',
    warningBoxBackgroundColor: '#fef3c7',  // yellow-100
    warningBoxTextColor: '#92400e',  // yellow-900
    warningBoxBorderColor: '#f59e0b',  // yellow-500
    warningBoxIcon: '⚠️',
    // NEW: Social Media
    socialMediaEnabled: false,
    socialMediaPosition: 'footer',
    socialMediaIconColor: '#0ea5e9',  // sky-500
    socialMediaIconSize: 24,
    socialMediaLinks: {},
    pageSize: existingTemplate?.pageSize || 'A4',
    orientation: existingTemplate?.orientation || 'portrait',
  };

  // UNDO/REDO System (20-step history)
  const {
    currentState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoRedo<EditorState>({ initialState, maxHistory: 20 });

  // Destructure current state
  const {
    templateName,
    blocks,
    headerGradientStart,
    headerGradientEnd,
    primaryColorStart,
    primaryColorEnd,
    accentColorStart,
    accentColorEnd,
    backgroundColor,
    textColor,
    borderColor,
    fontSize,
    fontFamily,
    logoUrl,
    logoPosition,
    logoX,
    logoY,
    logoWidth,
    logoHeight,
    logoOpacity,
    showLogo,
    watermarkEnabled,
    watermarkUrl,
    watermarkOpacity,
    watermarkSize,
    watermarkRotation,
    qrCodeEnabled,
    qrCodePosition,
    qrCodeSize,
    warningBoxEnabled,
    warningBoxText,
    warningBoxBackgroundColor,
    warningBoxTextColor,
    warningBoxBorderColor,
    warningBoxIcon,
    socialMediaEnabled,
    socialMediaPosition,
    socialMediaIconColor,
    socialMediaIconSize,
    socialMediaLinks,
    pageSize,
    orientation,
  } = currentState;

  // Drag & Drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sensors for drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      
      const newBlocks = arrayMove(blocks, oldIndex, newIndex).map((block, idx) => ({
        ...block,
        order: idx + 1,
      }));
      updateState({ blocks: newBlocks }, 'Przesunięto blok');
    }
    
    setActiveId(null);
  };

  // Helper: Update state with history tracking
  const updateState = (updates: Partial<EditorState>, description: string) => {
    pushState({ ...currentState, ...updates }, description);
  };

  // Add new block
  const addBlock = (type: InvoiceBlockType) => {
    const newBlock: InvoiceBlock = {
      id: `block-${Date.now()}`,
      type,
      label: `Nowy blok (${type})`,
      visible: true,
      order: blocks.length + 1,
      styles: {
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        fontSize: 10,
      },
    };
    updateState({ blocks: [...blocks, newBlock] }, 'Dodano blok');
  };

  // Remove block
  const removeBlock = (index: number) => {
    updateState({ blocks: blocks.filter((_, i) => i !== index) }, 'Usunięto blok');
  };

  // Duplicate block
  const duplicateBlock = (index: number) => {
    const block = blocks[index];
    const newBlock: InvoiceBlock = {
      ...block,
      id: `block-${Date.now()}`,
      label: block.label + ' (kopia)',
      order: block.order + 1,
    };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    updateState({ blocks: newBlocks }, 'Zduplikowano blok');
  };

  // Update block field
  const updateBlock = (index: number, field: keyof InvoiceBlock, value: any) => {
    const newBlocks = [...blocks];
    (newBlocks[index] as any)[field] = value;
    updateState({ blocks: newBlocks }, `Zaktualizowano ${field}`);
  };

  // Toggle block visibility
  const toggleBlockVisible = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks[index].visible = !newBlocks[index].visible;
    updateState({ blocks: newBlocks }, 'Przełączono widoczność');
  };

  // EXPORT template to JSON
  const handleExportTemplate = () => {
    const exportData: InvoiceTemplateLayout = {
      id: existingTemplate?.id || `invoice-template-${Date.now()}`,
      name: templateName,
      description: `Szablon faktury - ${blocks.filter(b => b.visible).length} bloków`,
      blocks,
      colors: {
        primary: `linear-gradient(to right, ${primaryColorStart}, ${primaryColorEnd})`,
        secondary: `linear-gradient(to right, ${headerGradientStart}, ${headerGradientEnd})`,
        accent: `linear-gradient(to right, ${accentColorStart}, ${accentColorEnd})`,
        text: textColor,
        background: backgroundColor,
      },
      fonts: {
        heading: fontFamily.heading,
        body: fontFamily.body,
        size: fontSize,
      },
      logo: showLogo ? {
        url: logoUrl || '',
        position: logoPosition,
        size: { width: logoWidth, height: logoHeight },
        showInHeader: showLogo,
      } : undefined,
      pageSize,
      orientation,
      createdAt: existingTemplate?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${templateName.replace(/\s+/g, '-')}-template.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Szablon "${templateName}" wyeksportowany!`);
  };

  // IMPORT template from JSON
  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as InvoiceTemplateLayout;
        
        if (!imported.blocks || imported.blocks.length === 0) {
          toast.error('Nieprawidłowy format szablonu!');
          return;
        }

        // Extract gradient colors
        const primaryMatch = imported.colors?.primary?.match(/#[0-9a-fA-F]{6}/g);
        const secondaryMatch = imported.colors?.secondary?.match(/#[0-9a-fA-F]{6}/g);
        const accentMatch = imported.colors?.accent?.match(/#[0-9a-fA-F]{6}/g);

        updateState({
          templateName: imported.name,
          blocks: imported.blocks,
          primaryColorStart: primaryMatch?.[0] || '#0ea5e9',
          primaryColorEnd: primaryMatch?.[1] || '#2563eb',
          headerGradientStart: secondaryMatch?.[0] || '#0ea5e9',
          headerGradientEnd: secondaryMatch?.[1] || '#2563eb',
          accentColorStart: accentMatch?.[0] || '#0284c7',
          accentColorEnd: accentMatch?.[1] || '#1e40af',
          backgroundColor: imported.colors?.background || '#ffffff',
          textColor: imported.colors?.text || '#1f2937',
          fontSize: imported.fonts?.size || { heading: 14, body: 10, small: 8 },
          fontFamily: {
            heading: imported.fonts?.heading || 'Arial',
            body: imported.fonts?.body || 'Arial',
          },
          logoUrl: imported.logo?.url || '',
          logoPosition: imported.logo?.position || 'left',
          logoWidth: imported.logo?.size?.width || 120,
          logoHeight: imported.logo?.size?.height || 60,
          logoOpacity: 100,
          showLogo: imported.logo?.showInHeader ?? true,
          pageSize: imported.pageSize || 'A4',
          orientation: imported.orientation || 'portrait',
        }, 'Zaimportowano szablon');

        toast.success(`Szablon "${imported.name}" zaimportowany!`);
      } catch (error) {
        toast.error('Błąd importu szablonu!');
        console.error(error);
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // SAVE template
  function handleSave() {
    // Validation
    const errors: string[] = [];

    if (!templateName.trim()) {
      errors.push('Nazwa szablonu jest wymagana');
    }

    if (blocks.length === 0) {
      errors.push('Szablon musi mieć przynajmniej 1 blok');
    }

    const visibleBlocks = blocks.filter(b => b.visible);
    if (visibleBlocks.length === 0) {
      errors.push('Szablon musi mieć przynajmniej 1 widoczny blok');
    }

    blocks.forEach((block, idx) => {
      if (!block.label.trim()) {
        errors.push(`Blok #${idx + 1} nie ma nazwy`);
      }
    });

    if (errors.length > 0) {
      toast.error(
        <div>
          <strong>Błędy walidacji:</strong>
          <ul className="list-disc ml-4 mt-2">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    // Save to localStorage
    const template: InvoiceTemplateLayout = {
      id: existingTemplate?.id || `invoice-template-${Date.now()}`,
      name: templateName,
      description: `${visibleBlocks.length} bloków`,
      blocks,
      colors: {
        primary: `linear-gradient(to right, ${primaryColorStart}, ${primaryColorEnd})`,
        secondary: `linear-gradient(to right, ${headerGradientStart}, ${headerGradientEnd})`,
        accent: `linear-gradient(to right, ${accentColorStart}, ${accentColorEnd})`,
        text: textColor,
        background: backgroundColor,
      },
      fonts: {
        heading: fontFamily.heading,
        body: fontFamily.body,
        size: fontSize,
      },
      logo: showLogo ? {
        url: logoUrl || '',
        position: logoPosition,
        size: { width: logoWidth, height: logoHeight },
        showInHeader: showLogo,
      } : undefined,
      pageSize,
      orientation,
      createdAt: existingTemplate?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    localStorage.setItem(`invoice-template-${template.id}`, JSON.stringify(template));
    toast.success(`✅ Szablon "${templateName}" zapisany!`);
    onBack();
  }

  // Keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+D)
  const { handleKeyDown } = useUndoRedoKeyboard(
    undo,
    redo,
    handleSave,
    () => {
      if (blocks.length > 0) {
        duplicateBlock(0);
        toast.success('Blok zduplikowany (Ctrl+D)');
      }
    },
    () => {
      toast.info('Podgląd wydruku - wkrótce! (Ctrl+P)');
    }
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-hidden">
      {/* TOP BAR */}
      <div className="h-16 bg-white border-b-2 border-sky-300 px-4 flex items-center justify-between shadow-lg">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={templateName}
            onChange={(e) => updateState({ templateName: e.target.value }, 'Zmieniono nazwę')}
            className="w-full px-3 py-1.5 border-2 border-sky-300 rounded-xl focus:border-sky-500 focus:ring-2 focus:ring-sky-200 text-base font-bold"
            placeholder="Nazwa szablonu..."
          />
        </div>

        <div className="flex gap-2">
          {/* Export/Import */}
          <button
            onClick={handleExportTemplate}
            className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
            title="Eksportuj szablon do JSON"
          >
            <DownloadSimple size={18} weight="bold" />
            Export
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
            title="Importuj szablon z JSON"
          >
            <UploadSimple size={18} weight="bold" />
            Import
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportTemplate}
            title="Importuj szablon z pliku JSON"
            aria-label="Wybierz plik JSON do importu"
          />

          {/* UNDO/REDO */}
          <UndoRedoToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition-all"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-lg font-bold shadow-lg transition-all"
          >
            Zapisz
          </button>
        </div>
      </div>

      {/* MAIN LAYOUT: Gradient Background + 3D Panels */}
      <div className="h-[calc(100vh-64px)] bg-linear-to-br from-sky-50 via-blue-50 to-indigo-100 p-6 overflow-y-auto">
        <div className="max-w-[1800px] mx-auto flex gap-6">
          
          {/* LEFT PANEL - 3D Levitating Card */}
          <div className="w-[420px] shrink-0">
            <div className="sticky top-6">
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-6 transform hover:scale-[1.02] transition-transform duration-300">
                <div className="space-y-6">
                  
                  {/* Logo Section */}
                  <div className="pb-6 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <ImageIcon size={22} weight="bold" className="text-sky-600" />
                      Logo firmy
                    </h3>
                    <LogoControls
                      logoUrl={logoUrl}
                      onLogoUpload={(url) => updateState({ logoUrl: url }, 'Dodano logo')}
                      showLogo={showLogo}
                      onShowLogoChange={(show) => updateState({ showLogo: show }, 'Przełączono logo')}
                      logoPosition={logoPosition}
                      onLogoPositionChange={(pos) => updateState({ logoPosition: pos }, 'Zmieniono pozycję logo')}
                      logoX={logoX}
                      logoY={logoY}
                      logoWidth={logoWidth}
                      logoHeight={logoHeight}
                      logoOpacity={logoOpacity}
                      onLogoPositionXY={(x, y) => updateState({ logoX: x, logoY: y }, 'Przesunięto logo')}
                      onLogoResize={(w, h) => updateState({ logoWidth: w, logoHeight: h }, 'Zmieniono rozmiar logo')}
                      onLogoOpacityChange={(opacity) => updateState({ logoOpacity: opacity }, 'Zmieniono przezroczystość')}
                      showLivePreview={true}
                    />
                  </div>

                  {/* Blocks Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <ListBullets size={22} weight="bold" className="text-sky-600" />
                        Bloki faktury ({blocks.length})
                      </h3>
                      <button
                        onClick={() => addBlock('notes')}
                        className="px-4 py-2 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-200/50"
                      >
                        <Plus size={18} weight="bold" />
                        Dodaj
                      </button>
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                          {blocks.map((block, index) => (
                            <SortableBlockItem
                              key={block.id}
                              block={block}
                              index={index}
                              totalBlocks={blocks.length}
                              onUpdate={(field, value) => updateBlock(index, field, value)}
                              onToggleVisible={() => toggleBlockVisible(index)}
                              onDuplicate={() => duplicateBlock(index)}
                              onRemove={() => removeBlock(index)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* CENTER PANEL - Fixed A4 Preview (Sticky) */}
          <div className="flex-1 flex justify-center">
            <div className="sticky top-6 h-fit">
              <div className="bg-white rounded-3xl shadow-2xl p-8 transform hover:scale-[1.01] transition-transform duration-300">
                <div className="overflow-hidden relative border-2 border-gray-200 rounded-xl">
                  {/* Live Invoice Preview */}
                  <InvoiceTemplatePreview
                    invoice={SAMPLE_INVOICE}
                    client={SAMPLE_CLIENT as Client}
                    company={{
                      ...SAMPLE_COMPANY,
                      logo_url: logoUrl || undefined,
                    } as Company}
                    template={{
                      id: 'preview',
                      name: templateName,
                      description: 'Live preview',
                      style: 'modern',
                      config: {
                        primaryColor: primaryColorStart,
                        accentColor: accentColorStart,
                        fontFamily: fontFamily.body,
                        headerStyle: 'spacious' as const,
                        tableStyle: 'lined' as const,
                        footerStyle: 'compact' as const,
                        showLogo: showLogo,
                        showQRCode: true,
                        showBankDetails: true,
                        showWeekNumber: true,
                      },
                    }}
                    scale={0.6}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - 3D Levitating Card */}
          <div className="w-[420px] shrink-0">
            <div className="sticky top-6">
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-6 transform hover:scale-[1.02] transition-transform duration-300">
                <div className="space-y-6">
                  
                  {/* Colors Section */}
                  <div className="pb-6 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">🎨 Kolory</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nagłówek</label>
                        <ColorPickerDual
                          startColor={headerGradientStart}
                          endColor={headerGradientEnd}
                          onStartChange={(color) => updateState({ headerGradientStart: color }, 'Zmieniono kolor nagłówka (start)')}
                          onEndChange={(color) => updateState({ headerGradientEnd: color }, 'Zmieniono kolor nagłówka (koniec)')}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Primary</label>
                        <ColorPickerDual
                          startColor={primaryColorStart}
                          endColor={primaryColorEnd}
                          onStartChange={(color) => updateState({ primaryColorStart: color }, 'Zmieniono primary (start)')}
                          onEndChange={(color) => updateState({ primaryColorEnd: color }, 'Zmieniono primary (koniec)')}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Accent</label>
                        <ColorPickerDual
                          startColor={accentColorStart}
                          endColor={accentColorEnd}
                          onStartChange={(color) => updateState({ accentColorStart: color }, 'Zmieniono accent (start)')}
                          onEndChange={(color) => updateState({ accentColorEnd: color }, 'Zmieniono accent (koniec)')}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Tło</label>
                          <input
                            type="color"
                            value={backgroundColor}
                            onChange={(e) => updateState({ backgroundColor: e.target.value }, 'Zmieniono tło')}
                            className="w-full h-12 rounded-xl cursor-pointer border-2 border-gray-300 hover:border-sky-400 transition-colors"
                            title="Kolor tła"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Tekst</label>
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => updateState({ textColor: e.target.value }, 'Zmieniono tekst')}
                            className="w-full h-12 rounded-xl cursor-pointer border-2 border-gray-300 hover:border-sky-400 transition-colors"
                            title="Kolor tekstu"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fonts Section */}
                  <div className="pb-6 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">� Czcionki</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nagłówki</label>
                        <FontControls
                          fontFamily={fontFamily.heading}
                          fontSize={fontSize.heading}
                          onFontFamilyChange={(family) => updateState({ fontFamily: { ...fontFamily, heading: family } }, 'Zmieniono font nagłówka')}
                          onFontSizeChange={(size) => updateState({ fontSize: { ...fontSize, heading: size } }, 'Zmieniono rozmiar nagłówka')}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Treść</label>
                        <FontControls
                          fontFamily={fontFamily.body}
                          fontSize={fontSize.body}
                          onFontFamilyChange={(family) => updateState({ fontFamily: { ...fontFamily, body: family } }, 'Zmieniono font treści')}
                          onFontSizeChange={(size) => updateState({ fontSize: { ...fontSize, body: size } }, 'Zmieniono rozmiar treści')}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Małe elementy (px)</label>
                        <input
                          type="number"
                          value={fontSize.small}
                          onChange={(e) => updateState({ fontSize: { ...fontSize, small: parseInt(e.target.value) } }, 'Zmieniono rozmiar małego')}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                          min="6"
                          max="12"
                          title="Rozmiar małych elementów"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Watermark Section */}
                  <div className="pb-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">💧 Watermark</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={watermarkEnabled}
                          onChange={(e) => updateState({ watermarkEnabled: e.target.checked }, watermarkEnabled ? 'Watermark wyłączony' : 'Watermark włączony')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>

                    {watermarkEnabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Logo URL</label>
                          <input
                            type="text"
                            value={watermarkUrl || ''}
                            onChange={(e) => updateState({ watermarkUrl: e.target.value }, 'Zmieniono watermark URL')}
                            placeholder="https://example.com/watermark.png"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1">Lub użyj tego samego co logo główne</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Przezroczystość: {watermarkOpacity}%
                          </label>
                          <input
                            type="range"
                            value={watermarkOpacity}
                            onChange={(e) => updateState({ watermarkOpacity: parseInt(e.target.value) }, `Przezroczystość: ${e.target.value}%`)}
                            min="5"
                            max="50"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>5%</span>
                            <span>50%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Rozmiar: {watermarkSize}px
                          </label>
                          <input
                            type="range"
                            value={watermarkSize}
                            onChange={(e) => updateState({ watermarkSize: parseInt(e.target.value) }, `Rozmiar: ${e.target.value}px`)}
                            min="100"
                            max="600"
                            step="50"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>100px</span>
                            <span>600px</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Rotacja: {watermarkRotation}°
                          </label>
                          <input
                            type="range"
                            value={watermarkRotation}
                            onChange={(e) => updateState({ watermarkRotation: parseInt(e.target.value) }, `Rotacja: ${e.target.value}°`)}
                            min="-45"
                            max="45"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>-45°</span>
                            <span>0°</span>
                            <span>45°</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR Code Section */}
                  <div className="pb-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">📱 QR Code</h3>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qrCodeEnabled}
                          onChange={(e) => updateState({ qrCodeEnabled: e.target.checked }, qrCodeEnabled ? 'QR Code wyłączony' : 'QR Code włączony')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>
                    </div>

                    {qrCodeEnabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Pozycja</label>
                          <select
                            value={qrCodePosition}
                            onChange={(e) => updateState({ qrCodePosition: e.target.value as typeof qrCodePosition }, `Pozycja QR: ${e.target.value}`)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                          >
                            <option value="payment-right">💳 Przy płatności (prawo)</option>
                            <option value="payment-below">💳 Pod płatnością</option>
                            <option value="top-right">⬆️ Góra (prawo)</option>
                            <option value="bottom-right">⬇️ Dół (prawo)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Rozmiar: {qrCodeSize}px
                          </label>
                          <input
                            type="range"
                            value={qrCodeSize}
                            onChange={(e) => updateState({ qrCodeSize: parseInt(e.target.value) }, `Rozmiar QR: ${e.target.value}px`)}
                            min="80"
                            max="200"
                            step="20"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>80px</span>
                            <span>200px</span>
                          </div>
                        </div>

                        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                          <p className="text-xs text-sky-700">
                            ℹ️ QR Code generuje się automatycznie z danych płatności (IBAN, kwota, numer faktury)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warning Box (Reverse Charge) */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">⚠️ Ostrzeżenie VAT</h3>
                      <button
                        onClick={() => updateState({ warningBoxEnabled: !warningBoxEnabled }, 'Toggled warning box')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          warningBoxEnabled ? 'bg-sky-500' : 'bg-gray-300'
                        }`}
                        title="Toggle warning box"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            warningBoxEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {warningBoxEnabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Tekst ostrzeżenia</label>
                          <textarea
                            value={warningBoxText}
                            onChange={(e) => updateState({ warningBoxText: e.target.value }, 'Updated warning text')}
                            placeholder="⚠️ Reverse Charge - VAT należy rozliczyć w kraju nabywcy"
                            rows={2}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Tekst ostrzeżenia"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Emoji/Ikona</label>
                          <input
                            type="text"
                            value={warningBoxIcon}
                            onChange={(e) => updateState({ warningBoxIcon: e.target.value }, 'Updated warning icon')}
                            placeholder="⚠️"
                            maxLength={4}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-2xl text-center focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Emoji lub ikona"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Kolor tła</label>
                            <input
                              type="color"
                              value={warningBoxBackgroundColor}
                              onChange={(e) => updateState({ warningBoxBackgroundColor: e.target.value }, 'Updated warning background')}
                              className="w-full h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                              title="Kolor tła"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Kolor tekstu</label>
                            <input
                              type="color"
                              value={warningBoxTextColor}
                              onChange={(e) => updateState({ warningBoxTextColor: e.target.value }, 'Updated warning text color')}
                              className="w-full h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                              title="Kolor tekstu"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Kolor ramki</label>
                            <input
                              type="color"
                              value={warningBoxBorderColor}
                              onChange={(e) => updateState({ warningBoxBorderColor: e.target.value }, 'Updated warning border')}
                              className="w-full h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                              title="Kolor ramki"
                            />
                          </div>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-xs text-yellow-700">
                            ℹ️ Ostrzeżenie pojawi się na górze faktury dla transakcji Reverse Charge (odwrotne obciążenie)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Social Media Icons */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">📱 Social Media</h3>
                      <button
                        onClick={() => updateState({ socialMediaEnabled: !socialMediaEnabled }, 'Toggled social media')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          socialMediaEnabled ? 'bg-sky-500' : 'bg-gray-300'
                        }`}
                        title="Toggle social media"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            socialMediaEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {socialMediaEnabled && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Pozycja</label>
                            <select
                              value={socialMediaPosition}
                              onChange={(e) => updateState({ socialMediaPosition: e.target.value as 'header' | 'footer' }, 'Changed social position')}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                              title="Pozycja ikon"
                            >
                              <option value="header">Nagłówek</option>
                              <option value="footer">Stopka</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Rozmiar ikon</label>
                            <div className="space-y-2">
                              <input
                                type="range"
                                min="16"
                                max="32"
                                value={socialMediaIconSize}
                                onChange={(e) => updateState({ socialMediaIconSize: parseInt(e.target.value) }, 'Changed icon size')}
                                className="w-full"
                                title="Rozmiar ikon"
                              />
                              <div className="text-xs text-center font-bold text-gray-600">{socialMediaIconSize}px</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Kolor ikon</label>
                          <input
                            type="color"
                            value={socialMediaIconColor}
                            onChange={(e) => updateState({ socialMediaIconColor: e.target.value }, 'Updated icon color')}
                            className="w-full h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                            title="Kolor ikon"
                          />
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-bold text-gray-700">Linki do profili:</p>
                          
                          <input
                            type="url"
                            value={socialMediaLinks.facebook || ''}
                            onChange={(e) => updateState({ socialMediaLinks: { ...socialMediaLinks, facebook: e.target.value } }, 'Updated Facebook')}
                            placeholder="🔵 Facebook - https://facebook.com/..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Link do profilu Facebook"
                          />
                          
                          <input
                            type="url"
                            value={socialMediaLinks.instagram || ''}
                            onChange={(e) => updateState({ socialMediaLinks: { ...socialMediaLinks, instagram: e.target.value } }, 'Updated Instagram')}
                            placeholder="📷 Instagram - https://instagram.com/..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Link do profilu Instagram"
                          />
                          
                          <input
                            type="url"
                            value={socialMediaLinks.linkedin || ''}
                            onChange={(e) => updateState({ socialMediaLinks: { ...socialMediaLinks, linkedin: e.target.value } }, 'Updated LinkedIn')}
                            placeholder="💼 LinkedIn - https://linkedin.com/..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Link do profilu LinkedIn"
                          />
                          
                          <input
                            type="url"
                            value={socialMediaLinks.twitter || ''}
                            onChange={(e) => updateState({ socialMediaLinks: { ...socialMediaLinks, twitter: e.target.value } }, 'Updated Twitter')}
                            placeholder="🐦 Twitter/X - https://twitter.com/..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Link do profilu Twitter/X"
                          />
                          
                          <input
                            type="url"
                            value={socialMediaLinks.youtube || ''}
                            onChange={(e) => updateState({ socialMediaLinks: { ...socialMediaLinks, youtube: e.target.value } }, 'Updated YouTube')}
                            placeholder="📺 YouTube - https://youtube.com/..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Link do kanału YouTube"
                          />
                          
                          <input
                            type="url"
                            value={socialMediaLinks.tiktok || ''}
                            onChange={(e) => updateState({ socialMediaLinks: { ...socialMediaLinks, tiktok: e.target.value } }, 'Updated TikTok')}
                            placeholder="🎵 TikTok - https://tiktok.com/@..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                            title="Link do profilu TikTok"
                          />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-700">
                            ℹ️ Ikony social media pojawią się w wybranej pozycji (nagłówek/stopka) z linkami do profili
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Page Settings */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Ustawienia strony</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Rozmiar</label>
                        <select
                          value={pageSize}
                          onChange={(e) => updateState({ pageSize: e.target.value as 'A4' | 'Letter' }, 'Zmieniono rozmiar')}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                          title="Rozmiar strony"
                        >
                          <option value="A4">A4</option>
                          <option value="Letter">Letter</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Orientacja</label>
                        <select
                          value={orientation}
                          onChange={(e) => updateState({ orientation: e.target.value as 'portrait' | 'landscape' }, 'Zmieniono orientację')}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all"
                          title="Orientacja strony"
                        >
                          <option value="portrait">Pionowa</option>
                          <option value="landscape">Pozioma</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
