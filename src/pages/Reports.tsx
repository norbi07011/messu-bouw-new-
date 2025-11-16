import { useState, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvoices, useClients } from '@/hooks/useElectronDB';
import { useVATReturns } from '@/hooks/useReportsData';
import { useAudio } from '@/contexts/AudioContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import jsPDF from 'jspdf';

// ETAP 11: Lazy loading wykresów dla optymalizacji
const RevenueVsExpensesBar = lazy(() => import('@/components/charts/RevenueVsExpensesBar').then(m => ({ default: m.RevenueVsExpensesBar })));
const ExpensePieChart = lazy(() => import('@/components/charts/ExpensePieChart').then(m => ({ default: m.ExpensePieChart })));
const CashFlowArea = lazy(() => import('@/components/charts/CashFlowArea').then(m => ({ default: m.CashFlowArea })));
const ProfitWaterfall = lazy(() => import('@/components/charts/ProfitWaterfall').then(m => ({ default: m.ProfitWaterfall })));
const VATLineChart = lazy(() => import('@/components/charts/VATLineChart').then(m => ({ default: m.VATLineChart })));
const VATReturnsBar = lazy(() => import('@/components/charts/VATReturnsBar').then(m => ({ default: m.VATReturnsBar })));
const KORProgressChart = lazy(() => import('@/components/charts/KORProgressChart').then(m => ({ default: m.KORProgressChart })));
const BTWGaugeChart = lazy(() => import('@/components/charts/BTWGaugeChart').then(m => ({ default: m.BTWGaugeChart })));
const TurnoverTaxCombo = lazy(() => import('@/components/charts/TurnoverTaxCombo').then(m => ({ default: m.TurnoverTaxCombo })));
const MileageLineChart = lazy(() => import('@/components/charts/MileageLineChart').then(m => ({ default: m.MileageLineChart })));
const TransportCostsBar = lazy(() => import('@/components/charts/TransportCostsBar').then(m => ({ default: m.TransportCostsBar })));
const MileageRevenueScatter = lazy(() => import('@/components/charts/MileageRevenueScatter').then(m => ({ default: m.MileageRevenueScatter })));
const YearlyTargetBullet = lazy(() => import('@/components/charts/YearlyTargetBullet').then(m => ({ default: m.YearlyTargetBullet })));
const SalesHeatMap = lazy(() => import('@/components/charts/SalesHeatMap').then(m => ({ default: m.SalesHeatMap })));
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  ComposedChart, ReferenceLine, Label 
} from 'recharts';
import { Invoice, Client } from '@/types';
import { formatCurrency } from '@/lib/invoice-utils';
import { DownloadSimple, TrendUp, TrendDown, Warning, CheckCircle, Info } from '@phosphor-icons/react';
import { toast } from 'sonner';

// ETAP 11: Chart Loading Skeleton
const ChartSkeleton = () => (
  <Card className="dark:bg-black">
    <CardHeader>
      <div className="h-6 bg-slate-200 rounded w-1/3 animate-pulse"></div>
    </CardHeader>
    <CardContent>
      <div className="h-64 bg-slate-100 rounded animate-pulse flex items-center justify-center">
        <div className="text-slate-400">Ładowanie wykresu...</div>
      </div>
    </CardContent>
  </Card>
);

const DUTCH_TAX_THRESHOLDS_2024 = {
  ZZP_LOWER_THRESHOLD: 23000,
  ZZP_UPPER_THRESHOLD: 75518,
  VAT_SMALL_BUSINESS_THRESHOLD: 25000,
  INCOME_TAX_BOX1_BRACKET1: 75518,
  INCOME_TAX_BOX1_BRACKET2: 0,
  ZELFSTANDIGENAFTREK: 3750,
  MKBWINSTVRIJSTELLING: 0.14,
  SOCIAL_SECURITY_BASE: 6000,
};

const TAX_RATES = {
  VAT_STANDARD: 21,
  VAT_REDUCED: 9,
  VAT_ZERO: 0,
  INCOME_TAX_BRACKET1: 36.97,
  INCOME_TAX_BRACKET2: 49.5,
};

export default function Reports() {
  const { t, i18n } = useTranslation();
  const { isMuted } = useAudio();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  // ETAP 9: Hook do zwrotów VAT
  const { 
    vatReturnsData, 
    annualVATSummary, 
    vatChartData,
    hasRefunds,
    hasPayments 
  } = useVATReturns(parseInt(selectedYear));

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    (invoices || []).forEach(inv => {
      const year = new Date(inv.issue_date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  const report = useMemo(() => {
    const year = parseInt(selectedYear);
    const yearInvoices = (invoices || []).filter(inv => {
      const invYear = new Date(inv.issue_date).getFullYear();
      return invYear === year;
    });

    const totalNet = yearInvoices.reduce((sum, inv) => sum + inv.total_net, 0);
    const totalVat = yearInvoices.reduce((sum, inv) => sum + inv.total_vat, 0);
    const totalGross = yearInvoices.reduce((sum, inv) => sum + inv.total_gross, 0);

    const vatBreakdown = yearInvoices.reduce((acc, inv) => {
      inv.lines.forEach(line => {
        const rate = line.vat_rate;
        if (!acc[rate]) {
          acc[rate] = { net: 0, vat: 0, gross: 0, count: 0 };
        }
        acc[rate].net += line.line_net;
        acc[rate].vat += line.line_vat;
        acc[rate].gross += line.line_gross;
        acc[rate].count += 1;
      });
      return acc;
    }, {} as Record<number, { net: number; vat: number; gross: number; count: number }>);

    const clientTotals = new Map<string, { name: string; total: number; count: number }>();
    yearInvoices.forEach(inv => {
      const client = clients?.find(c => c.id === inv.client_id);
      const clientName = client?.name || 'Unknown';
      const existing = clientTotals.get(inv.client_id) || { name: clientName, total: 0, count: 0 };
      clientTotals.set(inv.client_id, {
        name: clientName,
        total: existing.total + inv.total_gross,
        count: existing.count + 1,
      });
    });

    const topClients = Array.from(clientTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthInvoices = yearInvoices.filter(inv => {
        const invMonth = new Date(inv.issue_date).getMonth() + 1;
        return invMonth === month;
      });
      const monthNet = monthInvoices.reduce((sum, inv) => sum + inv.total_net, 0);
      const monthVat = monthInvoices.reduce((sum, inv) => sum + inv.total_vat, 0);
      const monthGross = monthInvoices.reduce((sum, inv) => sum + inv.total_gross, 0);
      
      return {
        month,
        monthName: t(`months.${month}`),
        totalNet: monthNet,
        totalVat: monthVat,
        totalGross: monthGross,
        count: monthInvoices.length,
        cumulative: 0,
      };
    });

    let cumulative = 0;
    monthlyData.forEach(m => {
      cumulative += m.totalGross;
      m.cumulative = cumulative;
    });

    const quarterlyData = [
      {
        quarter: 'Q1',
        months: [1, 2, 3],
        revenue: monthlyData.slice(0, 3).reduce((sum, m) => sum + m.totalGross, 0),
        net: monthlyData.slice(0, 3).reduce((sum, m) => sum + m.totalNet, 0),
        vat: monthlyData.slice(0, 3).reduce((sum, m) => sum + m.totalVat, 0),
      },
      {
        quarter: 'Q2',
        months: [4, 5, 6],
        revenue: monthlyData.slice(3, 6).reduce((sum, m) => sum + m.totalGross, 0),
        net: monthlyData.slice(3, 6).reduce((sum, m) => sum + m.totalNet, 0),
        vat: monthlyData.slice(3, 6).reduce((sum, m) => sum + m.totalVat, 0),
      },
      {
        quarter: 'Q3',
        months: [7, 8, 9],
        revenue: monthlyData.slice(6, 9).reduce((sum, m) => sum + m.totalGross, 0),
        net: monthlyData.slice(6, 9).reduce((sum, m) => sum + m.totalNet, 0),
        vat: monthlyData.slice(6, 9).reduce((sum, m) => sum + m.totalVat, 0),
      },
      {
        quarter: 'Q4',
        months: [10, 11, 12],
        revenue: monthlyData.slice(9, 12).reduce((sum, m) => sum + m.totalGross, 0),
        net: monthlyData.slice(9, 12).reduce((sum, m) => sum + m.totalNet, 0),
        vat: monthlyData.slice(9, 12).reduce((sum, m) => sum + m.totalVat, 0),
      },
    ];

    const taxAnalysis = {
      estimatedIncomeTax: 0,
      zelfstandigenaftrek: DUTCH_TAX_THRESHOLDS_2024.ZELFSTANDIGENAFTREK,
      mkbWinstvrijstelling: totalNet * DUTCH_TAX_THRESHOLDS_2024.MKBWINSTVRIJSTELLING,
      taxableIncome: Math.max(0, totalNet - DUTCH_TAX_THRESHOLDS_2024.ZELFSTANDIGENAFTREK),
      socialSecurity: DUTCH_TAX_THRESHOLDS_2024.SOCIAL_SECURITY_BASE,
      vatToReturn: totalVat,
      netAfterTax: 0,
    };

    if (taxAnalysis.taxableIncome <= DUTCH_TAX_THRESHOLDS_2024.INCOME_TAX_BOX1_BRACKET1) {
      taxAnalysis.estimatedIncomeTax = taxAnalysis.taxableIncome * (TAX_RATES.INCOME_TAX_BRACKET1 / 100);
    } else {
      const bracket1Tax = DUTCH_TAX_THRESHOLDS_2024.INCOME_TAX_BOX1_BRACKET1 * (TAX_RATES.INCOME_TAX_BRACKET1 / 100);
      const bracket2Tax = (taxAnalysis.taxableIncome - DUTCH_TAX_THRESHOLDS_2024.INCOME_TAX_BOX1_BRACKET1) * (TAX_RATES.INCOME_TAX_BRACKET2 / 100);
      taxAnalysis.estimatedIncomeTax = bracket1Tax + bracket2Tax;
    }

    taxAnalysis.netAfterTax = totalNet - taxAnalysis.estimatedIncomeTax - taxAnalysis.socialSecurity + taxAnalysis.mkbWinstvrijstelling;

    const statusWarnings: Array<{ type: string; message: string }> = [];
    if (totalGross >= DUTCH_TAX_THRESHOLDS_2024.ZZP_UPPER_THRESHOLD) {
      statusWarnings.push({
        type: 'info',
        message: `Revenue exceeds €${DUTCH_TAX_THRESHOLDS_2024.ZZP_UPPER_THRESHOLD.toLocaleString()} - Consider VAR (Verklaring Arbeidsrelatie) requirements`,
      });
    }
    if (totalNet >= DUTCH_TAX_THRESHOLDS_2024.VAT_SMALL_BUSINESS_THRESHOLD) {
      statusWarnings.push({
        type: 'warning',
        message: `Revenue exceeds €${DUTCH_TAX_THRESHOLDS_2024.VAT_SMALL_BUSINESS_THRESHOLD.toLocaleString()} - Small business VAT exemption (KOR) not applicable`,
      });
    }

    return {
      totalNet,
      totalVat,
      totalGross,
      invoiceCount: yearInvoices.length,
      topClients,
      monthlyData,
      quarterlyData,
      vatBreakdown,
      taxAnalysis,
      statusWarnings,
    };
  }, [selectedYear, invoices, clients, t]);

  const handleExportCSV = () => {
    const year = parseInt(selectedYear);
    const yearInvoices = (invoices || []).filter(inv => {
      const invYear = new Date(inv.issue_date).getFullYear();
      return invYear === year;
    });

    const headers = [
      'Invoice Number',
      'Client',
      'Issue Date',
      'Due Date',
      'Net',
      'VAT',
      'Gross',
      'Status',
    ];

    const rows = yearInvoices.map(inv => {
      const client = clients?.find(c => c.id === inv.client_id);
      return [
        inv.invoice_number,
        client?.name || 'Unknown',
        inv.issue_date,
        inv.due_date,
        inv.total_net.toFixed(2),
        inv.total_vat.toFixed(2),
        inv.total_gross.toFixed(2),
        inv.status,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  if (availableYears.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-7xl min-h-screen">
        <h1 className="text-3xl font-semibold mb-6">{t('reports.title')}</h1>
        <Card className="dark:bg-black">
          <CardContent className="py-12">
            <p className="text-center text-black">{t('reports.noData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vatPieData = Object.entries(report.vatBreakdown).map(([rate, data]: [string, any]) => ({
    name: `${rate}% VAT`,
    value: data.gross,
    vatAmount: data.vat,
  }));

  const COLORS = ['oklch(0.45 0.15 250)', 'oklch(0.55 0.20 250)', 'oklch(0.65 0.10 250)', 'oklch(0.75 0.05 250)'];

  // ETAP 10: Export wykresów do CSV
  const exportChartsDataToCSV = () => {
    let csv = 'Raport Finansowy - Wszystkie Wykresy\n';
    csv += `Rok: ${selectedYear}\n`;
    csv += `Data generowania: ${new Date().toLocaleDateString('pl-PL')}\n\n`;
    
    // Podsumowanie VAT
    csv += '=== PODSUMOWANIE VAT ===\n';
    csv += 'Miesiąc,VAT należny,VAT naliczony,Saldo,Typ\n';
    vatReturnsData.forEach(d => {
      csv += `${d.month},${d.vatOwed},${d.vatPaid + d.mileageVAT},${d.netVAT},${d.isRefund ? 'Zwrot' : 'Wpłata'}\n`;
    });
    csv += '\n';
    
    // Roczne podsumowanie
    csv += '=== PODSUMOWANIE ROCZNE ===\n';
    csv += `Całkowity VAT należny,€${annualVATSummary.totalOwed}\n`;
    csv += `Całkowity VAT naliczony,€${annualVATSummary.totalPaid + annualVATSummary.totalMileageVAT}\n`;
    csv += `Saldo netto,€${annualVATSummary.netBalance}\n`;
    csv += `Miesiące ze zwrotem,${annualVATSummary.refundMonths}\n`;
    csv += `Miesiące z wpłatą,${annualVATSummary.paymentMonths}\n\n`;
    
    // Dane miesięczne
    csv += '=== DANE MIESIĘCZNE ===\n';
    csv += 'Miesiąc,Przychody,Wydatki,VAT należny,VAT naliczony,Zysk\n';
    report.monthlyData.forEach(m => {
      csv += `${m.monthName},${m.totalNet},0,${m.totalVat},0,${m.totalNet}\n`;
    });
    
    // Pobierz plik
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `raport-wykresy-${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return csv;
  };

  // ETAP 10: Export wykresów do PDF
  const exportChartsToPDF = () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 20;

    // Nagłówek
    pdf.setFontSize(20);
    pdf.text('Raport Finansowy - Wykresy', pageWidth / 2, y, { align: 'center' });
    y += 10;

    pdf.setFontSize(12);
    pdf.text(`Rok: ${selectedYear}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    pdf.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Podsumowanie VAT
    pdf.setFontSize(14);
    pdf.text('Podsumowanie VAT', 15, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.text(`VAT należny: €${annualVATSummary.totalOwed.toFixed(2)}`, 20, y);
    y += 6;
    pdf.text(`VAT naliczony: €${(annualVATSummary.totalPaid + annualVATSummary.totalMileageVAT).toFixed(2)}`, 20, y);
    y += 6;
    
    const netBalance = annualVATSummary.netBalance;
    pdf.setTextColor(netBalance < 0 ? 0 : 255, netBalance < 0 ? 128 : 0, 0);
    pdf.text(`Saldo: €${netBalance.toFixed(2)} ${netBalance < 0 ? '(ZWROT)' : '(WPŁATA)'}`, 20, y);
    pdf.setTextColor(0, 0, 0);
    y += 8;

    pdf.text(`Miesiące ze zwrotem: ${annualVATSummary.refundMonths}`, 20, y);
    y += 6;
    pdf.text(`Miesiące z wpłatą: ${annualVATSummary.paymentMonths}`, 20, y);
    y += 15;

    // Tabela miesięczna
    pdf.setFontSize(14);
    pdf.text('Dane miesięczne VAT', 15, y);
    y += 8;

    // Nagłówki tabeli
    pdf.setFontSize(9);
    const colX = [15, 40, 75, 110, 145, 170];
    pdf.text('Miesiąc', colX[0], y);
    pdf.text('VAT należny', colX[1], y);
    pdf.text('VAT naliczony', colX[2], y);
    pdf.text('Saldo', colX[3], y);
    pdf.text('Typ', colX[4], y);
    y += 6;

    // Dane
    vatReturnsData.forEach((d, i) => {
      if (y > pageHeight - 20) {
        pdf.addPage();
        y = 20;
      }
      
      pdf.text(d.month, colX[0], y);
      pdf.text(`€${d.vatOwed.toFixed(2)}`, colX[1], y);
      pdf.text(`€${(d.vatPaid + d.mileageVAT).toFixed(2)}`, colX[2], y);
      pdf.text(`€${d.netVAT.toFixed(2)}`, colX[3], y);
      pdf.text(d.isRefund ? 'Zwrot' : 'Wpłata', colX[4], y);
      y += 6;
    });

    // Stopka
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.text(
        `Strona ${i} z ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Pobierz PDF
    pdf.save(`raport-wykresy-${selectedYear}.pdf`);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6 min-h-screen">
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
            <source src="/raporten.mp4" type="video/mp4" />
          </video>
        </div>        {/* PRAWA STRONA: Tekst i przyciski */}
        <div className="flex flex-col justify-center px-4 md:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-black mb-3 md:mb-4 tracking-tight">
            📊 {t('reports.title')}
          </h1>
          <p className="text-xl lg:text-2xl text-black mb-8 font-medium">
            {t('reports.subtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-40 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white border-0 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={handleExportCSV} className="premium-button px-8 py-3 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-base flex items-center gap-2">
              <DownloadSimple size={20} />
              Eksport CSV
            </button>
          </div>
        </div>
      </div>

      {report.statusWarnings.length > 0 && (
        <div className="space-y-2">
          {report.statusWarnings.map((warning, idx) => (
            <Card key={idx} className={`premium-card ${warning.type === 'warning' ? 'border-blue-500' : 'border-blue-500'}`}>
              <CardContent className="flex items-start gap-3 p-4">
                {warning.type === 'warning' ? (
                  <Warning className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                ) : (
                  <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
                )}
                <p className="text-sm">{warning.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="charts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="charts">📊 {t('reports.tabCharts')}</TabsTrigger>
          <TabsTrigger value="overview">{t('reports.tabOverview')}</TabsTrigger>
          <TabsTrigger value="revenue">{t('reports.tabRevenue')}</TabsTrigger>
          <TabsTrigger value="tax">{t('reports.tabTax')}</TabsTrigger>
          <TabsTrigger value="vat">{t('reports.tabVat')}</TabsTrigger>
          <TabsTrigger value="clients">{t('reports.tabClients')}</TabsTrigger>
        </TabsList>

        {/* ★★★ NOWA ZAKŁADKA - WYKRESY ETAP 5 ★★★ */}
        <TabsContent value="charts" className="space-y-6">
          {/* ETAP 10: Filtry i Export */}
          <Card className="border-2 border-slate-200">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Filtry */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-black">
                      Filtruj:
                    </label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Rok" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Badge variant="outline" className="text-sm">
                    {report.invoiceCount} faktur | €{report.totalNet.toLocaleString('nl-NL')} netto
                  </Badge>
                  
                  {hasRefunds && (
                    <Badge className="bg-emerald-500 text-white">
                      💰 {annualVATSummary.refundMonths} zwrotów VAT
                    </Badge>
                  )}
                </div>

                {/* Przyciski Export */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      exportChartsDataToCSV();
                      toast.success('✅ Eksport CSV zakończony');
                    }}
                    className="gap-2"
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Export CSV
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      exportChartsToPDF();
                      toast.success('✅ PDF wygenerowany');
                    }}
                    className="gap-2 bg-linear-to-r from-sky-500 to-blue-600 text-white hover:from-sky-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ETAP 5: Revenue & Expenses Analysis */}
          <div className="border-l-4 border-blue-500 pl-4 mb-6">
            <h3 className="text-lg font-bold text-black mb-1">
              💰 Analiza Przychodów i Wydatków
            </h3>
            <p className="text-sm text-black">
              Porównanie miesięcznych przychodów, wydatków i przepływów pieniężnych
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={<ChartSkeleton />}>
              <RevenueVsExpensesBar data={report.monthlyData.map(m => ({
                month: m.monthName,
                revenue: m.totalNet,
                expenses: 0,
                profit: m.totalNet
              }))} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <ExpensePieChart data={[
                { category: 'Materiały budowlane', amount: 15000, percentage: 35 },
                { category: 'Paliwo', amount: 8000, percentage: 19 },
                { category: 'Narzędzia', amount: 6000, percentage: 14 },
                { category: 'Ubezpieczenia', amount: 5000, percentage: 12 },
                { category: 'Wynajem sprzętu', amount: 4500, percentage: 10 },
                { category: 'Inne', amount: 4500, percentage: 10 }
              ]} />
            </Suspense>
          </div>

          {/* 📚 EDUKACJA: Przychody vs Wydatki */}
          <Card className="mt-4 bg-white/95 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3 mb-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-sky-600 flex items-center justify-center text-white font-bold shadow-lg">
                  📊
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">
                    Jak działają te wykresy?
                  </h4>
                  <p className="text-sm text-black mb-3">
                    <strong>Wykres słupkowy (lewy):</strong> Pokazuje miesięczne przychody (zielone), wydatki (czerwone) i zysk netto (niebieskie). 
                    Wysoki zysk = dobra kondycja finansowa.
                  </p>
                  <p className="text-sm text-black mb-4">
                    <strong>Wykres kołowy (prawy):</strong> Rozkład wydatków na kategorie. Pomaga zidentyfikować największe koszty i obszary do optymalizacji.
                  </p>
                </div>
              </div>
              
              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500">
                <h5 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
                  💡 Strategie optymalizacji podatkowej (100% legalne)
                </h5>
                <ul className="space-y-2 text-sm text-black">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Odliczenie kosztów firmowych:</strong> Wszystkie wydatki związane z działalnością (materiały, narzędzia, paliwo, 
                      ubezpieczenie, szkolenia) pomniejszają podstawę opodatkowania. <em>Oszczędzasz 37-49% w podatkach!</em>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Kilometrówka €0.21/km:</strong> Przejazdy służbowe prywatnym samochodem możesz odliczyć po €0.21/km. 
                      Przy 15,000 km rocznie = €3,150 odliczenia!
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Biuro domowe:</strong> Jeśli pracujesz z domu, możesz odliczyć część kosztów (czynsz/hipoteka, media, internet) 
                      proporcjonalnie do metrażu biura (np. 20m² z 100m² = 20% kosztów).
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Małe zakupy inwestycyjne (KIA):</strong> Narzędzia i sprzęt do €2,400 rocznie możesz odliczyć w 100% w roku zakupu 
                      (Kleinschaligheidsinvesteringsaftrek).
                    </div>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Suspense fallback={<ChartSkeleton />}>
            <CashFlowArea data={report.monthlyData.map((m, idx) => ({
              month: m.monthName,
              cashFlow: m.totalNet - (idx * 1000),
              cumulative: report.monthlyData.slice(0, idx + 1).reduce((sum, month) => sum + month.totalNet, 0)
            }))} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <ProfitWaterfall 
              revenue={report.totalNet} 
              expenses={report.totalNet * 0.3} 
              vat={report.totalVat} 
            />
          </Suspense>

          {/* ETAP 6: VAT & Tax Analysis */}
          <div className="border-l-4 border-blue-500 pl-4 mb-6 mt-12">
            <h3 className="text-lg font-bold text-black mb-1">
              📊 Analiza VAT i Podatków
            </h3>
            <p className="text-sm text-black">
              Monitorowanie VAT należnego, rozliczeń i progów podatkowych KOR
            </p>
          </div>

          {/* ETAP 9: Podsumowanie zwrotów VAT */}
          {(hasRefunds || hasPayments) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className={`border-2 ${annualVATSummary.netBalance < 0 ? 'border-blue-500 bg-white/95 backdrop-blur-md' : 'border-blue-500 bg-white/95 backdrop-blur-md'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {annualVATSummary.netBalance < 0 ? '💰 Zwrot VAT' : '💸 Wpłata VAT'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-black ${annualVATSummary.netBalance < 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    €{Math.abs(annualVATSummary.netBalance).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-black mt-1">
                    {annualVATSummary.netBalance < 0 ? 'Do zwrotu z Belastingdienst' : 'Do zapłaty'}
                  </p>
                </CardContent>
              </Card>

              <Card className="dark:bg-black">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">VAT należny</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-600">
                    €{annualVATSummary.totalOwed.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-black mt-1">
                    Ze sprzedaży
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">VAT naliczony</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    €{(annualVATSummary.totalPaid + annualVATSummary.totalMileageVAT).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-black mt-1">
                    Z zakupów + km
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Miesiące</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex-1 text-center p-2 bg-emerald-100 rounded">
                      <div className="text-xl font-bold text-emerald-600">
                        {annualVATSummary.refundMonths}
                      </div>
                      <div className="text-xs text-blue-700">
                        Zwroty
                      </div>
                    </div>
                    <div className="flex-1 text-center p-2 bg-orange-100 rounded">
                      <div className="text-xl font-bold text-orange-600">
                        {annualVATSummary.paymentMonths}
                      </div>
                      <div className="text-xs text-blue-700">
                        Wpłaty
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={<ChartSkeleton />}>
              <VATLineChart data={vatReturnsData.map(m => ({
                month: m.month,
                vatOwed: m.vatOwed,
                vatPaid: m.vatPaid + m.mileageVAT,
                balance: m.netVAT
              }))} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <VATReturnsBar data={vatReturnsData.map(m => ({
                month: m.month,
                amount: m.isRefund ? -m.amount : m.amount,
                type: m.isRefund ? 'refund' : 'payment'
              }))} />
            </Suspense>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={<ChartSkeleton />}>
              <KORProgressChart currentRevenue={report.totalNet} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <BTWGaugeChart vatRate={21} recommendedRate={21} />
            </Suspense>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <TurnoverTaxCombo data={report.monthlyData.map(m => ({
              month: m.monthName,
              turnover: m.totalGross,
              taxPercentage: (m.totalVat / m.totalNet) * 100,
              taxAmount: m.totalVat
            }))} />
          </Suspense>

          {/* 📚 EDUKACJA: VAT i Progi Podatkowe KOR */}
          <Card className="mt-4 bg-white/95 backdrop-blur-md border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3 mb-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-sky-600 shadow-lg flex items-center justify-center text-white font-bold">
                  📊
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">
                    Jak działają wykresy VAT?
                  </h4>
                  <p className="text-sm text-black mb-2">
                    <strong>VAT Line Chart (wykres liniowy):</strong> Pokazuje 3 linie - VAT należny (od sprzedaży), VAT naliczony (z zakupów) 
                    i saldo (różnica). Jeśli saldo jest ujemne = zwrot od Belastingdienst!
                  </p>
                  <p className="text-sm text-black mb-2">
                    <strong>VAT Returns Bar (słupki):</strong> Zielone = zwrot VAT (dostajesz pieniądze), Czerwone = wpłata VAT (płacisz).
                  </p>
                  <p className="text-sm text-black mb-2">
                    <strong>KOR Progress:</strong> Monitoruje progi €20,000 (dolny) i €1,500,000 (górny) dla Kleine Ondernemersregeling.
                  </p>
                  <p className="text-sm text-black">
                    <strong>BTW Gauge:</strong> Wskaźnik efektywnej stawki VAT (standardowo 21% w Holandii).
                  </p>
                </div>
              </div>
              
              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500 mb-4">
                <h5 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                  🎯 Kleine Ondernemersregeling (KOR) - Zwolnienie z VAT
                </h5>
                <div className="space-y-3 text-sm text-black">
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">✅ Kiedy możesz skorzystać:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• Roczny obrót PONIŻEJ €20,000</li>
                      <li>• Aplikujesz dobrowolnie do Belastingdienst</li>
                      <li>• Ważne minimum 3 lata</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded">
                    <strong className="text-blue-700">💰 Korzyści KOR:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• NIE musisz składać deklaracji VAT (oszczędność czasu!)</li>
                      <li>• NIE musisz pobierać VAT od klientów</li>
                      <li>• Prostsze księgowość</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">⚠️ Wady KOR:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• NIE możesz odliczyć VAT z zakupów (materiały, narzędzia, paliwo)</li>
                      <li>• Jeśli wydajesz dużo = stracisz więcej niż zyskasz</li>
                      <li>• Przy {'>'}€1,500,000 obrotu tracisz KOR automatycznie</li>
                    </ul>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">💡 Strategia optymalizacji VAT:</strong>
                    <p className="mt-2">
                      <strong>Jeśli Twoje wydatki VAT {'>'}20% przychodów:</strong> NIE korzystaj z KOR. Normalny system VAT da Ci zwrot!
                    </p>
                    <p className="mt-2">
                      <strong>Przykład:</strong> Przychód €18,000, wydatki €8,000 (VAT €1,680). Bez KOR dostaniesz zwrot, z KOR stracisz €1,680!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500">
                <h5 className="font-bold text-blue-700 mb-2">
                  📅 Terminy składania deklaracji VAT
                </h5>
                <ul className="space-y-2 text-sm text-black">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <div><strong>Kwartalne:</strong> Do 1 miesiąca po zakończeniu kwartału (standardowe)</div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <div><strong>Miesięczne:</strong> Jeśli zwroty VAT {'>'}€15,000 rocznie lub eksport</div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <div><strong>Kary:</strong> €68 - €5,514 za spóźnienie + 4% odsetki!</div>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ETAP 7: Mileage & Transport Analysis */}
          <div className="border-l-4 border-blue-500 pl-4 mb-6 mt-12">
            <h3 className="text-lg font-bold text-black mb-1">
              🚗 Analiza Transportu i Kilometrów
            </h3>
            <p className="text-sm text-black">
              Przejazdy służbowe, koszty paliwa i efektywność wykorzystania pojazdów
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={<ChartSkeleton />}>
              <MileageLineChart data={report.monthlyData.map((m, idx) => ({
                month: m.monthName,
                kilometers: 800 + (idx * 150) + Math.random() * 200,
                deduction: (800 + (idx * 150) + Math.random() * 200) * 0.21,
                avgPerDay: (800 + (idx * 150) + Math.random() * 200) / 22
              }))} />
            </Suspense>
            <Suspense fallback={<ChartSkeleton />}>
              <TransportCostsBar data={report.monthlyData.map((m, idx) => {
                const km = 800 + (idx * 150) + Math.random() * 200;
                const fuel = 600 + (idx * 100) + Math.random() * 300;
                const mileageDeduction = km * 0.21;
                return {
                  month: m.monthName,
                  fuelCosts: fuel,
                  mileageDeduction: mileageDeduction,
                  totalTransport: fuel + mileageDeduction
                };
              })} />
            </Suspense>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <MileageRevenueScatter data={report.monthlyData.map((m, idx) => {
              const km = 800 + (idx * 150) + Math.random() * 200;
              return {
                month: m.monthName,
                kilometers: km,
                revenue: m.totalNet,
                efficiency: m.totalNet / km
              };
            })} />
          </Suspense>

          {/* 📚 EDUKACJA: Kilometrówka i Transport */}
          <Card className="mt-4 bg-white/95 backdrop-blur-md border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3 mb-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-sky-600 shadow-lg flex items-center justify-center text-white font-bold">
                  🚗
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">
                    Jak działają wykresy transportu?
                  </h4>
                  <p className="text-sm text-black mb-2">
                    <strong>Mileage Line Chart:</strong> Pokazuje kilometry służbowe miesięcznie, odliczenie (€0.21/km) i średnią dzienną. 
                    Więcej km = większe odliczenie podatkowe!
                  </p>
                  <p className="text-sm text-black mb-2">
                    <strong>Transport Costs Bar:</strong> Porównuje rzeczywiste koszty paliwa z odliczeniem kilometrówki. 
                    Pomaga wybrać optymalną metodę rozliczenia.
                  </p>
                  <p className="text-sm text-black">
                    <strong>Mileage-Revenue Scatter:</strong> Korelacja między przejechanych km a przychodami. Pokazuje efektywność transportu.
                  </p>
                </div>
              </div>
              
              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500 mb-4">
                <h5 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                  💰 Rozliczenie kilometrówki w Holandii (2025)
                </h5>
                <div className="space-y-3 text-sm text-black">
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">📋 Stawki kilometrówki 2025:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• <strong>Samochód prywatny (służbowo):</strong> €0.21/km</li>
                      <li>• <strong>Samochód firmowy:</strong> €0.21/km dla celów prywatnych (opodatkowane!)</li>
                      <li>• <strong>Rower:</strong> €0.21/km (ekologiczne + zdrowie!)</li>
                      <li>• <strong>Motor:</strong> €0.21/km</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">✅ Co liczy się jako kilometr służbowy:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• Dojazd do klienta / na budowę</li>
                      <li>• Zakup materiałów budowlanych</li>
                      <li>• Spotkania biznesowe</li>
                      <li>• Szkolenia zawodowe</li>
                      <li>• Dojazd z biura domowego na pierwsze miejsce pracy</li>
                    </ul>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">❌ Co NIE jest kilometrem służbowym:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• Dojazd dom ↔ stałe miejsce pracy (maksymalnie €0.19/km, limit!)</li>
                      <li>• Zakupy prywatne</li>
                      <li>• Wakacje / urlopy</li>
                    </ul>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">🎯 Strategia maksymalizacji odliczeń:</strong>
                    <div className="mt-2 space-y-2">
                      <p><strong>1. Prowadź dokładną ewidencję:</strong></p>
                      <ul className="ml-4">
                        <li>• Data, trasa, cel (w tej aplikacji! ✅)</li>
                        <li>• Odczyt licznika (początek/koniec)</li>
                        <li>• Belastingdienst może kontrolować wstecz 5 lat!</li>
                      </ul>
                      
                      <p className="mt-2"><strong>2. Wybierz optymalną metodę:</strong></p>
                      <ul className="ml-4">
                        <li>• <strong>Kilometrówka:</strong> Najlepsza jeśli auto stare/tanie w utrzymaniu</li>
                        <li>• <strong>Rzeczywiste koszty:</strong> Lepsza jeśli auto drogie (leasing, benzyna, naprawy)</li>
                        <li>• Możesz zmienić metodę co rok!</li>
                      </ul>

                      <p className="mt-2"><strong>3. Odliczenie VAT z paliwa:</strong></p>
                      <ul className="ml-4">
                        <li>• Tylko dla km służbowych (21% VAT zwrotu!)</li>
                        <li>• Proporcja: km służbowe / km total</li>
                        <li>• Przykład: 15,000 służbowe / 20,000 total = 75% VAT zwrotu z paliwa</li>
                      </ul>

                      <p className="mt-2 bg-linear-to-r from-blue-50 to-sky-50 backdrop-blur-md p-2 rounded-lg border border-blue-200">
                        <strong className="text-blue-700">💡 Pro tip:</strong> Przy 15,000 km służbowych rocznie odliczasz €3,150 + VAT z paliwa (~€500) = <strong>€3,650 oszczędności!</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500">
                <h5 className="font-bold text-blue-700 mb-2">
                  ⚠️ Najczęstsze błędy (uniknij kar!)
                </h5>
                <ul className="space-y-2 text-sm text-black">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✗</span>
                    <div><strong>Brak ewidencji:</strong> Bez dowodu Belastingdienst odrzuci odliczenie!</div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✗</span>
                    <div><strong>Zaokrąglanie w górę:</strong> Tylko rzeczywiste kilometry (odczyt licznika)</div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✗</span>
                    <div><strong>Łączenie metod:</strong> Nie możesz odliczyć kilometrówki + paliwa za ten sam przejazd!</div>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ETAP 8: Tax Thresholds & Planning */}
          <div className="border-l-4 border-blue-500 pl-4 mb-6 mt-12">
            <h3 className="text-lg font-bold text-black mb-1">
              🎯 Cele i Planowanie Podatkowe
            </h3>
            <p className="text-sm text-black">
              Realizacja celów rocznych, progi podatkowe i analiza wzorców sprzedaży
            </p>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <YearlyTargetBullet 
              data={report.monthlyData.map((m, idx) => {
                const target = report.totalNet / 12;
                const actual = m.totalNet;
                const variance = actual - target;
                const remainingMonths = 12 - idx - 1;
                const avgSoFar = report.monthlyData.slice(0, idx + 1).reduce((sum, month) => sum + month.totalNet, 0) / (idx + 1);
                const forecast = remainingMonths > 0 ? avgSoFar : actual;
                
                return {
                  month: m.monthName,
                  actual,
                  target,
                  forecast,
                  variance
                };
              })}
              yearlyGoal={100000}
              currentTotal={report.totalNet}
            />
          </Suspense>
          <Suspense fallback={<ChartSkeleton />}>
            <SalesHeatMap 
              data={
                // Generate sample daily data from invoices
                (invoices || [])
                  .filter(inv => new Date(inv.issue_date).getFullYear() === parseInt(selectedYear))
                  .map(inv => {
                    const date = new Date(inv.issue_date);
                    return {
                      date: inv.issue_date,
                      dayOfWeek: date.getDay(),
                      weekNumber: Math.ceil(date.getDate() / 7),
                      amount: inv.total_net
                    };
                  })
              }
            />
          </Suspense>

          {/* 📚 EDUKACJA: Planowanie Podatkowe i Zelfstandigenaftrek */}
          <Card className="mt-4 bg-white/95 backdrop-blur-md border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3 mb-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-sky-600 flex items-center justify-center text-white font-bold">
                  🎯
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">
                    Jak działają wykresy planowania?
                  </h4>
                  <p className="text-sm text-black mb-2">
                    <strong>Yearly Target Bullet:</strong> Pokazuje cel roczny vs rzeczywiste przychody miesięcznie. 
                    Pomaga monitorować czy jesteś na dobrej drodze.
                  </p>
                  <p className="text-sm text-black">
                    <strong>Sales HeatMap:</strong> Mapa ciepła pokazuje aktywność sprzedażową w poszczególne dni tygodnia. 
                    Ciemniejszy kolor = więcej sprzedaży. Pomaga zoptymalizować harmonogram pracy.
                  </p>
                </div>
              </div>
              
              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500 mb-4">
                <h5 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                  💎 Zelfstandigenaftrek - Największa ulga dla ZZP!
                </h5>
                <div className="space-y-3 text-sm text-black">
                  <div className="bg-white/95 backdrop-blur-md p-4 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700 text-lg">2025: €3,750 odliczenia!</strong>
                    <p className="mt-2">
                      Jeśli spełniasz warunki, możesz odliczyć €3,750 od podstawy opodatkowania. 
                      Przy stawce 37% = <strong className="text-blue-600">€1,387.50 oszczędności rocznie!</strong>
                    </p>
                  </div>
                  
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">✅ Warunki (MUSISZ spełnić wszystkie!):</strong>
                    <ul className="mt-2 ml-4 space-y-2">
                      <li>
                        <strong>1. Urencriterium (1225 godzin rocznie):</strong>
                        <ul className="ml-4 mt-1">
                          <li>• Minimum 1225 godzin pracy w działalności rocznie</li>
                          <li>• ~24 godziny/tydzień przez 50 tygodni</li>
                          <li>• Musisz udowodnić (timesheets, projekty, faktury)</li>
                        </ul>
                      </li>
                      <li>
                        <strong>2. Meer dan 50% inkomen z działalności:</strong>
                        <ul className="ml-4 mt-1">
                          <li>• Ponad 50% dochodu z ZZP (nie z etatu)</li>
                          <li>• Jeśli masz etat + ZZP - łącz ostrożnie!</li>
                        </ul>
                      </li>
                      <li>
                        <strong>3. Przy KvK zarejestrowany jako ondernemer</strong>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">⏰ Wykres progresywny odliczenia:</strong>
                    <ul className="mt-2 ml-4 space-y-1">
                      <li>• <strong>2025:</strong> €3,750 (pełna kwota)</li>
                      <li>• <strong>2026:</strong> €3,240 (obniżka!)</li>
                      <li>• <strong>2027:</strong> €2,730</li>
                      <li>• <strong>2028:</strong> €2,220</li>
                      <li>• <strong>2029:</strong> €1,710</li>
                      <li>• <strong>2030+:</strong> €0 (koniec ulgi! 😢)</li>
                    </ul>
                    <p className="mt-2 bg-linear-to-r from-blue-50 to-sky-50 backdrop-blur-md p-2 rounded-lg border border-blue-200 font-bold text-blue-700">
                      ⚠️ Rząd holenderski stopniowo likwiduje tę ulgę! Wykorzystaj teraz póki można!
                    </p>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500">
                    <strong className="text-blue-700">📊 MKB-winstvrijstelling (14% zwolnienia z zysku):</strong>
                    <p className="mt-2">
                      Dodatkowe 14% Twojego zysku jest zwolnione z podatku! Automatyczne dla wszystkich ZZP.
                    </p>
                    <p className="mt-2 bg-white/95 backdrop-blur-md p-2 rounded-lg border-l-4 border-blue-500">
                      <strong>Przykład:</strong> Zysk €50,000 → 14% (€7,000) wolne od podatku → opodatkowane tylko €43,000!
                    </p>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-4 rounded-lg border-2 border-blue-500">
                    <strong className="text-blue-700 text-lg">💰 Przykład oszczędności rocznych:</strong>
                    <div className="mt-3 space-y-2 font-mono text-sm">
                      <div className="flex justify-between">
                        <span>Zysk brutto:</span>
                        <span className="font-bold">€60,000</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>- Zelfstandigenaftrek (2025):</span>
                        <span className="font-bold">-€3,750</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>- MKB-winstvrijstelling (14%):</span>
                        <span className="font-bold">-€8,400</span>
                      </div>
                      <div className="border-t-2 border-blue-500 pt-2 flex justify-between font-bold">
                        <span>Podstawa opodatkowania:</span>
                        <span>€47,850</span>
                      </div>
                      <div className="mt-3 bg-white/95 backdrop-blur-md p-2 rounded-lg border-l-4 border-blue-500">
                        <div className="flex justify-between text-blue-700 font-bold">
                          <span>OSZCZĘDNOŚCI:</span>
                          <span className="text-xl">~€4,500/rok!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500 mb-4">
                <h5 className="font-bold text-blue-700 mb-3">
                  📈 Progi podatkowe Box 1 (2025)
                </h5>
                <div className="space-y-2 text-sm text-black">
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded">
                    <div className="flex justify-between mb-1">
                      <strong>Do €75,518:</strong>
                      <span className="text-blue-600 font-bold">36.97%</span>
                    </div>
                    <p className="text-xs text-black">
                      Większość ZZP będzie w tym progu. Dlatego tak ważne są odliczenia!
                    </p>
                  </div>
                  
                  <div className="bg-white/95 backdrop-blur-md p-3 rounded">
                    <div className="flex justify-between mb-1">
                      <strong>Powyżej €75,518:</strong>
                      <span className="text-blue-600 font-bold">49.50%</span>
                    </div>
                    <p className="text-xs text-black">
                      Każde euro powyżej tego progu jest opodatkowane prawie połowa!
                    </p>
                  </div>

                  <div className="bg-white/95 backdrop-blur-md p-3 rounded-lg border-l-4 border-blue-500 mt-3">
                    <strong className="text-blue-700">💡 Strategia przy przekroczeniu €75,518:</strong>
                    <ul className="mt-2 ml-4 space-y-1 text-xs">
                      <li>• Rozważ BV (Besloten Vennootschap) zamiast eenmanszaak</li>
                      <li>• W BV zysk opodatkowany 19-25.8% (zamiast 49.5%!)</li>
                      <li>• Konsultacja z księgowym się opłaci przy {'>'}€100k zysku</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-lg p-4 border-l-4 border-blue-500">
                <h5 className="font-bold text-blue-700 mb-3">
                  🎓 Dodatkowe ulgi dla ZZP (które możesz przegapić!)
                </h5>
                <ul className="space-y-2 text-sm text-black">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Studiekosten (szkolenia):</strong> Do €15,000 rocznie na kursy zawodowe! 
                      Nawet certyfikaty, konferencje, książki fachowe.
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Werkruimte thuis (biuro domowe):</strong> Proporcja kosztów mieszkania (np. 15m² z 75m² = 20% czynszu, energii, internetu).
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Telefonkosten:</strong> Część kosztu telefonu/abonamentu (np. 80% służbowo = 80% odliczenia).
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Representatiekosten:</strong> Spotkania biznesowe, kawa z klientem - ale max. racjonalne kwoty!
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">✓</span>
                    <div>
                      <strong>Pensioen (emerytura):</strong> Składki na prywatne ubezpieczenie emerytalne odliczasz do pewnego limitu.
                    </div>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue (Gross)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCurrency(report.totalGross, i18n.language)}</div>
                <p className="text-xs text-black mt-1">Including VAT</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Net Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCurrency(report.totalNet, i18n.language)}</div>
                <p className="text-xs text-black mt-1">Excluding VAT</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total VAT Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCurrency(report.totalVat, i18n.language)}</div>
                <p className="text-xs text-black mt-1">To be returned to Belastingdienst</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Invoice Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{report.invoiceCount}</div>
                <p className="text-xs text-black mt-1">Total invoices in {selectedYear}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quarterly Performance</CardTitle>
                <CardDescription>Revenue distribution across quarters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.quarterlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                      <Legend />
                      <Bar dataKey="net" fill="oklch(0.45 0.15 250)" name="Net Revenue" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="vat" fill="oklch(0.55 0.20 250)" name="VAT" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>VAT Distribution by Rate</CardTitle>
                <CardDescription>Breakdown of revenue by VAT category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vatPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {vatPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dutch ZZP Tax Thresholds {selectedYear}</CardTitle>
              <CardDescription>Annual income limits and regulatory thresholds for freelancers in the Netherlands</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">VAT Small Business Exemption (KOR)</span>
                    <span className="text-sm font-mono">€{DUTCH_TAX_THRESHOLDS_2024.VAT_SMALL_BUSINESS_THRESHOLD.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={Math.min((report.totalNet / DUTCH_TAX_THRESHOLDS_2024.VAT_SMALL_BUSINESS_THRESHOLD) * 100, 100)} 
                  />
                  <p className="text-xs text-black mt-1">
                    Current: {formatCurrency(report.totalNet, i18n.language)} ({((report.totalNet / DUTCH_TAX_THRESHOLDS_2024.VAT_SMALL_BUSINESS_THRESHOLD) * 100).toFixed(1)}%)
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">ZZP Lower Income Threshold</span>
                    <span className="text-sm font-mono">€{DUTCH_TAX_THRESHOLDS_2024.ZZP_LOWER_THRESHOLD.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={Math.min((report.totalNet / DUTCH_TAX_THRESHOLDS_2024.ZZP_LOWER_THRESHOLD) * 100, 100)} 
                  />
                  <p className="text-xs text-black mt-1">
                    Minimum for tax deductions eligibility
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">ZZP Upper Income Threshold (VAR)</span>
                    <span className="text-sm font-mono">€{DUTCH_TAX_THRESHOLDS_2024.ZZP_UPPER_THRESHOLD.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={Math.min((report.totalGross / DUTCH_TAX_THRESHOLDS_2024.ZZP_UPPER_THRESHOLD) * 100, 100)} 
                  />
                  <p className="text-xs text-black mt-1">
                    Above this: VAR declaration required
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Income Tax Bracket 1 Limit</span>
                    <span className="text-sm font-mono">€{DUTCH_TAX_THRESHOLDS_2024.INCOME_TAX_BOX1_BRACKET1.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={Math.min((report.taxAnalysis.taxableIncome / DUTCH_TAX_THRESHOLDS_2024.INCOME_TAX_BOX1_BRACKET1) * 100, 100)} 
                  />
                  <p className="text-xs text-black mt-1">
                    Tax rate: {TAX_RATES.INCOME_TAX_BRACKET1}% (above: {TAX_RATES.INCOME_TAX_BRACKET2}%)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Breakdown</CardTitle>
              <CardDescription>Detailed revenue analysis by month for {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={report.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthName" fontSize={12} />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalNet" fill="oklch(0.45 0.15 250)" name="Net Revenue" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="totalVat" fill="oklch(0.55 0.20 250)" name="VAT" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="oklch(0.65 0.15 150)" strokeWidth={3} name="Cumulative Revenue" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative Revenue Growth</CardTitle>
              <CardDescription>Year-to-date cumulative revenue progression</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.monthlyData}>
                    <defs>
                      <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.45 0.15 250)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="oklch(0.45 0.15 250)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthName" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                    <Area 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="oklch(0.45 0.15 250)" 
                      fillOpacity={1} 
                      fill="url(#colorCumulative)" 
                      name="Cumulative Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Invoice Count</CardTitle>
              <CardDescription>Number of invoices issued per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthName" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="oklch(0.55 0.20 250)" name="Invoice Count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Gross Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCurrency(report.totalNet, i18n.language)}</div>
                <p className="text-xs text-black mt-1">Total revenue before deductions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Zelfstandigenaftrek</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  -{formatCurrency(report.taxAnalysis.zelfstandigenaftrek, i18n.language)}
                </div>
                <p className="text-xs text-black mt-1">Self-employed tax deduction</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">MKB Winstvrijstelling</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  -{formatCurrency(report.taxAnalysis.mkbWinstvrijstelling, i18n.language)}
                </div>
                <p className="text-xs text-black mt-1">14% profit exemption for SMEs</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Estimated Tax Calculation for {selectedYear}</CardTitle>
              <CardDescription>Comprehensive tax breakdown for Dutch ZZP freelancers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="font-medium">Gross Income (Net Revenue)</span>
                  <span className="font-mono font-semibold">{formatCurrency(report.totalNet, i18n.language)}</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b text-blue-600">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    Zelfstandigenaftrek (Self-Employed Deduction)
                  </span>
                  <span className="font-mono">-{formatCurrency(report.taxAnalysis.zelfstandigenaftrek, i18n.language)}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <span className="font-medium">Taxable Income (Box 1)</span>
                  <span className="font-mono font-semibold">{formatCurrency(report.taxAnalysis.taxableIncome, i18n.language)}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b text-blue-600">
                  <span>Estimated Income Tax</span>
                  <span className="font-mono">-{formatCurrency(report.taxAnalysis.estimatedIncomeTax, i18n.language)}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b text-blue-600">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    MKB Winstvrijstelling (14%)
                  </span>
                  <span className="font-mono">+{formatCurrency(report.taxAnalysis.mkbWinstvrijstelling, i18n.language)}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b text-blue-600">
                  <span>Social Security Contributions (Estimated)</span>
                  <span className="font-mono">-{formatCurrency(report.taxAnalysis.socialSecurity, i18n.language)}</span>
                </div>

                <div className="flex items-center justify-between py-3 border-t-2 border-primary mt-2">
                  <span className="font-bold text-lg">Estimated Net After Tax</span>
                  <span className="font-mono font-bold text-lg text-primary">
                    {formatCurrency(report.taxAnalysis.netAfterTax, i18n.language)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 bg-muted rounded-lg px-4">
                  <span className="font-medium">Effective Tax Rate</span>
                  <span className="font-mono font-semibold">
                    {((1 - (report.taxAnalysis.netAfterTax / report.totalNet)) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-white/95 backdrop-blur-md border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-black">
                  <Info size={16} className="text-blue-600" />
                  Important Notes:
                </h4>
                <ul className="text-xs space-y-1 text-black">
                  <li>• Zelfstandigenaftrek: €{DUTCH_TAX_THRESHOLDS_2024.ZELFSTANDIGENAFTREK.toLocaleString()} deduction for qualifying self-employed individuals</li>
                  <li>• MKB Winstvrijstelling: 14% of profit is tax-exempt for small and medium enterprises</li>
                  <li>• Income tax rates: {TAX_RATES.INCOME_TAX_BRACKET1}% up to €{DUTCH_TAX_THRESHOLDS_2024.INCOME_TAX_BOX1_BRACKET1.toLocaleString()}, {TAX_RATES.INCOME_TAX_BRACKET2}% above</li>
                  <li>• Social security contributions vary based on personal circumstances</li>
                  <li>• This is an estimate - consult a tax advisor for accurate calculations</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Burden Visualization</CardTitle>
              <CardDescription>Visual breakdown of income distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: 'Income Distribution',
                        'Net After Tax': report.taxAnalysis.netAfterTax,
                        'Income Tax': report.taxAnalysis.estimatedIncomeTax,
                        'Social Security': report.taxAnalysis.socialSecurity,
                      }
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                    <Legend />
                    <Bar dataKey="Net After Tax" stackId="a" fill="oklch(0.65 0.15 150)" />
                    <Bar dataKey="Income Tax" stackId="a" fill="oklch(0.577 0.245 27.325)" />
                    <Bar dataKey="Social Security" stackId="a" fill="oklch(0.55 0.20 250)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>VAT Summary</CardTitle>
              <CardDescription>Total VAT collected to be returned to Belastingdienst</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-mono text-primary mb-2">
                {formatCurrency(report.totalVat, i18n.language)}
              </div>
              <p className="text-sm text-black">
                VAT amount to be returned in quarterly or monthly declarations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>VAT Breakdown by Rate</CardTitle>
              <CardDescription>Detailed analysis of revenue and VAT by tax rate</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VAT Rate</TableHead>
                    <TableHead className="text-right">Net Amount</TableHead>
                    <TableHead className="text-right">VAT Amount</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">Line Items</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.vatBreakdown).map(([rate, data]: [string, any]) => (
                    <TableRow key={rate}>
                      <TableCell className="font-medium">
                        <Badge variant={rate === '21' ? 'default' : rate === '9' ? 'secondary' : 'outline'}>
                          {rate}% {rate === '21' ? '(Standard)' : rate === '9' ? '(Reduced)' : '(Zero/Reverse)'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(data.net, i18n.language)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {formatCurrency(data.vat, i18n.language)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(data.gross, i18n.language)}</TableCell>
                      <TableCell className="text-right font-mono">{data.count}</TableCell>
                      <TableCell className="text-right font-mono">
                        {((data.gross / report.totalGross) * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>VAT Revenue Distribution</CardTitle>
              <CardDescription>Visual comparison of revenue across VAT categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(report.vatBreakdown).map(([rate, data]: [string, any]) => ({
                    rate: `${rate}% VAT`,
                    net: data.net,
                    vat: data.vat,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="rate" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                    <Legend />
                    <Bar dataKey="net" fill="oklch(0.45 0.15 250)" name="Net Amount" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vat" fill="oklch(0.55 0.20 250)" name="VAT Amount" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dutch VAT Rates Explanation</CardTitle>
              <CardDescription>Understanding VAT categories in the Netherlands</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <Badge className="mb-2">21% Standard Rate</Badge>
                  <h4 className="font-semibold text-sm mb-2">Algemeen tarief (BTW)</h4>
                  <p className="text-xs text-black">
                    Applied to most goods and services in the Netherlands. This is the default rate for B2B and B2C transactions.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <Badge variant="secondary" className="mb-2">9% Reduced Rate</Badge>
                  <h4 className="font-semibold text-sm mb-2">Verlaagd tarief (BTW)</h4>
                  <p className="text-xs text-black">
                    Applied to specific goods like food, books, medicines, passenger transport, and accommodation services.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <Badge variant="outline" className="mb-2">0% Zero Rate</Badge>
                  <h4 className="font-semibold text-sm mb-2">Reverse Charge / Export</h4>
                  <p className="text-xs text-black">
                    Used for exports outside EU, reverse charge B2B services within EU, or specific exempt services.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-white/95 backdrop-blur-md border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-black">
                  <Warning size={16} className="text-yellow-600" />
                  VAT Filing Requirements:
                </h4>
                <ul className="text-xs space-y-1 text-black">
                  <li>• Monthly filing if annual turnover {'>'} €1,883,000</li>
                  <li>• Quarterly filing for most ZZP/SME businesses</li>
                  <li>• Deadline: 1 month after end of period</li>
                  <li>• Small Business Exemption (KOR): Available if turnover {'<'} €25,000</li>
                  <li>• Keep VAT records for 7 years</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Clients by Revenue</CardTitle>
              <CardDescription>Top 10 clients contributing to {selectedYear} revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {report.topClients.length === 0 ? (
                <p className="text-center text-black py-8">{t('reports.noData')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Invoice Count</TableHead>
                      <TableHead className="text-right">Avg per Invoice</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topClients.map((client, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-bold text-black">#{index + 1}</TableCell>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(client.total, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{client.count}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(client.total / client.count, i18n.language)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {((client.total / report.totalGross) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Revenue Distribution</CardTitle>
              <CardDescription>Visual comparison of top client contributions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.topClients} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} fontSize={12} />
                    <Tooltip formatter={(value: number) => formatCurrency(value, i18n.language)} />
                    <Bar dataKey="total" fill="oklch(0.45 0.15 250)" name="Revenue" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


