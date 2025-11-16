import type { Employer, WeekbriefTemplate, WeekbriefColumn } from '../../../types/weekbrief';

// Manager System - Domyślny pracodawca
export const PEZET_EMPLOYER: Employer = {
  id: 'pezet-default',
  name: 'Manager System',
  logo: '/logo.png',
  contactInfo: {
    name: 'Manager System',
    address: 'Adres firmy',
    postalCode: '1234 AB',
    city: 'Amsterdam',
    country: 'Nederland',
    phone: '+31 6 12345678',
    email: 'info@messubouw.nl',
    website: 'www.messubouw.nl',
    kvkNumber: '12345678',
    btwNumber: 'NL123456789B01'
  },
  signatureSettings: {
    requireSignature: true,
    signaturePosition: 'bottom',
    signatureText: 'Paraf Uitvoerder'
  },
  defaultTemplate: 'pezet-weekbrief-template',
  createdAt: new Date(),
  updatedAt: new Date()
};

// PEZET - Kolumny z wzoru (dokładnie jak na obrazku)
const PEZET_COLUMNS: WeekbriefColumn[] = [
  {
    id: 'werknr',
    label: 'Werknr',
    type: 'text',
    width: '8%',
    required: false
  },
  {
    id: 'object',
    label: 'Object',
    type: 'text',
    width: '25%',
    required: false
  },
  {
    id: 'opdrachtgever',
    label: 'Opdrachtgever',
    type: 'text',
    width: '20%',
    required: false
  },
  {
    id: 'ma',
    label: 'Ma',
    type: 'number',
    width: '5.5%',
    required: false
  },
  {
    id: 'di',
    label: 'Di',
    type: 'number',
    width: '5.5%',
    required: false
  },
  {
    id: 'wo',
    label: 'Wo',
    type: 'number',
    width: '5.5%',
    required: false
  },
  {
    id: 'do',
    label: 'Do',
    type: 'number',
    width: '5.5%',
    required: false
  },
  {
    id: 'vr',
    label: 'Vr',
    type: 'number',
    width: '5.5%',
    required: false
  },
  {
    id: 'za',
    label: 'Za',
    type: 'number',
    width: '5.5%',
    required: false
  },
  {
    id: 'totaal',
    label: 'Totaal uren',
    type: 'number',
    width: '8%',
    required: false
  }
];

// Manager System - Szablon Weekbrief
export const PEZET_WEEKBRIEF_TEMPLATE: WeekbriefTemplate = {
  id: 'pezet-weekbrief-template',
  name: 'Manager System Weekbrief',
  employerId: 'pezet-default',
  isPublic: false,
  config: {
    size: 'A4',
    orientation: 'portrait',
    columns: PEZET_COLUMNS,
    rows: 20,
    showLogo: true,
    showHeader: true,
    headerFields: [
      {
        label: 'Naam',
        field: 'employeeName',
        required: true
      },
      {
        label: 'Weeknummer',
        field: 'weekNumber',
        required: true
      },
      {
        label: 'Van',
        field: 'weekStartDate',
        required: true
      }
    ],
    showTotalRow: true,
    totalRowLabel: 'Tot. uren',
    showSignature: true,
    signatureLabel: 'Paraf Uitvoerder',
    signatureRows: 1
  },
  styles: {
    headerColor: '#d9d9d9',
    borderColor: '#000000',
    fontSize: 9,
    fontFamily: 'Arial, Helvetica, sans-serif'
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

// Wszystkie domyślne szablony
export const DEFAULT_TEMPLATES: WeekbriefTemplate[] = [
  PEZET_WEEKBRIEF_TEMPLATE
];

// Wszystkie domyślni pracodawcy
export const DEFAULT_EMPLOYERS: Employer[] = [
  PEZET_EMPLOYER
];
