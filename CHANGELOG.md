# Changelog - MESSU BOUW

Wszystkie ważne zmiany w projekcie są dokumentowane w tym pliku.

## [2.0.0] - 2025-11-12

### 🎉 Nowe Funkcje

#### PWA (Progressive Web App)
- ✅ Instalacja aplikacji jak natywna (Android, iOS, Windows, macOS)
- ✅ Offline support - działa bez internetu
- ✅ Service Worker z cache-first strategy
- ✅ Install prompt banner z możliwością odrzucenia
- ✅ Manifest.json z ikonami i konfiguracją

#### Mobile Responsiveness
- ✅ Hamburger menu na urządzeniach mobilnych
- ✅ Sidebar overlay z animacjami slide
- ✅ Responsive grids (grid-cols-1 md:grid-cols-2)
- ✅ Touch-friendly buttons (min 44x44px)
- ✅ Responsive padding (p-3 lg:p-6)

#### Email & WhatsApp Integration
- ✅ Wysyłka faktur przez email (Gmail/mailto)
- ✅ WhatsApp sharing z wa.me links
- ✅ Pre-filled subject i body w emailach
- ✅ Automatyczna generacja PDF przed wysłaniem

#### App Settings & Preferences
- ✅ Wybór języka (Polski, Nederlands, English)
- ✅ Format daty (DD-MM-YYYY / MM/DD/YYYY / YYYY-MM-DD)
- ✅ Separator dziesiętny (przecinek / kropka)
- ✅ Strefa czasowa (Amsterdam, Warsaw, London, New York)
- ✅ Domyślna waluta (EUR, PLN, USD, GBP)
- ✅ Wszystkie ustawienia w localStorage

#### Backup & Restore
- ✅ Export wszystkich danych do JSON
- ✅ Timestamp w nazwie pliku (messu-bouw-backup-YYYY-MM-DD-HHmmss.json)
- ✅ Import z wyborem merge/replace
- ✅ Backup zawiera: invoices, clients, products, companies, timesheets, appointments, expenses, kilometers, settings
- ✅ Walidacja struktury pliku przed importem

#### CSV Import
- ✅ Import wizard z krokami (Upload → Map → Preview → Import)
- ✅ Mapowanie kolumn CSV do pól systemu
- ✅ Podgląd pierwszych 5 rekordów przed importem
- ✅ Walidacja danych i raport błędów
- ✅ Detekcja duplikatów po ID
- ✅ Support dla klientów i produktów

#### Timesheet Improvements
- ✅ Persistence z useTimesheets hook
- ✅ Mobile PDF export przez Web Share API
- ✅ Fallback do download gdy share niedostępny
- ✅ Loading states podczas zapisywania
- ✅ Toast notifications dla success/error

### 🔧 Aktualizacje Techniczne

#### Zaktualizowane Pakiety
- **React**: 19.0.0 → 19.2.0
- **React DOM**: 19.0.0 → 19.2.0
- **Vite**: 6.3.5 → 6.4.1
- **Electron**: 38.4.0 → 39.1.2
- **TypeScript**: 5.7.2 → 5.9.3
- **Tailwind CSS**: 4.1.11 → 4.1.17
- **@tanstack/react-query**: 5.83.1 → 5.90.8
- **i18next**: 25.6.0 → 25.6.2
- **react-i18next**: 16.2.0 → 16.3.1
- **date-fns**: 3.6.0 → 4.1.0
- **lucide-react**: 0.484.0 → 0.553.0

#### Bezpieczeństwo
- ✅ **Zero vulnerabilities** w npm audit
- ✅ Wszystkie pakiety zaktualizowane do najnowszych stabilnych wersji
- ✅ Build działa bez błędów

### 📦 Zmiany w Architekturze

#### Nowe Komponenty
- `InstallPWA.tsx` - Banner instalacji PWA
- `CSVImport.tsx` - Wizard importu CSV
- `public/sw.js` - Service Worker dla offline support

#### Zmiany w Istniejących Komponentach
- **App.tsx**: Dodano mobile menu, hamburger button, sidebar overlay
- **Settings.tsx**: Nowe zakładki: Preferences, Backup, CSV Import
- **Timesheets.tsx**: Refaktor PDF export, useTimesheets integration
- **Clients.tsx**: Responsive grids (md:grid-cols-2)
- **tailwind.config.js**: Dodano min-h-touch i min-w-touch utilities

#### Hooks
- **useTimesheets**: CRUD operations dla timesheets z localStorage

### 🎨 UI/UX Improvements
- Gradient backgrounds (bg-linear-to-br)
- Dark mode support zachowany
- Touch-friendly interactive elements
- Better mobile navigation
- Smooth animations dla sidebar
- Toast notifications dla wszystkich akcji

### 📱 Mobile-First Features
- Web Share API dla PDF sharing
- navigator.share() support
- Responsive breakpoints (sm/md/lg/xl)
- Mobile menu overlay z backdrop
- Auto-close menu on navigation

### 🌍 i18n Support
- Flagi emoji dla języków (🇵🇱 🇳🇱 🇬🇧)
- Dynamiczne formatowanie dat
- Locale-aware currency display
- Multi-language support w całej aplikacji

### 🔄 Data Management
- localStorage jako primary storage
- Capacitor.Preferences jako mobile fallback
- JSON backup/restore system
- CSV import/export capability
- Data validation i error handling

## [1.0.0] - 2025-10-01

### Wersja Początkowa
- Podstawowa funkcjonalność fakturowania
- Zarządzanie klientami
- Zarządzanie produktami
- Generowanie PDF
- Dark mode
- Multi-company support
- Templates system

---

## Notatki Developerskie

### Breaking Changes
- Brak breaking changes między 1.0.0 a 2.0.0
- Wszystkie aktualizacje są backward compatible
- Dane z localStorage zachowane

### Migration Guide
1. Pobierz backup przed aktualizacją (Settings → Backup)
2. Uruchom `npm install` dla nowych pakietów
3. Uruchom `npm run dev` lub `npm run build`
4. Zweryfikuj funkcjonalność w Settings → Preferences

### Known Issues
- Inline styles w template preview (nie wpływa na funkcjonalność)
- Large bundle size (2.4MB) - do optymalizacji w przyszłości

### Roadmap dla 2.1.0
- [ ] Multi-currency support
- [ ] Audit log system
- [ ] Product templates/catalog
- [ ] Code splitting dla mniejszego bundle
- [ ] PWA update notifications

---

**Pełna dokumentacja**: Zobacz README.md  
**Zgłaszanie błędów**: GitHub Issues  
**Wsparcie**: info@messubouw.nl
