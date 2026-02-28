import PDFDocument from 'pdfkit';
import type { Ticket } from '@prisma/client';
import { centsToEuros } from '../lib/utils.js';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'CB',
  meal_voucher: 'Ticket Resto',
  check: 'Chèque',
};

interface TicketItem {
  name: string;
  qty: number;
  priceHt: number;
  vatRate: number;
  supplements?: { name: string; priceHt: number; qty: number }[];
}

interface VatDetail {
  rate: number;
  baseHt: number;
  amount: number;
}

interface PaymentDetail {
  method: string;
  amount: number;
}

interface TenantInfo {
  name: string;
  address: string;
  siret: string;
  vatNumber: string | null;
  phone: string | null;
}

function computeTtcCents(amountHt: number, vatRate: number): number {
  return Math.round(amountHt * (1 + vatRate / 100));
}

function fmt(cents: number): string {
  return `${centsToEuros(cents)} EUR`;
}

/**
 * Génère un PDF ticket client au format 80mm (226 pts).
 */
export async function generateClientPdf(ticket: Ticket, tenant: TenantInfo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pageWidth = 226; // ~80mm
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    const doc = new PDFDocument({
      size: [pageWidth, 800],
      margins: { top: 10, bottom: 10, left: margin, right: margin },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const font = 'Courier';
    const fontBold = 'Courier-Bold';

    // --- En-tête commerce ---
    doc.font(fontBold).fontSize(11).text(tenant.name, { align: 'center' });
    doc.font(font).fontSize(7).text(tenant.address, { align: 'center' });
    doc.text(`SIRET: ${tenant.siret}`, { align: 'center' });
    if (tenant.vatNumber) {
      doc.text(`TVA: ${tenant.vatNumber}`, { align: 'center' });
    }
    if (tenant.phone) {
      doc.text(`Tél: ${tenant.phone}`, { align: 'center' });
    }

    doc.moveDown(0.3);
    doc.text('-'.repeat(Math.floor(contentWidth / 4)), { align: 'center' });
    doc.moveDown(0.3);

    // --- Info ticket ---
    const date = new Date(ticket.createdAt);
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    doc.font(fontBold).fontSize(9).text(`Ticket #${ticket.sequenceNumber}`, { align: 'center' });
    doc.font(font).fontSize(7);
    doc.text(`${dateStr} ${timeStr}`, { align: 'center' });
    doc.text(
      ticket.serviceMode === 'ONSITE' ? 'Sur place' : 'À emporter',
      { align: 'center' },
    );

    if (ticket.isExpenseNote) {
      doc.moveDown(0.2);
      doc.font(fontBold).fontSize(8).text('*** NOTE DE FRAIS ***', { align: 'center' });
    }

    doc.moveDown(0.3);
    doc.font(font).fontSize(7).text('-'.repeat(Math.floor(contentWidth / 4)), { align: 'center' });
    doc.moveDown(0.3);

    // --- Articles ---
    const items = ticket.items as unknown as TicketItem[];

    if (!ticket.isExpenseNote) {
      doc.font(font).fontSize(7);

      for (const item of items) {
        const supplementsHt = (item.supplements ?? []).reduce(
          (s, sup) => s + sup.priceHt * sup.qty,
          0,
        );
        const lineHt = (item.priceHt + supplementsHt) * item.qty;
        const lineTtc = computeTtcCents(lineHt, item.vatRate);

        doc.font(fontBold).text(
          `${item.qty}x ${item.name}`,
          margin,
          undefined,
          { continued: true, width: contentWidth - 50 },
        );
        doc.font(font).text(fmt(lineTtc), { align: 'right' });

        if (item.supplements && item.supplements.length > 0) {
          for (const sup of item.supplements) {
            const supTtc = computeTtcCents(sup.priceHt * sup.qty, item.vatRate);
            const supLabel = sup.priceHt > 0
              ? `  + ${sup.name}${sup.qty > 1 ? ` x${sup.qty}` : ''} (+${fmt(supTtc)})`
              : `  + ${sup.name}${sup.qty > 1 ? ` x${sup.qty}` : ''}`;
            doc.font(font).fontSize(6).text(supLabel);
            doc.fontSize(7);
          }
        }
      }

      doc.moveDown(0.3);
      doc.text('-'.repeat(Math.floor(contentWidth / 4)), { align: 'center' });
      doc.moveDown(0.3);
    }

    // --- Totaux ---
    doc.font(font).fontSize(7);
    doc.text(`Total HT:`, margin, undefined, { continued: true, width: contentWidth - 50 });
    doc.text(fmt(ticket.totalHt), { align: 'right' });

    const vatDetails = ticket.vatDetails as unknown as VatDetail[];
    for (const vat of vatDetails) {
      doc.text(`TVA ${vat.rate}%:`, margin, undefined, { continued: true, width: contentWidth - 50 });
      doc.text(fmt(vat.amount), { align: 'right' });
    }

    doc.moveDown(0.2);
    doc.font(fontBold).fontSize(10);
    doc.text(`TOTAL TTC:`, margin, undefined, { continued: true, width: contentWidth - 60 });
    doc.text(fmt(ticket.totalTtc), { align: 'right' });
    doc.moveDown(0.3);

    // --- Paiements ---
    doc.font(font).fontSize(7);
    const payments = ticket.payments as unknown as PaymentDetail[];
    for (const pay of payments) {
      const label = PAYMENT_LABELS[pay.method] ?? pay.method;
      doc.text(`${label}:`, margin, undefined, { continued: true, width: contentWidth - 50 });
      doc.text(fmt(pay.amount), { align: 'right' });
    }

    // Rendu monnaie
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const cashPay = payments.find((p) => p.method === 'cash');
    if (cashPay && totalPaid > ticket.totalTtc) {
      doc.text(`Rendu:`, margin, undefined, { continued: true, width: contentWidth - 50 });
      doc.text(fmt(totalPaid - ticket.totalTtc), { align: 'right' });
    }

    // --- Pied de page ---
    doc.moveDown(0.5);
    doc.font(font).fontSize(6).text('-'.repeat(Math.floor(contentWidth / 3)), { align: 'center' });
    doc.moveDown(0.2);
    doc.text(`Hash: ${ticket.hash.substring(0, 8)}`, { align: 'center' });
    doc.text('Merci de votre visite !', { align: 'center' });

    doc.end();
  });
}

/**
 * Génère un PDF ticket cuisine (gros caractères, pas de prix).
 */
export async function generateKitchenPdf(ticket: Ticket): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pageWidth = 226;
    const margin = 10;

    const doc = new PDFDocument({
      size: [pageWidth, 800],
      margins: { top: 10, bottom: 10, left: margin, right: margin },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const font = 'Courier';
    const fontBold = 'Courier-Bold';

    // --- GROS numéro de commande ---
    doc.font(fontBold).fontSize(8).text('CUISINE', { align: 'center' });
    doc.moveDown(0.2);
    doc.font(fontBold).fontSize(24).text(`#${ticket.sequenceNumber}`, { align: 'center' });
    doc.moveDown(0.2);

    // Mode
    doc.font(font).fontSize(10).text(
      ticket.serviceMode === 'ONSITE' ? '*** SUR PLACE ***' : '*** A EMPORTER ***',
      { align: 'center' },
    );

    doc.moveDown(0.3);
    doc.font(font).fontSize(7).text('='.repeat(30), { align: 'center' });
    doc.moveDown(0.3);

    // --- Articles ---
    const items = ticket.items as unknown as TicketItem[];

    for (const item of items) {
      doc.font(fontBold).fontSize(12).text(`${item.qty}x ${item.name}`);

      if (item.supplements && item.supplements.length > 0) {
        for (const sup of item.supplements) {
          doc.font(font).fontSize(10).text(
            `  + ${sup.name}${sup.qty > 1 ? ` x${sup.qty}` : ''}`,
          );
        }
      }
      doc.moveDown(0.2);
    }

    // --- Heure ---
    doc.moveDown(0.5);
    doc.font(font).fontSize(7).text('='.repeat(30), { align: 'center' });
    const date = new Date(ticket.createdAt);
    doc.fontSize(8).text(
      date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      { align: 'center' },
    );

    doc.end();
  });
}
