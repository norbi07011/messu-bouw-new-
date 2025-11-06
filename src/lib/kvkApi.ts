/**
 * KVK API Integration - REAL API VERSION
 * 
 * Używa DARMOWEGO Zoeken API do wyszukiwania firm (€0 za zapytanie)
 * API Key potrzebny: Zarejestruj się na https://developers.kvk.nl/
 * 
 * Wersja testowa: Używa testowego API z przykładowymi danymi
 * Produkcja: Zmień API_BASE_URL i użyj prawdziwego klucza
 */

export interface KVKSearchResult {
  kvkNumber: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  vatNumber?: string;
}

// KONFIGURACJA API
const USE_TEST_API = true; // Zmień na false gdy masz prawdziwy klucz
const API_KEY = 'l7xx1f2691f2520d487b902f4e0b57a0b197'; // Test API key - ZMIEŃ NA SWÓJ!
const TEST_API_URL = 'https://api.kvk.nl/test/api/v2';
const PROD_API_URL = 'https://api.kvk.nl/api/v1';
const API_BASE_URL = USE_TEST_API ? TEST_API_URL : PROD_API_URL;

// Cache (oszczędność zapytań API)
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 dni

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

function getCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(`kvk_cache_${key}`);
    if (!item) return null;
    
    const cached: CacheItem<T> = JSON.parse(item);
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      localStorage.removeItem(`kvk_cache_${key}`);
      return null;
    }
    
    return cached.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(`kvk_cache_${key}`, JSON.stringify(item));
  } catch (error) {
    console.warn('Failed to cache KVK data:', error);
  }
}

/**
 * Wyszukiwanie firmy po numerze KVK
 * Używa DARMOWEGO Zoeken API
 */
export async function searchByKvkNumber(kvkNumber: string): Promise<KVKSearchResult | null> {
  console.log('🔍 Szukam w KVK API po numerze:', kvkNumber);
  
  // Walidacja numeru KVK (8 cyfr)
  const cleanKvk = kvkNumber.replace(/\s/g, '');
  if (!/^\d{8}$/.test(cleanKvk)) {
    throw new Error('Numer KVK musi składać się z 8 cyfr');
  }
  
  // Sprawdź cache
  const cached = getCache<KVKSearchResult>(`kvk_${cleanKvk}`);
  if (cached) {
    console.log('✅ Dane z cache:', cached);
    return cached;
  }
  
  try {
    // DARMOWE API - Zoeken (€0 za zapytanie)
    const response = await fetch(
      `${API_BASE_URL}/zoeken?kvkNummer=${cleanKvk}`,
      {
        headers: {
          'apikey': API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('📡 KVK API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ KVK API error:', errorText);
      
      if (response.status === 404) {
        throw new Error('Firma o podanym numerze KVK nie została znaleziona');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('Błąd autoryzacji - sprawdź klucz API na https://developers.kvk.nl/');
      }
      throw new Error(`KVK API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ KVK API data:', data);
    
    // Sprawdź czy są wyniki
    if (!data.resultaten || data.resultaten.length === 0) {
      throw new Error('Firma o podanym numerze KVK nie została znaleziona');
    }
    
    const company = data.resultaten[0];
    const address = company.adres || {};
    
    const result: KVKSearchResult = {
      kvkNumber: company.kvkNummer || cleanKvk,
      name: company.handelsnaam || company.naam || '',
      address: `${address.straatnaam || ''} ${address.huisnummer || ''}${address.huisnummerToevoeging || ''}`.trim(),
      city: address.plaats || '',
      postalCode: address.postcode || '',
      vatNumber: generateVATFromKVK(cleanKvk)
    };
    
    console.log('📦 Sformatowany wynik:', result);
    
    // Zapisz do cache
    setCache(`kvk_${cleanKvk}`, result);
    
    return result;
  } catch (error) {
    console.error('💥 KVK API error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Nieoczekiwany błąd podczas wyszukiwania w KVK');
  }
}

/**
 * Wyszukiwanie firm po nazwie
 * Używa DARMOWEGO Zoeken API (€0 za zapytanie)
 */
export async function searchByName(name: string): Promise<KVKSearchResult[]> {
  console.log('🔍 Szukam w KVK API po nazwie:', name);
  
  if (name.length < 2) {
    throw new Error('Nazwa musi mieć co najmniej 2 znaki');
  }
  
  // Sprawdź cache
  const cacheKey = `name_${name.toLowerCase().replace(/\s/g, '_')}`;
  const cached = getCache<KVKSearchResult[]>(cacheKey);
  if (cached) {
    console.log('✅ Dane z cache:', cached);
    return cached;
  }
  
  try {
    // DARMOWE API - Zoeken (€0 za zapytanie)
    const response = await fetch(
      `${API_BASE_URL}/zoeken?handelsnaam=${encodeURIComponent(name)}&pagina=1&aantal=10`,
      {
        headers: {
          'apikey': API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('📡 KVK API search response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ KVK API search error:', errorText);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Błąd autoryzacji - sprawdź klucz API na https://developers.kvk.nl/');
      }
      throw new Error(`KVK API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ KVK API search data:', data);
    
    if (!data.resultaten || data.resultaten.length === 0) {
      console.log('⚠️ Brak wyników dla:', name);
      return [];
    }
    
    console.log(`📦 Znaleziono ${data.resultaten.length} wyników`);
    
    const results: KVKSearchResult[] = data.resultaten.map((company: any) => {
      const address = company.adres || {};
      
      return {
        kvkNumber: company.kvkNummer || '',
        name: company.handelsnaam || company.naam || '',
        address: `${address.straatnaam || ''} ${address.huisnummer || ''}${address.huisnummerToevoeging || ''}`.trim(),
        city: address.plaats || '',
        postalCode: address.postcode || '',
        vatNumber: company.kvkNummer ? generateVATFromKVK(company.kvkNummer) : undefined
      };
    });
    
    // Zapisz do cache
    setCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('💥 KVK search error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Nieoczekiwany błąd podczas wyszukiwania w KVK');
  }
}

/**
 * Generuj numer VAT z numeru KVK (dla firm holenderskich)
 * Format: NL + KVK (8 cyfr) + B01
 */
export function generateVATFromKVK(kvkNumber: string): string {
  const cleanKvk = kvkNumber.replace(/\s/g, '');
  if (!/^\d{8}$/.test(cleanKvk)) {
    return '';
  }
  
  // Holenderski format VAT: NL + KVK + B01
  return `NL${cleanKvk}B01`;
}
