# 🔑 Jak uzyskać KVK API Key

## 💰 Cennik KVK API

### Koszty miesięczne:
- **Abonament**: €6.20/miesiąc (~27 PLN)
- **Zoeken API** (wyszukiwanie): **€0.00** - DARMOWE! ✅
- **Inne API** (szczegóły firmy): €0.02 za zapytanie (~9 groszy)

### Przykładowe koszty użycia:

**50 wyszukiwań/miesiąc:**
- Abonament: €6.20
- Wyszukiwania: €0 (darmowe)
- **RAZEM: €6.20/miesiąc (~27 PLN)**

**200 wyszukiwań/miesiąc:**
- Abonament: €6.20
- Wyszukiwania: €0 (darmowe)
- **RAZEM: €6.20/miesiąc (~27 PLN)**

---

## 📝 Jak zarejestrować się w KVK API

### Krok 1: Przejdź na stronę KVK Developers
🔗 **https://developers.kvk.nl/**

### Krok 2: Kliknij "Apply for APIs"
🔗 **https://developers.kvk.nl/apply-for-apis**

### Krok 3: Wypełnij formularz
Będziesz potrzebować:
- ✅ **Numer KVK** twojej firmy (wymagane!)
- ✅ Email kontaktowy
- ✅ Opis zastosowania API
- ✅ Szacowana liczba zapytań miesięcznie

**UWAGA:** Bez numeru KVK nie możesz się zarejestrować (wyjątek: zagraniczne rządy z EEA).

### Krok 4: Podpisz umowę
- Otrzymasz umowę do podpisania
- Tylko **upoważniona osoba** może podpisać umowę
- Po zatwierdzeniu otrzymasz **API Key**

### Krok 5: Otrzymasz API Key
Przykład klucza: `l7xx1f2691f2520d487b902f4e0b57a0b197`

---

## 🔧 Jak użyć własnego klucza API

### Opcja 1: Edytuj plik `src/lib/kvkApi.ts`

```typescript
// KONFIGURACJA API
const USE_TEST_API = false; // Zmień na false!
const API_KEY = 'TWÓJ_KLUCZ_API_TUTAJ'; // Wklej swój klucz!
```

### Opcja 2: Użyj zmiennych środowiskowych (bezpieczniejsze)

1. Stwórz plik `.env.local` w głównym folderze projektu:

```bash
VITE_KVK_API_KEY=TWÓJ_KLUCZ_API_TUTAJ
VITE_KVK_USE_PRODUCTION=true
```

2. Zmodyfikuj `src/lib/kvkApi.ts`:

```typescript
const USE_TEST_API = import.meta.env.VITE_KVK_USE_PRODUCTION !== 'true';
const API_KEY = import.meta.env.VITE_KVK_API_KEY || 'l7xx1f2691f2520d487b902f4e0b57a0b197';
```

3. Dodaj `.env.local` do `.gitignore` (już dodane):

```
.env.local
```

---

## 🧪 Testowanie przed rejestracją

### Wersja testowa (aktualna):
- ✅ Działa bez rejestracji
- ✅ Używa fikcyjnych danych
- ✅ Limit: brak (fikcyjne dane)
- ⚠️ Dane NIE są prawdziwe!

### Test prawdziwego API:
1. Idź do: https://developers.kvk.nl/documentation/testing
2. Możesz testować API bez rejestracji
3. Przykładowe numery KVK dla testów (fikcyjne):
   - `90004760` - testowa firma
   - `68750110` - testowa firma

---

## 📊 Cache - oszczędność kosztów

Aplikacja automatycznie **cache'uje wyniki** na 7 dni w localStorage:

✅ **Korzyści:**
- Brak wielokrotnych zapytań do API dla tej samej firmy
- Oszczędność kosztów
- Szybsze wyniki dla użytkownika

```typescript
// Cache automatyczny - nie musisz nic robić!
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 dni
```

Jeśli chcesz wyczyścić cache:
1. Otwórz DevTools (F12)
2. Application → Local Storage
3. Usuń klucze zaczynające się od `kvk_cache_`

---

## 🔒 Bezpieczeństwo

### ⚠️ WAŻNE - NIE commituj klucza API do Git!

**Źle:** ❌
```typescript
const API_KEY = 'moj_prawdziwy_klucz_12345'; // W pliku commitowanym do Git
```

**Dobrze:** ✅
```typescript
const API_KEY = import.meta.env.VITE_KVK_API_KEY; // Ze zmiennych środowiskowych
```

### Plik `.gitignore` już zawiera:
```
.env.local
.env.production.local
```

---

## 📞 Wsparcie KVK

- 📧 Email: api@kvk.nl
- 🌐 FAQ: https://developers.kvk.nl/faq
- 📚 Dokumentacja: https://developers.kvk.nl/documentation

---

## ✅ Checklist przed uruchomieniem produkcyjnym

- [ ] Zarejestruj się na https://developers.kvk.nl/
- [ ] Otrzymaj API Key
- [ ] Dodaj klucz do `.env.local`
- [ ] Zmień `USE_TEST_API = false`
- [ ] Sprawdź `.gitignore` (czy zawiera `.env.local`)
- [ ] Przetestuj wyszukiwanie prawdziwych firm
- [ ] Monitoruj koszty w panelu KVK

---

## 🎯 Podsumowanie

1. **Wersja testowa** (aktualna):
   - Działa od razu
   - Fikcyjne dane
   - Za darmo
   
2. **Wersja produkcyjna** (gdy masz klucz):
   - €6.20/miesiąc
   - Prawdziwe dane
   - DARMOWE wyszukiwanie (€0)
   - Cache oszczędza koszty

**To bardzo opłacalne API!** 🎉
