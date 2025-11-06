# 📱 APK Releases - MESSU BOUW Invoice Management

Pliki APK są zbyt duże dla GitHub (>100MB), dlatego zostały wykluczone z repozytorium.

## 📥 Dostępne Wersje APK

### 1. **messu-bouw-godziny-fix.apk** ⭐ NAJNOWSZA
- **Rozmiar:** 280.88 MB
- **Data:** 6 listopada 2025
- **Wersja:** 1.0.1 FIX
- **Zawiera:**
  - ✅ FIX: Podgląd wydruku działa na telefonie
  - ✅ NOWA FUNKCJA: Pobierz PDF (html2canvas)
  - ✅ Wszystkie poprzednie funkcje + KVK API
  - ✅ Ulepszona funkcja drukowania dla mobile

**Instrukcje:** Zobacz `FIX-GODZINY-PRACY-MOBILE.md`

---

### 2. **messu-bouw-kvk.apk**
- **Rozmiar:** 142.67 MB
- **Data:** 6 listopada 2025
- **Wersja:** 1.0.0 KVK
- **Zawiera:**
  - ✅ Integracja KVK API (wyszukiwanie firm)
  - ✅ Automatyczne wypełnianie danych klienta
  - ✅ Cache 7-dni dla KVK
  - ✅ Wszystkie podstawowe funkcje

**Instrukcje:** Zobacz `KVK-API-INSTRUKCJA.md`

---

### 3. **messu-bouw-premium-14.apk** (starsza wersja)
- **Rozmiar:** 9.04 MB
- **Data:** 5 listopada 2025
- **Podstawowa wersja bez KVK**

---

## 🔧 Jak Pobrać APK?

### Opcja 1: Lokalny Build (Rekomendowane)

Zbuduj APK lokalnie z kodu źródłowego:

```bash
# 1. Zainstaluj zależności
npm install

# 2. Zbuduj aplikację
npm run build

# 3. Synchronizuj z Capacitor
npx cap sync android

# 4. Zbuduj APK
cd android
.\gradlew assembleDebug

# 5. APK znajdziesz w:
# android\app\build\outputs\apk\debug\app-debug.apk
```

### Opcja 2: Strony Pobierania (localhost)

Po uruchomieniu `npm run dev`:

- **Godziny Fix:** http://localhost:5000/pobierz-godziny-fix.html
- **KVK:** http://localhost:5000/pobierz-apk-kvk.html

### Opcja 3: Releases (GitHub - jeśli dodane)

Jeśli APK-i zostały dodane jako GitHub Releases:
- Przejdź do: https://github.com/messubouwbedrijf-coder/Bedrijf/releases
- Pobierz najnowszą wersję

---

## 📦 Kompresja APK (opcjonalnie)

Jeśli chcesz skompresować APK:

```bash
# Windows PowerShell
Compress-Archive -Path "public\messu-bouw-godziny-fix.apk" -DestinationPath "apk-releases.zip"
```

---

## 🚀 Instalacja na Telefonie

1. Pobierz plik APK na urządzenie Android
2. Otwórz plik APK
3. Zezwól na instalację z nieznanych źródeł (jeśli wymagane)
4. Zainstaluj aplikację
5. Gotowe!

---

## 📝 Changelog

### v1.0.1 FIX (6 listopada 2025)
- 🔧 Naprawiono podgląd wydruku na telefonie
- ✨ Dodano przycisk "Pobierz PDF"
- ✨ Integracja html2canvas + jsPDF
- 🔧 Ulepszona funkcja window.print()

### v1.0.0 KVK (6 listopada 2025)
- ✨ Dodano integrację KVK API
- ✨ Wyszukiwanie firm po numerze KVK
- ✨ Wyszukiwanie firm po nazwie
- ✨ Automatyczne wypełnianie formularzy
- ✨ Cache 7-dniowy dla KVK

---

## 🔗 Dokumentacja

- **Fix Godzin Pracy:** [FIX-GODZINY-PRACY-MOBILE.md](FIX-GODZINY-PRACY-MOBILE.md)
- **KVK API:** [KVK-API-INSTRUKCJA.md](KVK-API-INSTRUKCJA.md)
- **Główna dokumentacja:** [README.md](README.md)

---

**Uwaga:** Pliki APK są wykluczone z repozytorium Git ze względu na rozmiar (GitHub limit: 100MB). 
Zawsze buduj najnowszą wersję lokalnie lub pobieraj z GitHub Releases.
