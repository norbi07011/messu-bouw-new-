import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main-simple.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)

// Rejestracja Service Worker dla PWA (offline support + instalacja)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker zarejestrowany:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ Błąd rejestracji Service Worker:', error);
      });
  });
}

// Obsługa instalacji PWA (prompt "Dodaj do ekranu głównego")
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('💡 PWA może być zainstalowane');
  
  // Opcjonalnie: pokaż własny przycisk instalacji
  // Można dodać UI element do pokazania użytkownikowi
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA zostało zainstalowane');
  deferredPrompt = null;
});

