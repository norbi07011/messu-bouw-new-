# 📦 Instrukcja uruchomienia aplikacji MESSU BOUW

## ⚡ NAJSZYBSZA INSTALACJA (automatyczna)

### Windows PowerShell:
```powershell
git clone https://github.com/norbi07011/messu-bouw-new-.git
cd messu-bouw-new-
.\setup.ps1
```

### Windows CMD:
```cmd
git clone https://github.com/norbi07011/messu-bouw-new-.git
cd messu-bouw-new-
setup.bat
```

✅ Skrypt automatycznie zainstaluje wszystko i uruchomi aplikację!

---

## 🚀 Instalacja manualna (krok po kroku)

### 1. Pobierz kod z GitHub
```powershell
git clone https://github.com/norbi07011/messu-bouw-new-.git
cd messu-bouw-new-
```

### 2. Zainstaluj zależności
```powershell
npm install
```

### 3. Uruchom aplikację desktop
```powershell
npm run electron:dev
```

✅ Aplikacja otworzy się w nowym oknie!

---

## 💾 Budowanie instalatora .exe

Jeśli chcesz mieć plik .exe do zainstalowania na innych komputerach:

### 1. Zbuduj aplikację
```powershell
npm run build
```

### 2. Utwórz instalator
```powershell
npm run electron:build
```

### 3. Znajdź instalator
Plik `.exe` będzie w folderze:
- `dist/` lub
- `release/` lub
- `out/`

---

## 📱 Budowanie aplikacji na Android (APK)

### 1. Zbuduj wersję web
```powershell
npm run build
```

### 2. Zsynchronizuj z Capacitor
```powershell
npx cap sync android
```

### 3. Otwórz w Android Studio
```powershell
npx cap open android
```

### 4. W Android Studio:
- Kliknij **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
- Plik APK znajdziesz w `android/app/build/outputs/apk/debug/`

---

## 🌐 Uruchomienie wersji web (localhost)

```powershell
npm run dev
```

Aplikacja otworzy się w przeglądarce na `http://localhost:5173`

---

## 🔧 Wymagania systemowe

- **Node.js** v18 lub nowszy
- **npm** v9 lub nowszy
- **Git**
- **Android Studio** (tylko dla budowania APK)
- **Java JDK 17+** (tylko dla budowania APK)

---

## 📝 Dostępne komendy

| Komenda | Opis |
|---------|------|
| `npm run dev` | Uruchom wersję web w przeglądarce |
| `npm run build` | Zbuduj wersję produkcyjną |
| `npm run electron:dev` | Uruchom aplikację desktop (Electron) |
| `npm run electron:build` | Zbuduj instalator .exe |
| `npx cap sync android` | Synchronizuj z Androidem |
| `npx cap open android` | Otwórz projekt w Android Studio |

---

## 🆘 Rozwiązywanie problemów

### Błąd: "npm command not found"
Zainstaluj Node.js z https://nodejs.org/

### Błąd przy `npm install`
```powershell
npm cache clean --force
npm install
```

### Aplikacja nie uruchamia się
```powershell
rm -rf node_modules
rm package-lock.json
npm install
```

### Brak Electron
```powershell
npm install electron --save-dev
```

---

## 📞 Kontakt
Pytania? Otwórz issue na GitHub:
https://github.com/norbi07011/messu-bouw-new-/issues
