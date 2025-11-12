/**
 * TIMESHEETS - KARTY PRACY / GODZINY PRACY
 * 
 * Funkcje:
 * - Szablon tygodniowy (Pon-Niedz)
 * - Adres budowy + szczegóły projektu
 * - Edycja godzin start/koniec + przerwa
 * - Automatyczne wyliczenie godzin dziennie
 * - Stawka godzinowa → automatyczne wyliczenie kwoty
 * - Export do PDF z logo (gotowy do wydruku)
 * - Zapisywanie szablonów (budowy + pracownicy)
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudio } from '@/contexts/AudioContext';
import { useTimesheets } from '@/hooks/useElectronDB';
import { Timesheet, DayHours } from '@/types';
import { 
  Printer, 
  Download, 
  Plus, 
  Trash, 
  Copy,
  Calendar,
  MapPin,
  User,
  Clock,
  CurrencyEur,
  FilePdf,
  ShareNetwork
} from '@phosphor-icons/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ============================================
// POMOCNICZE FUNKCJE
// ============================================

// Generuj 7 dni od poniedziałku
function generateWeekDays(startDate: Date): DayHours[] {
  const days: DayHours[] = [];
  const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  
  // Znajdź poprzedni poniedziałek
  const monday = new Date(startDate);
  const dayOfWeek = monday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Niedziela = 0, więc -6 dni
  monday.setDate(monday.getDate() + diff);
  
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(monday);
    currentDay.setDate(monday.getDate() + i);
    
    days.push({
      date: currentDay.toISOString().split('T')[0],
      dayName: dayNames[currentDay.getDay()],
      startTime: '07:00',
      endTime: '16:00',
      breakMinutes: 60,
      workedHours: 0,
      notes: ''
    });
  }
  
  return days;
}

// Oblicz godziny pracy
function calculateWorkedHours(start: string, end: string, breakMinutes: number): number {
  if (!start || !end) return 0;
  
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  
  const totalMinutes = endTotalMin - startTotalMin - breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

// Format daty PL
function formatDatePL(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================
// KOMPONENT GŁÓWNY
// ============================================

export function Timesheets() {
  const { t, i18n } = useTranslation();
  const { isMuted } = useAudio();
  const { timesheets, loading, createTimesheet, updateTimesheet, deleteTimesheet } = useTimesheets();
  const [currentSheet, setCurrentSheet] = useState<Timesheet | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = () => {
    if (!printRef.current) return;
    
    // Metoda kompatybilna z mobile - używamy window.print() bez manipulacji DOM
    // Tworzymy nowe okno lub używamy CSS media print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback jeśli popup zablokowany - użyj iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Karta Pracy - MESSU BOUW</title>
            <style>
              @media print {
                @page { margin: 1cm; }
                body { margin: 0; padding: 20px; }
              }
              body { 
                font-family: Arial, sans-serif; 
                background: white; 
                color: black;
                max-width: 210mm;
                margin: 0 auto;
              }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            </style>
          </head>
          <body>
            ${printRef.current?.innerHTML || ''}
          </body>
          </html>
        `);
        iframeDoc.close();
        
        // Czekaj na załadowanie i drukuj
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
      }
    } else {
      // Nowe okno działa - użyj go
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Karta Pracy - MESSU BOUW</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              body { margin: 0; padding: 20px; }
            }
            body { 
              font-family: Arial, sans-serif; 
              background: white; 
              color: black;
              max-width: 210mm;
              margin: 0 auto;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>
          ${printRef.current?.innerHTML || ''}
        </body>
        </html>
      `);
      printWindow.document.close();
      
      // Czekaj na załadowanie obrazków i drukuj
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      }, 500);
    }
  };

  // Generuj PDF dla mobile (bardziej niezawodne niż window.print na telefonie)
  const handleDownloadPDF = async () => {
    if (!printRef.current || !currentSheet) return;
    
    try {
      // Pokaż komunikat ładowania
      const loadingToast = document.createElement('div');
      loadingToast.textContent = '⏳ Generuję PDF...';
      loadingToast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-weight:600;';
      document.body.appendChild(loadingToast);

      // Przygotuj element do konwersji
      const element = printRef.current;
      
      // Konwertuj HTML na canvas
      const canvas = await html2canvas(element, {
        scale: 2, // Wyższa jakość
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Oblicz wymiary dla PDF (A4: 210mm x 297mm)
      const imgWidth = 210; // mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Utwórz PDF
      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Dodaj obraz canvas do PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      const filename = `Karta_Pracy_${currentSheet.employeeName || 'MESSU_BOUW'}_${formatDatePL(currentSheet.weekStartDate)}.pdf`;
      
      // Usuń komunikat ładowania
      document.body.removeChild(loadingToast);

      // Spróbuj użyć Web Share API (działa na mobile)
      if (navigator.share && navigator.canShare) {
        try {
          const pdfBlob = pdf.output('blob');
          const file = new File([pdfBlob], filename, { type: 'application/pdf' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Karta Pracy - MESSU BOUW',
              text: `Karta pracy: ${currentSheet.employeeName}`
            });
            showSuccessToast('✅ PDF udostępniony!');
            return;
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.log('Web Share API error:', err);
          }
          // Jeśli użytkownik anulował lub błąd, kontynuuj do pobierania
        }
      }
      
      // Fallback: standardowe pobieranie (działa wszędzie)
      pdf.save(filename);
      showSuccessToast('✅ PDF pobrany!');
      
    } catch (error) {
      console.error('Błąd generowania PDF:', error);
      alert('❌ Nie udało się wygenerować PDF. Spróbuj ponownie.');
    }
  };

  // Helper do pokazywania toastów sukcesu
  const showSuccessToast = (message: string) => {
    const successToast = document.createElement('div');
    successToast.textContent = message;
    successToast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-weight:600;';
    document.body.appendChild(successToast);
    setTimeout(() => {
      if (document.body.contains(successToast)) {
        document.body.removeChild(successToast);
      }
    }, 3000);
  };

  // Nowa karta pracy
  const createNewTimesheet = () => {
    const today = new Date();
    const days = generateWeekDays(today);
    
    const monday = days[1].date; // Poniedziałek (indeks 1, bo 0 to Niedziela)
    const sunday = days[0].date; // Niedziela
    
    const newSheet: Timesheet = {
      id: Date.now().toString(),
      weekStartDate: monday,
      weekEndDate: sunday,
      employeeName: '',
      employeeAddress: '',
      employeePhone: '',
      projectName: '',
      projectAddress: '',
      projectClient: '',
      hourlyRate: 20,
      days: days,
      totalHours: 0,
      totalAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setCurrentSheet(newSheet);
  };

  // Aktualizuj dane dnia
  const updateDay = (dayIndex: number, field: keyof DayHours, value: any) => {
    if (!currentSheet) return;
    
    const updatedDays = [...currentSheet.days];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      [field]: value
    };
    
    // Przelicz godziny dla tego dnia
    if (field === 'startTime' || field === 'endTime' || field === 'breakMinutes') {
      updatedDays[dayIndex].workedHours = calculateWorkedHours(
        updatedDays[dayIndex].startTime,
        updatedDays[dayIndex].endTime,
        updatedDays[dayIndex].breakMinutes
      );
    }
    
    // Zsumuj całość
    const totalHours = updatedDays.reduce((sum, day) => sum + day.workedHours, 0);
    const totalAmount = totalHours * currentSheet.hourlyRate;
    
    setCurrentSheet({
      ...currentSheet,
      days: updatedDays,
      totalHours,
      totalAmount,
      updatedAt: new Date().toISOString()
    });
  };

  // Zapisz kartę pracy
  const saveTimesheet = async () => {
    if (!currentSheet) return;
    
    setIsSaving(true);
    try {
      const existingIndex = timesheets.findIndex(t => t.id === currentSheet.id);
      
      if (existingIndex >= 0) {
        // Aktualizuj istniejącą kartę
        await updateTimesheet(currentSheet.id, currentSheet);
        alert('✅ Karta pracy zaktualizowana!');
      } else {
        // Dodaj nową kartę
        await createTimesheet(currentSheet);
        alert('✅ Karta pracy zapisana!');
      }
    } catch (error) {
      console.error('Error saving timesheet:', error);
      alert('❌ Błąd podczas zapisywania karty pracy');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (!currentSheet) {
    return (
      <div className="max-w-7xl mx-auto p-6">
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
              <source src="/godziny pracy.mp4" type="video/mp4" />
            </video>
          </div>

          {/* PRAWA STRONA: Tekst i przyciski */}
          <div className="flex flex-col justify-center px-4 md:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-black mb-3 md:mb-4 tracking-tight">
              ⏰ Godziny Pracy
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-black mb-6 md:mb-8 font-medium">
              Twórz profesjonalne karty czasu pracy
            </p>
            <button onClick={createNewTimesheet} className="px-10 py-5 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-2xl font-black text-lg shadow-2xl transition-all duration-500 hover:scale-105 flex items-center gap-3 w-fit">
              <Plus size={24} weight="bold" />
              Nowa Karta Pracy
            </button>
          </div>
        </div>

        {/* Lista zapisanych kart */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {timesheets.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <Clock size={64} className="mx-auto text-black mb-4" />
              <p className="text-black text-lg">
                Brak zapisanych kart pracy
              </p>
              <p className="text-black text-sm mt-2">
                Kliknij "Nowa Karta Pracy" aby rozpocząć
              </p>
            </div>
          ) : (
            timesheets.map(sheet => (
              <div
                key={sheet.id}
                className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setCurrentSheet(sheet)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-black">
                      {sheet.employeeName || 'Bez nazwy'}
                    </h3>
                    <p className="text-sm text-black">
                      {formatDatePL(sheet.weekStartDate)} - {formatDatePL(sheet.weekEndDate)}
                    </p>
                  </div>
                  <Clock size={24} className="text-sky-500" />
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-black">
                    <MapPin size={16} />
                    <span>{sheet.projectAddress || 'Brak adresu'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Clock size={16} />
                    <span className="font-mono">{sheet.totalHours.toFixed(2)}h</span>
                  </div>
                  <div className="flex items-center gap-2 text-sky-600 font-bold">
                    <CurrencyEur size={16} />
                    <span className="font-mono">{sheet.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // EDYTOR KARTY PRACY
  // ============================================

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header z akcjami */}
      <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black">
              Karta Pracy - Tydzień {formatDatePL(currentSheet.weekStartDate)}
            </h2>
            <p className="text-black text-sm mt-1">
              {formatDatePL(currentSheet.weekStartDate)} - {formatDatePL(currentSheet.weekEndDate)}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentSheet(null)}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all"
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button
              onClick={saveTimesheet}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              {isSaving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-lg"
              disabled={isSaving}
            >
              <Printer size={18} className="inline mr-2" />
              Podgląd Wydruku
            </button>
          </div>
        </div>
      </div>

      {/* Formularz */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Dane pracownika */}
        <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            Dane Pracownika
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Imię i Nazwisko
              </label>
              <input
                type="text"
                value={currentSheet.employeeName}
                onChange={(e) => setCurrentSheet({ ...currentSheet, employeeName: e.target.value })}
                className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-white/95 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Jan Kowalski"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Adres
              </label>
              <input
                type="text"
                value={currentSheet.employeeAddress}
                onChange={(e) => setCurrentSheet({ ...currentSheet, employeeAddress: e.target.value })}
                className="w-full px-4 py-2 border border-sky-200 rounded-lg bg-white text-black focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="ul. Przykładowa 123, Warszawa"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Telefon
              </label>
              <input
                type="tel"
                value={currentSheet.employeePhone}
                onChange={(e) => setCurrentSheet({ ...currentSheet, employeePhone: e.target.value })}
                className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-white/95 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+48 123 456 789"
              />
            </div>
          </div>
        </div>

        {/* Dane projektu */}
        <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-blue-600" />
            Dane Projektu / Budowy
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Nazwa Projektu
              </label>
              <input
                type="text"
                value={currentSheet.projectName}
                onChange={(e) => setCurrentSheet({ ...currentSheet, projectName: e.target.value })}
                className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-white/95 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Budowa domu jednorodzinnego"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Adres Budowy
              </label>
              <input
                type="text"
                value={currentSheet.projectAddress}
                onChange={(e) => setCurrentSheet({ ...currentSheet, projectAddress: e.target.value })}
                className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-white/95 text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ul. Budowlana 456, Kraków"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Klient
              </label>
              <input
                type="text"
                value={currentSheet.projectClient}
                onChange={(e) => setCurrentSheet({ ...currentSheet, projectClient: e.target.value })}
                className="w-full px-4 py-2 border border-sky-200 rounded-lg bg-white text-black focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="ABC Sp. z o.o."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Stawka Godzinowa (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentSheet.hourlyRate}
                onChange={(e) => {
                  const newRate = parseFloat(e.target.value) || 0;
                  const totalAmount = currentSheet.totalHours * newRate;
                  setCurrentSheet({ 
                    ...currentSheet, 
                    hourlyRate: newRate,
                    totalAmount
                  });
                }}
                className="w-full px-4 py-2 border border-sky-200 rounded-lg bg-white text-black focus:ring-2 focus:ring-sky-500 focus:border-transparent font-mono"
                placeholder="20.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela godzin */}
      <div className="bg-white/95 backdrop-blur-md border border-blue-200 rounded-xl p-6 overflow-x-auto">
        <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-blue-600" />
          Godziny Pracy - Tydzień
        </h3>
        
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-sky-200">
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Dzień</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Data</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Start</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Koniec</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Przerwa (min)</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Godziny</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Kwota (€)</th>
              <th className="text-left py-3 px-2 text-sm font-bold text-black">Uwagi</th>
            </tr>
          </thead>
          <tbody>
            {currentSheet.days.map((day, index) => (
              <tr 
                key={day.date}
                className="border-b border-blue-100 hover:bg-blue-50"
              >
                <td className="py-3 px-2 font-medium text-black">
                  {day.dayName}
                </td>
                <td className="py-3 px-2 text-sm text-black">
                  {formatDatePL(day.date)}
                </td>
                <td className="py-3 px-2">
                  <input
                    type="time"
                    value={day.startTime}
                    onChange={(e) => updateDay(index, 'startTime', e.target.value)}
                    className="w-24 px-2 py-1 border border-sky-200 rounded bg-white text-black text-sm font-mono"
                    aria-label="Godzina rozpoczęcia"
                    title="Godzina rozpoczęcia"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="time"
                    value={day.endTime}
                    onChange={(e) => updateDay(index, 'endTime', e.target.value)}
                    className="w-24 px-2 py-1 border border-sky-200 rounded bg-white text-black text-sm font-mono"
                    aria-label="Godzina zakończenia"
                    title="Godzina zakończenia"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="number"
                    value={day.breakMinutes}
                    onChange={(e) => updateDay(index, 'breakMinutes', parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-sky-200 rounded bg-white text-black text-sm font-mono"
                    aria-label="Przerwa w minutach"
                    title="Przerwa w minutach"
                  />
                </td>
                <td className="py-3 px-2 font-bold text-sky-600 font-mono">
                  {day.workedHours.toFixed(2)}h
                </td>
                <td className="py-3 px-2 font-bold text-black font-mono">
                  €{(day.workedHours * currentSheet.hourlyRate).toFixed(2)}
                </td>
                <td className="py-3 px-2">
                  <input
                    type="text"
                    value={day.notes}
                    onChange={(e) => updateDay(index, 'notes', e.target.value)}
                    className="w-full px-2 py-1 border border-blue-200 rounded bg-white/95 text-black text-sm"
                    placeholder="Uwagi..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-blue-300 bg-blue-50">
              <td colSpan={5} className="py-4 px-2 text-right font-bold text-black">
                RAZEM:
              </td>
              <td className="py-4 px-2 font-bold text-sky-600 text-lg font-mono">
                {currentSheet.totalHours.toFixed(2)}h
              </td>
              <td className="py-4 px-2 font-bold text-black text-lg font-mono">
                €{currentSheet.totalAmount.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modal podglądu wydruku */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-blue-200 flex items-center justify-between sticky top-0 bg-white/95 z-10">
              <h3 className="text-xl font-bold text-black">Podgląd Wydruku - MESSU BOUW</h3>
              <div className="flex gap-3 items-center flex-wrap">
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow-lg"
                  title="Pobierz jako PDF (rekomendowane dla telefonu)"
                >
                  <FilePdf size={18} className="inline mr-2" />
                  Pobierz PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all"
                  title="Wydrukuj (działa lepiej na komputerze)"
                >
                  <Printer size={18} className="inline mr-2" />
                  Drukuj
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-slate-200 text-black rounded-lg hover:bg-slate-300 transition-all"
                >
                  Zamknij
                </button>
              </div>
            </div>
            
            {/* Wersja do wydruku */}
            <div ref={printRef} className="p-8 bg-white">
              <PrintableTimesheet timesheet={currentSheet} t={t} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// KOMPONENT DRUKOWALNY
// ============================================

function PrintableTimesheet({ timesheet, t }: { timesheet: Timesheet; t: any }) {
  return (
    <div className="max-w-4xl mx-auto font-sans">
      {/* Header z logo */}
      <div className="flex items-start justify-between mb-8 border-b-2 border-sky-500 pb-6">
        <div>
          <img 
            src="/messu-bouw-logo.jpg" 
            alt="MESSU BOUW" 
            className="h-16 w-auto mb-2"
          />
          <h1 className="text-3xl font-bold text-slate-900">{t('timesheets.timecard')}</h1>
          <p className="text-slate-600 mt-1">
            Tydzień: {formatDatePL(timesheet.weekStartDate)} - {formatDatePL(timesheet.weekEndDate)}
          </p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p>Data wydruku: {new Date().toLocaleDateString('pl-PL')}</p>
          <p className="font-mono">#{timesheet.id}</p>
        </div>
      </div>

      {/* Dane pracownika i projektu */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('timesheets.employee')}</h2>
          <div className="space-y-2 text-slate-900">
            <p className="font-bold text-lg">{timesheet.employeeName}</p>
            <p className="text-sm">{timesheet.employeeAddress}</p>
            <p className="text-sm">{timesheet.employeePhone}</p>
          </div>
        </div>
        
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Projekt / Budowa</h2>
          <div className="space-y-2 text-slate-900">
            <p className="font-bold text-lg">{timesheet.projectName}</p>
            <p className="text-sm">{timesheet.projectAddress}</p>
            <p className="text-sm">Klient: {timesheet.projectClient}</p>
          </div>
        </div>
      </div>

      {/* Tabela godzin */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-sky-100 border-b-2 border-sky-500">
            <th className="text-left py-3 px-3 text-xs font-bold text-slate-700 uppercase">Dzień</th>
            <th className="text-left py-3 px-3 text-xs font-bold text-slate-700 uppercase">{t('timesheets.dateLabel')}</th>
            <th className="text-center py-3 px-3 text-xs font-bold text-slate-700 uppercase">{t('timesheets.startTime')}</th>
            <th className="text-center py-3 px-3 text-xs font-bold text-slate-700 uppercase">{t('timesheets.endTime')}</th>
            <th className="text-center py-3 px-3 text-xs font-bold text-slate-700 uppercase">{t('timesheets.break')}</th>
            <th className="text-right py-3 px-3 text-xs font-bold text-slate-700 uppercase">{t('timesheets.hoursWorked')}</th>
            <th className="text-right py-3 px-3 text-xs font-bold text-slate-700 uppercase">Kwota (€)</th>
            <th className="text-left py-3 px-3 text-xs font-bold text-slate-700 uppercase">{t('timesheets.notes')}</th>
          </tr>
        </thead>
        <tbody>
          {timesheet.days.map((day) => (
            <tr key={day.date} className="border-b border-slate-200">
              <td className="py-3 px-3 font-medium text-slate-900">{day.dayName}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{formatDatePL(day.date)}</td>
              <td className="py-3 px-3 text-center font-mono text-sm">{day.startTime}</td>
              <td className="py-3 px-3 text-center font-mono text-sm">{day.endTime}</td>
              <td className="py-3 px-3 text-center font-mono text-sm">{day.breakMinutes} min</td>
              <td className="py-3 px-3 text-right font-bold font-mono">{day.workedHours.toFixed(2)}h</td>
              <td className="py-3 px-3 text-right font-bold font-mono">€{(day.workedHours * timesheet.hourlyRate).toFixed(2)}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{day.notes}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-sky-50 border-t-2 border-sky-500">
            <td colSpan={5} className="py-4 px-3 text-right font-bold text-slate-900 uppercase">
              Razem:
            </td>
            <td className="py-4 px-3 text-right font-bold text-sky-600 text-lg font-mono">
              {timesheet.totalHours.toFixed(2)}h
            </td>
            <td className="py-4 px-3 text-right font-bold text-slate-900 text-lg font-mono">
              €{timesheet.totalAmount.toFixed(2)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Podsumowanie */}
      <div className="bg-sky-50 rounded-lg p-6 mb-8">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-sm text-slate-600 uppercase mb-1">Całkowity czas pracy</p>
            <p className="text-3xl font-bold text-sky-600 font-mono">{timesheet.totalHours.toFixed(2)}h</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 uppercase mb-1">{t('timesheets.hourlyRate')}</p>
            <p className="text-3xl font-bold text-slate-900 font-mono">€{timesheet.hourlyRate.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 uppercase mb-1">Kwota do wypłaty</p>
            <p className="text-3xl font-bold text-slate-900 font-mono">€{timesheet.totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Podpisy */}
      <div className="grid grid-cols-2 gap-16 mt-16 pt-8 border-t border-slate-300">
        <div>
          <p className="text-sm text-slate-600 mb-8">Podpis pracownika:</p>
          <div className="border-b-2 border-slate-400 h-12"></div>
          <p className="text-xs text-slate-500 mt-2">{timesheet.employeeName}</p>
        </div>
        <div>
          <p className="text-sm text-slate-600 mb-8">Podpis pracodawcy / kierownika:</p>
          <div className="border-b-2 border-slate-400 h-12"></div>
          <p className="text-xs text-slate-500 mt-2">MESSU BOUW</p>
        </div>
      </div>

      {/* Stopka */}
      <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
        <p>Dokument wygenerowany automatycznie przez system MESSU BOUW Invoice Management</p>
        <p className="mt-1">Data wygenerowania: {new Date().toLocaleDateString('pl-PL')} {new Date().toLocaleTimeString('pl-PL')}</p>
      </div>
    </div>
  );
}
