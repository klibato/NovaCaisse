// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: new Uint8Array([ESC, 0x40]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  SIZE_NORMAL: new Uint8Array([GS, 0x21, 0x00]),
  SIZE_DOUBLE_HEIGHT: new Uint8Array([GS, 0x21, 0x01]),
  SIZE_DOUBLE_WIDTH: new Uint8Array([GS, 0x21, 0x10]),
  SIZE_DOUBLE: new Uint8Array([GS, 0x21, 0x11]),
  CUT: new Uint8Array([GS, 0x56, 0x00]),
  PARTIAL_CUT: new Uint8Array([GS, 0x56, 0x01]),
  FEED_AND_CUT: new Uint8Array([ESC, 0x64, 0x04, GS, 0x56, 0x01]),
  LINE_FEED: new Uint8Array([LF]),
};

const LINE_WIDTH = 32;

function textToBytes(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function padLine(left: string, right: string, width = LINE_WIDTH): string {
  const space = width - left.length - right.length;
  if (space <= 0) return left + ' ' + right;
  return left + ' '.repeat(space) + right;
}

function separator(char = '-', width = LINE_WIDTH): string {
  return char.repeat(width);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2) + ' EUR';
}

interface TicketItemOption {
  groupName: string;
  choiceName: string;
  priceHt: number;
}

interface TicketItem {
  name: string;
  qty: number;
  priceHt: number;
  vatRate: number;
  supplements?: { name: string; priceHt: number; qty: number }[];
  options?: TicketItemOption[];
  menuName?: string;
}

interface TicketData {
  sequenceNumber: number;
  serviceMode: string;
  items: TicketItem[];
  totalHt: number;
  totalTtc: number;
  vatDetails: { rate: number; baseHt: number; amount: number }[];
  payments: { method: string; amount: number }[];
  isExpenseNote: boolean;
  createdAt: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Especes',
  card: 'CB',
  meal_voucher: 'Ticket Resto',
  check: 'Cheque',
};

export function buildClientTicket(ticket: TicketData, shopName = 'NovaCaisse'): Uint8Array {
  const parts: Uint8Array[] = [];
  const line = (text: string) => parts.push(textToBytes(text + '\n'));

  parts.push(CMD.INIT);

  // Header
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.BOLD_ON);
  parts.push(CMD.SIZE_DOUBLE);
  line(shopName);
  parts.push(CMD.SIZE_NORMAL);
  parts.push(CMD.BOLD_OFF);
  line('');

  // Ticket info
  line(`Ticket #${ticket.sequenceNumber}`);
  line(ticket.serviceMode === 'ONSITE' ? 'Sur place' : 'A emporter');
  line(new Date(ticket.createdAt).toLocaleString('fr-FR'));
  if (ticket.isExpenseNote) {
    line('** NOTE DE FRAIS **');
  }

  parts.push(CMD.ALIGN_LEFT);
  line(separator());

  // Items (skip detail if expense note)
  if (!ticket.isExpenseNote) {
    let i = 0;
    while (i < ticket.items.length) {
      const item = ticket.items[i];

      if (item.menuName) {
        // Group consecutive menu items
        const menuItems: TicketItem[] = [item];
        while (i + 1 < ticket.items.length && ticket.items[i + 1].menuName === item.menuName && ticket.items[i + 1].qty === item.qty) {
          i++;
          menuItems.push(ticket.items[i]);
        }

        // Total TTC for menu group (per-item vatRate)
        let menuTtc = 0;
        for (const mi of menuItems) {
          const optHt = (mi.options ?? []).reduce((s, o) => s + o.priceHt, 0);
          menuTtc += Math.round((mi.priceHt + optHt) * mi.qty * (1 + mi.vatRate / 100));
        }

        line(padLine(`${item.qty}x ${item.menuName}`, formatCents(menuTtc)));
        for (const mi of menuItems) {
          line(`  - ${mi.name}`);
          if (mi.options) {
            for (const opt of mi.options) {
              if (opt.priceHt > 0) {
                const optTtc = Math.round(opt.priceHt * (1 + mi.vatRate / 100));
                line(padLine(`    > ${opt.choiceName}`, formatCents(optTtc)));
              } else {
                line(`    > ${opt.choiceName}`);
              }
            }
          }
        }
      } else {
        const itemTtc = Math.round(item.priceHt * item.qty * (1 + item.vatRate / 100));
        line(padLine(`${item.qty}x ${item.name}`, formatCents(itemTtc)));
        if (item.options) {
          for (const opt of item.options) {
            if (opt.priceHt > 0) {
              const optTtc = Math.round(opt.priceHt * (1 + item.vatRate / 100));
              line(padLine(`  > ${opt.choiceName}`, formatCents(optTtc)));
            } else {
              line(`  > ${opt.choiceName}`);
            }
          }
        }
        if (item.supplements) {
          for (const sup of item.supplements) {
            const supTtc = Math.round(sup.priceHt * sup.qty * (1 + item.vatRate / 100));
            line(padLine(`  + ${sup.name} x${sup.qty}`, formatCents(supTtc)));
          }
        }
      }
      i++;
    }
    line(separator());
  }

  // Totals
  parts.push(CMD.BOLD_ON);
  line(padLine('TOTAL TTC', formatCents(ticket.totalTtc)));
  parts.push(CMD.BOLD_OFF);

  // VAT details
  line(separator('-'));
  for (const vat of ticket.vatDetails) {
    line(padLine(`TVA ${vat.rate}%`, formatCents(vat.amount)));
  }

  // Payments
  line(separator('-'));
  for (const p of ticket.payments) {
    line(padLine(PAYMENT_LABELS[p.method] || p.method, formatCents(p.amount)));
  }

  // Footer
  parts.push(CMD.ALIGN_CENTER);
  line('');
  line('Merci de votre visite !');
  line('');

  parts.push(CMD.FEED_AND_CUT);

  return concat(...parts);
}

export function buildKitchenTicket(
  ticket: { sequenceNumber: number; items: TicketItem[]; createdAt: string },
): Uint8Array {
  const parts: Uint8Array[] = [];
  const line = (text: string) => parts.push(textToBytes(text + '\n'));

  parts.push(CMD.INIT);

  // Header
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.BOLD_ON);
  parts.push(CMD.SIZE_DOUBLE);
  line(`CMD #${ticket.sequenceNumber}`);
  parts.push(CMD.SIZE_NORMAL);
  parts.push(CMD.BOLD_OFF);
  line(new Date(ticket.createdAt).toLocaleString('fr-FR'));

  parts.push(CMD.ALIGN_LEFT);
  line(separator('='));

  // Items — big, no prices
  let idx = 0;
  while (idx < ticket.items.length) {
    const item = ticket.items[idx];

    if (item.menuName) {
      // Group consecutive menu items
      const menuItems: TicketItem[] = [item];
      while (idx + 1 < ticket.items.length && ticket.items[idx + 1].menuName === item.menuName && ticket.items[idx + 1].qty === item.qty) {
        idx++;
        menuItems.push(ticket.items[idx]);
      }

      parts.push(CMD.SIZE_DOUBLE_HEIGHT);
      parts.push(CMD.BOLD_ON);
      line(`${item.qty}x ${item.menuName}`);
      parts.push(CMD.SIZE_NORMAL);
      parts.push(CMD.BOLD_OFF);
      for (const mi of menuItems) {
        line(`  - ${mi.name}`);
        if (mi.options) {
          for (const opt of mi.options) {
            parts.push(CMD.SIZE_DOUBLE_HEIGHT);
            line(`    > ${opt.choiceName.toUpperCase()}`);
            parts.push(CMD.SIZE_NORMAL);
          }
        }
      }
    } else {
      parts.push(CMD.SIZE_DOUBLE_HEIGHT);
      parts.push(CMD.BOLD_ON);
      line(`${item.qty}x ${item.name}`);
      parts.push(CMD.SIZE_NORMAL);
      parts.push(CMD.BOLD_OFF);
      if (item.options) {
        for (const opt of item.options) {
          parts.push(CMD.SIZE_DOUBLE_HEIGHT);
          line(`   > ${opt.choiceName.toUpperCase()}`);
          parts.push(CMD.SIZE_NORMAL);
        }
      }
      if (item.supplements) {
        for (const sup of item.supplements) {
          line(`   + ${sup.name} x${sup.qty}`);
        }
      }
    }
    idx++;
  }

  line(separator('='));
  line('');

  parts.push(CMD.FEED_AND_CUT);

  return concat(...parts);
}
