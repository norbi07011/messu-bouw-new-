import QRCode from 'qrcode';
import { Company, Invoice, Client, InvoiceLine } from '@/types';
import { formatCurrency, formatDate, getISOWeekNumber } from '@/lib/invoice-utils';
import { getTemplateById } from '@/lib/invoice-templates';

async function imageUrlToBase64(url: string): Promise<string> {
  try {
    if (url.startsWith('data:')) {
      return url;
    }
    
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return '';
  }
}

export async function generateInvoicePDF(
  invoice: Invoice,
  company: Company,
  client: Client,
  lines: InvoiceLine[],
  language: string,
  templateId: string = 'classic'
): Promise<void> {
  try {
    const template = getTemplateById(templateId);
    
    // Wygeneruj QR kod dla SEPA płatności (EPC standard)
    console.log('Generating QR code with payload:', invoice.payment_qr_payload);
    
    const qrDataUrl = await QRCode.toDataURL(invoice.payment_qr_payload, {
      errorCorrectionLevel: 'M',  // Medium - wymagane dla SEPA
      type: 'image/png',
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('QR code generated successfully');

    let logoDataUrl = '';
    if (template.config.showLogo && company.logo_url) {
      logoDataUrl = await imageUrlToBase64(company.logo_url);
    }

    const weekNumber = getISOWeekNumber(invoice.issue_date).toString();
    const t = getTranslations(language);

    const html = generateTemplateHTML(invoice, company, client, lines, template, qrDataUrl, weekNumber, t, language, logoDataUrl);

    // Utwórz pełny dokument HTML z meta tagami dla PDF
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Faktura ${invoice.invoice_number}</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
    }
  </style>
</head>
<body>
  ${html}
  <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
    <button onclick="window.print()" style="padding: 12px 24px; background: #4F46E5; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      🖨️ Zapisz jako PDF
    </button>
    <button onclick="window.close()" style="padding: 12px 24px; background: #6B7280; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-left: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      ✖️ Zamknij
    </button>
  </div>
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Otwórz w nowym oknie
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        // Pokaż dialog zapisu PDF automatycznie po załadowaniu
        setTimeout(() => {
          printWindow.document.title = `Faktura_${invoice.invoice_number}`;
        }, 100);
      };
    } else {
      // Fallback - pobierz HTML jeśli popup zablokowany
      const link = document.createElement('a');
      link.href = url;
      link.download = `Faktura_${invoice.invoice_number}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

// Funkcja do generowania PDF na telefonie używając html2canvas + jsPDF
export async function generateMobilePDF(
  invoice: Invoice,
  company: Company,
  client: Client,
  lines: InvoiceLine[],
  language: string,
  templateId: string = 'classic'
): Promise<void> {
  try {
    // Dynamiczny import bibliotek (lazy loading)
    const [html2canvas, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    const template = getTemplateById(templateId);
    
    // Wygeneruj QR kod
    const qrDataUrl = await QRCode.toDataURL(invoice.payment_qr_payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 200,
      margin: 2,
    });

    let logoDataUrl = '';
    if (template.config.showLogo && company.logo_url) {
      logoDataUrl = await imageUrlToBase64(company.logo_url);
    }

    const weekNumber = getISOWeekNumber(invoice.issue_date).toString();
    const t = getTranslations(language);

    const html = generateTemplateHTML(invoice, company, client, lines, template, qrDataUrl, weekNumber, t, language, logoDataUrl);
    
    // Utwórz tymczasowy kontener
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // A4 width w pixelach (przy 96 DPI)
    container.style.padding = '40px';
    container.style.backgroundColor = '#ffffff';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      // Poczekaj na załadowanie obrazków
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wygeneruj canvas z HTML
      const canvas = await html2canvas.default(container, {
        scale: 2, // Wyższa jakość
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Usuń tymczasowy kontener
      document.body.removeChild(container);

      // Utwórz PDF
      const imgWidth = 210; // A4 width w mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF.default({
        orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Zapisz PDF (automatycznie pobierze na telefonie)
      pdf.save(`Faktura_${invoice.invoice_number}.pdf`);

      console.log('✅ PDF wygenerowany pomyślnie na telefonie');
    } catch (error) {
      // Cleanup w razie błędu
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Błąd generowania PDF na telefonie:', error);
    throw error;
  }
}

function generateTemplateHTML(
  invoice: Invoice,
  company: Company,
  client: Client,
  lines: InvoiceLine[],
  template: any,
  qrCodeUrl: string,
  weekNumber: string,
  t: any,
  language: string,
  logoDataUrl: string
): string {
  const primaryColor = template.config.primaryColor;
  const accentColor = template.config.accentColor;
  
  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.invoice} ${invoice.invoice_number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${getTemplateStyles(template)}
  </style>
</head>
<body>
  ${getTemplateBody(invoice, company, client, lines, template, qrCodeUrl, weekNumber, t, language, logoDataUrl)}
</body>
</html>
  `;
}

function getTemplateStyles(template: any): string {
  const primaryColor = template.config.primaryColor;
  const accentColor = template.config.accentColor;
  
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      img { max-width: 100%; height: auto; }
    }
    body {
      font-family: '${template.config.fontFamily}', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 20px;
      max-width: 210mm;
      margin: 0 auto;
    }
    .container { max-width: 100%; }
    .header { margin-bottom: 30px; }
    .logo { max-width: 80px; max-height: 80px; object-fit: contain; display: block; margin-bottom: 10px; }
    .company-name { font-size: 20pt; font-weight: 700; color: ${primaryColor}; margin-bottom: 8px; }
    .invoice-title { font-size: 24pt; font-weight: 700; color: ${accentColor}; }
    .invoice-number { font-size: 16pt; font-weight: 600; font-family: monospace; margin-top: 4px; }
    .week-number { font-size: 9pt; color: #666; margin-top: 4px; }
    .section-title { font-size: 10pt; font-weight: 600; text-transform: uppercase; color: ${primaryColor}; margin-bottom: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .party-content { line-height: 1.6; font-size: 9pt; }
    .party-content strong { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    thead { background-color: ${primaryColor}; color: white; }
    th { padding: 10px 8px; text-align: left; font-size: 8pt; font-weight: 600; text-transform: uppercase; }
    th.right, td.right { text-align: right; }
    td { padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 9pt; }
    tbody tr:nth-child(even) { background-color: #f9f9f9; }
    .totals { margin-left: auto; width: 300px; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 9pt; }
    .total-row.final { background-color: ${accentColor}; color: white; font-weight: 700; font-size: 11pt; margin-top: 4px; padding: 12px; }
    .payment-section { display: flex; gap: 30px; margin-top: 30px; padding-top: 20px; border-top: 2px solid ${primaryColor}; }
    .payment-details { flex: 1; }
    .payment-info { line-height: 1.8; font-size: 9pt; }
    .qr-section { text-align: center; }
    .qr-image { width: 140px; height: 140px; display: block; margin: 0 auto; }
    .qr-label { font-size: 8pt; font-weight: 600; margin-top: 8px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 7pt; color: #666; }
    .note { margin-top: 15px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; font-size: 9pt; }
    .mono { font-family: monospace; }
  `;
}

function getTemplateBody(
  invoice: Invoice,
  company: Company,
  client: Client,
  lines: InvoiceLine[],
  template: any,
  qrCodeUrl: string,
  weekNumber: string,
  t: any,
  language: string,
  logoDataUrl: string
): string {
  const escapeHtml = (text: string | undefined | null): string => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return `
    <div class="container">
      <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid ${template.config.primaryColor};">
        <div>
          ${template.config.showLogo && logoDataUrl ? `<img src="${logoDataUrl}" alt="Company Logo" class="logo" style="max-width: 80px; max-height: 80px; object-fit: contain; margin-bottom: 10px;">` : ''}
          <div class="company-name">${escapeHtml(company.name)}</div>
          <div style="font-size: 9pt; color: #666; line-height: 1.6;">
            ${escapeHtml(company.address)}<br>
            KVK: ${escapeHtml(company.kvk)} | BTW: ${escapeHtml(company.vat_number)}<br>
            ${escapeHtml(company.email)}
          </div>
        </div>
        <div style="text-align: right;">
          <div class="invoice-title">${t.invoice}</div>
          <div class="invoice-number">${escapeHtml(invoice.invoice_number)}</div>
          ${template.config.showWeekNumber ? `<div class="week-number">Week ${weekNumber}</div>` : ''}
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="section-title">${t.buyer}</div>
          <div class="party-content">
            <strong>${escapeHtml(client.name)}</strong><br>
            ${escapeHtml(client.address)}${client.vat_number ? `<br>BTW: ${escapeHtml(client.vat_number)}` : ''}
          </div>
        </div>
        <div>
          <div class="section-title">${t.invoiceDetails}</div>
          <div class="party-content">
            <strong>${t.issueDate}:</strong> ${formatDate(invoice.issue_date, language)}<br>
            <strong>${t.dueDate}:</strong> ${formatDate(invoice.due_date, language)}<br>
            <strong>${t.reference}:</strong> ${escapeHtml(invoice.payment_reference)}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>${t.description}</th>
            <th class="right" style="width: 70px;">${t.quantity}</th>
            <th class="right" style="width: 90px;">${t.unitPrice}</th>
            <th class="right" style="width: 60px;">${t.vatRate}</th>
            <th class="right" style="width: 100px;">${t.gross}</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((line, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(line.description)}</td>
              <td class="right mono">${line.quantity}</td>
              <td class="right mono">${formatCurrency(line.unit_price, language)}</td>
              <td class="right mono">${line.vat_rate}%</td>
              <td class="right mono"><strong>${formatCurrency(line.line_gross, language)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>${t.totalNet}:</span>
          <span class="mono">${formatCurrency(invoice.total_net, language)}</span>
        </div>
        <div class="total-row">
          <span>${t.totalVat}:</span>
          <span class="mono">${formatCurrency(invoice.total_vat, language)}</span>
        </div>
        <div class="total-row final">
          <span>${t.totalGross}:</span>
          <span class="mono">${formatCurrency(invoice.total_gross, language)}</span>
        </div>
      </div>

      ${invoice.vat_note ? `<div class="note">${escapeHtml(t.reverseChargeNote)}</div>` : ''}

      ${template.config.showBankDetails || template.config.showQRCode ? `
        <div class="payment-section">
          ${template.config.showBankDetails ? `
            <div class="payment-details">
              <div class="section-title">${t.paymentDetails}</div>
              <div class="payment-info">
                IBAN: <span class="mono">${escapeHtml(company.iban)}</span><br>
                BIC: <span class="mono">${escapeHtml(company.bic)}</span><br>
                ${t.amount}: <span class="mono"><strong>${formatCurrency(invoice.total_gross, language)}</strong></span><br>
                ${t.reference}: <span class="mono">${escapeHtml(invoice.invoice_number)}</span>
              </div>
            </div>
          ` : ''}
          ${template.config.showQRCode && qrCodeUrl ? `
            <div class="qr-section">
              <img src="${qrCodeUrl}" alt="Payment QR Code" class="qr-image" style="width: 140px; height: 140px;">
              <div class="qr-label">${t.scanToPay}</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="footer">
        ${escapeHtml(company.name)} · KVK ${escapeHtml(company.kvk)} · BTW ${escapeHtml(company.vat_number)} · IBAN ${escapeHtml(company.iban)}
      </div>
    </div>
  `;
}

function getTranslations(language: string) {
  const translations: Record<string, any> = {
    pl: {
      invoice: 'Faktura VAT',
      issueDate: 'Data wystawienia',
      dueDate: 'Termin płatności',
      invoiceNumber: 'Numer faktury',
      invoiceDetails: 'Szczegóły faktury',
      seller: 'Sprzedawca',
      buyer: 'Nabywca',
      no: 'LP',
      description: 'Opis',
      quantity: 'Ilość',
      unitPrice: 'Cena jedn.',
      vatRate: 'VAT',
      vatNumber: 'NIP',
      net: 'Netto',
      vat: 'VAT',
      gross: 'Brutto',
      total: 'Razem',
      totalNet: 'Suma netto',
      totalVat: 'Suma VAT',
      totalGross: 'Suma brutto',
      paymentDetails: 'Dane do płatności',
      scanToPay: 'Zeskanuj, aby zapłacić',
      amount: 'Kwota',
      reference: 'Tytuł przelewu',
      reverseChargeNote: 'Odwrotne obciążenie (reverse charge) – art. 194 dyrektywy VAT',
    },
    nl: {
      invoice: 'BTW-factuur',
      issueDate: 'Factuurdatum',
      dueDate: 'Vervaldatum',
      invoiceNumber: 'Factuurnummer',
      invoiceDetails: 'Factuurgegevens',
      seller: 'Verkoper',
      buyer: 'Koper',
      no: 'Nr.',
      description: 'Omschrijving',
      quantity: 'Aantal',
      unitPrice: 'Prijs',
      vatRate: 'BTW',
      vatNumber: 'BTW-nummer',
      net: 'Netto',
      vat: 'BTW',
      gross: 'Bruto',
      total: 'Totaal',
      totalNet: 'Totaal netto',
      totalVat: 'Totaal BTW',
      totalGross: 'Totaal bruto',
      paymentDetails: 'Betaalgegevens',
      scanToPay: 'Scan om te betalen',
      amount: 'Bedrag',
      reference: 'Referentie',
      reverseChargeNote: 'Verleggingsregeling – Artikel 194 BTW-richtlijn',
    },
    en: {
      invoice: 'VAT Invoice',
      issueDate: 'Issue Date',
      dueDate: 'Due Date',
      invoiceNumber: 'Invoice Number',
      invoiceDetails: 'Invoice Details',
      seller: 'Seller',
      buyer: 'Buyer',
      no: 'No.',
      description: 'Description',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      vatRate: 'VAT',
      vatNumber: 'VAT Number',
      net: 'Net',
      vat: 'VAT',
      gross: 'Gross',
      total: 'Total',
      totalNet: 'Total Net',
      totalVat: 'Total VAT',
      totalGross: 'Total Gross',
      paymentDetails: 'Payment Details',
      scanToPay: 'Scan to Pay',
      amount: 'Amount',
      reference: 'Reference',
      reverseChargeNote: 'Reverse charge – Article 194 VAT Directive',
    },
  };

  return translations[language] || translations['en'];
}

// Pomocnicza funkcja do generowania prawdziwego PDF używając Print API przeglądarki
export async function generateAndDownloadPDF(
  invoice: Invoice,
  company: Company,
  client: Client,
  lines: InvoiceLine[],
  language: string,
  templateId: string = 'classic'
): Promise<void> {
  // Ta funkcja generuje PDF używając window.print() z ustawieniem "Zapisz jako PDF"
  // Jest to najlepsze rozwiązanie bez dodatkowych bibliotek
  await generateInvoicePDF(invoice, company, client, lines, language, templateId);
}

// Eksport HTML dla emaila (można załączyć jako plik)
export async function generateInvoiceHTML(
  invoice: Invoice,
  company: Company,
  client: Client,
  lines: InvoiceLine[],
  language: string,
  templateId: string = 'classic'
): Promise<Blob> {
  const template = getTemplateById(templateId);
  
  const qrDataUrl = await QRCode.toDataURL(invoice.payment_qr_payload, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 200,
    margin: 2,
  });

  let logoDataUrl = '';
  if (template.config.showLogo && company.logo_url) {
    logoDataUrl = await imageUrlToBase64(company.logo_url);
  }

  const weekNumber = getISOWeekNumber(invoice.issue_date).toString();
  const t = getTranslations(language);

  const html = generateTemplateHTML(invoice, company, client, lines, template, qrDataUrl, weekNumber, t, language, logoDataUrl);
  
  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Faktura ${invoice.invoice_number}</title>
</head>
<body>${html}</body>
</html>`;

  return new Blob([fullHTML], { type: 'text/html' });
}
