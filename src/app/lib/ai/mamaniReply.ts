import { isHelpQuestion } from './helpSearch';

type Rooms = { total: number; occupied: number; vacant: number; dirty: number; clean: number; maintenance: number };
type Stays = { inHouse: number; arriving: number };
type Stock = { items: number; low: number; out: number; names: string[] };
type Staff = { active: number; leave: number };
type Invoices = { sales: number; bills: number };

type Facts = {
  rooms?: Rooms;
  stays?: Stays;
  stock?: Stock;
  staff?: Staff;
  payrollOpen?: number;
  invoices?: Invoices;
  ordersOpen?: number;
  onDuty?: number;
  patrols?: number;
  incidents?: number;
  extra: string[];
};

function be(n: number) {
  return n === 1 ? 'is' : 'are';
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function list(names: string[]) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A how-to stays in Help. A count, status, or summary uses the desk numbers. */
function asksForLiveStatus(prompt: string): boolean {
  if (/\bhow\s+(many|much)\b/i.test(prompt)) return true;
  if (/\b(summarize|summary|status|overview|briefing|how are we)\b/i.test(prompt)) return true;
  if (/\b(how do|how to|where|steps|show me|can i|can't|cannot)\b/i.test(prompt)) return false;
  return /\b(occup\w*|vacan\w*|dirty|clean rooms|arriv\w*|checked in|out of stock|reorder\w*|on leave|on duty|incidents?|notices?)\b/i.test(prompt);
}

function parseSnapshot(lines: string[]): Facts {
  const facts: Facts = { extra: [] };
  for (const line of lines) {
    const rooms = line.match(/^(\d+) rooms: (\d+) occupied, (\d+) vacant, (\d+) dirty, (\d+) clean, (\d+) maintenance\./);
    if (rooms) {
      facts.rooms = {
        total: Number(rooms[1]),
        occupied: Number(rooms[2]),
        vacant: Number(rooms[3]),
        dirty: Number(rooms[4]),
        clean: Number(rooms[5]),
        maintenance: Number(rooms[6]),
      };
      continue;
    }
    const stays = line.match(/^(\d+) checked in, (\d+) arriving today\./);
    if (stays) {
      facts.stays = { inHouse: Number(stays[1]), arriving: Number(stays[2]) };
      continue;
    }
    const stock = line.match(/^(\d+) stock items, (\d+) at or below reorder, (\d+) out of stock(?: \((.+)\))?\./);
    if (stock) {
      facts.stock = {
        items: Number(stock[1]),
        low: Number(stock[2]),
        out: Number(stock[3]),
        names: stock[4] ? stock[4].split(', ').filter(Boolean) : [],
      };
      continue;
    }
    const staff = line.match(/^(\d+) active employees, (\d+) on leave\./);
    if (staff) {
      facts.staff = { active: Number(staff[1]), leave: Number(staff[2]) };
      continue;
    }
    const payroll = line.match(/^(\d+) payroll periods still draft or processing\./);
    if (payroll) {
      facts.payrollOpen = Number(payroll[1]);
      continue;
    }
    const invoices = line.match(/^(\d+) open sales invoices, (\d+) open supplier bills\./);
    if (invoices) {
      facts.invoices = { sales: Number(invoices[1]), bills: Number(invoices[2]) };
      continue;
    }
    const orders = line.match(/^(\d+) open restaurant orders\./);
    if (orders) {
      facts.ordersOpen = Number(orders[1]);
      continue;
    }
    const duty = line.match(/^(\d+) security staff on duty\./);
    if (duty) {
      facts.onDuty = Number(duty[1]);
      continue;
    }
    const patrols = line.match(/^(\d+) patrols active\./);
    if (patrols) {
      facts.patrols = Number(patrols[1]);
      continue;
    }
    const incidents = line.match(/^(\d+) incidents still open\./);
    if (incidents) {
      facts.incidents = Number(incidents[1]);
      continue;
    }
    const text = line.replace(/\.$/, '').trim();
    if (text) facts.extra.push(text);
  }
  return facts;
}

function aside(rooms: Rooms, skip: keyof Rooms): string {
  const bits: string[] = [];
  const add = (key: keyof Rooms, word: string) => {
    if (key === skip || key === 'total' || rooms[key] === 0) return;
    bits.push(`${rooms[key]} ${be(rooms[key])} ${word}`);
  };
  add('occupied', 'occupied');
  add('vacant', 'vacant');
  add('dirty', 'dirty');
  add('clean', 'clean');
  add('maintenance', 'in maintenance');
  if (!bits.length) return '';
  const text = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
  return ` Also ${text}.`;
}

function roomAnswer(prompt: string, rooms: Rooms): string {
  const lead = (n: number, word: string, skip: keyof Rooms) => (
    n === 0
      ? `No rooms are ${word}.${aside(rooms, skip)}`
      : `${n} of ${rooms.total} rooms ${be(n)} ${word}.${aside(rooms, skip)}`
  );
  if (/\bdirty\b/i.test(prompt)) return lead(rooms.dirty, 'dirty', 'dirty');
  if (/\bvacan\w*/i.test(prompt)) return lead(rooms.vacant, 'vacant', 'vacant');
  if (/\boccup/i.test(prompt)) return lead(rooms.occupied, 'occupied', 'occupied');
  if (/\bclean\b/i.test(prompt) && !/\bhousekeep/i.test(prompt)) return lead(rooms.clean, 'clean', 'clean');
  if (/\bmaint\w*/i.test(prompt)) return lead(rooms.maintenance, 'in maintenance', 'maintenance');
  const listed = ['occupied', 'vacant', 'dirty', 'clean', 'in maintenance']
    .map((word, i) => {
      const key = (['occupied', 'vacant', 'dirty', 'clean', 'maintenance'] as const)[i];
      return rooms[key] > 0 ? `${rooms[key]} ${word}` : '';
    })
    .filter(Boolean);
  const body = listed.length ? listed.join(', ').replace(/, ([^,]*)$/, ', and $1') : 'none are occupied or dirty';
  return `There are ${rooms.total} rooms: ${body}.`;
}

function stayAnswer(stays: Stays): string {
  const inHouse = stays.inHouse === 0
    ? 'Nobody is checked in'
    : `${count(stays.inHouse, 'guest')} ${be(stays.inHouse)} checked in`;
  const arriving = stays.arriving === 0
    ? 'nobody is arriving today'
    : `${count(stays.arriving, 'guest')} ${be(stays.arriving)} arriving today`;
  return `${inHouse}, and ${arriving}.`;
}

function stockAnswer(prompt: string, stock: Stock): string {
  const names = stock.names.length ? ` Those include ${list(stock.names)}.` : '';
  if (/\bout of stock\b/i.test(prompt)) {
    return stock.out === 0
      ? `Nothing is out of stock. ${count(stock.low, 'item')} ${be(stock.low)} at or below reorder.`
      : `${count(stock.out, 'item')} ${be(stock.out)} out of stock.${names} ${count(stock.low, 'item')} ${be(stock.low)} at or below reorder.`;
  }
  if (/\b(reorder|low)\b/i.test(prompt)) {
    return stock.low === 0
      ? `Nothing is at reorder level. ${count(stock.out, 'item')} ${be(stock.out)} out of stock.`
      : `${count(stock.low, 'item')} ${be(stock.low)} at or below reorder, and ${count(stock.out, 'item')} ${be(stock.out)} out of stock.${names}`;
  }
  return `There are ${stock.items} stock items. ${count(stock.low, 'item')} ${be(stock.low)} at or below reorder and ${count(stock.out, 'item')} ${be(stock.out)} out of stock.${names}`;
}

function staffAnswer(staff: Staff): string {
  const leave = staff.leave === 0 ? 'nobody is on leave' : `${count(staff.leave, 'employee')} ${be(staff.leave)} on leave`;
  return `${count(staff.active, 'employee')} ${be(staff.active)} active, and ${leave}.`;
}

function securityAnswer(facts: Facts): string {
  const parts: string[] = [];
  if (facts.onDuty !== undefined) {
    parts.push(facts.onDuty === 0 ? 'Nobody from security is on duty.' : `${count(facts.onDuty, 'security officer')} ${be(facts.onDuty)} on duty.`);
  }
  if (facts.patrols !== undefined) {
    parts.push(facts.patrols === 0 ? 'No patrol is active.' : `${count(facts.patrols, 'patrol')} ${be(facts.patrols)} active.`);
  }
  if (facts.incidents !== undefined) {
    parts.push(facts.incidents === 0 ? 'No incidents are still open.' : `${count(facts.incidents, 'incident')} ${be(facts.incidents)} still open.`);
  }
  return parts.join(' ');
}

function noticeAnswer(notices: string[]): string {
  if (!notices.length) return 'There are no notices on this desk.';
  const lines = notices.map((notice) => {
    const match = notice.match(/^(info|normal|urgent):\s*(.*)$/i);
    if (!match) return notice;
    const level = match[1].toLowerCase();
    return `${level.charAt(0).toUpperCase()}${level.slice(1)} — ${match[2]}`;
  });
  if (lines.length === 1) return `The latest notice is ${lines[0]}.`;
  return `There are ${lines.length} recent notices.\n${lines.map((line) => `• ${line}`).join('\n')}`;
}

function briefing(facts: Facts, label: string): string {
  const parts: string[] = [];
  if (facts.rooms) parts.push(roomAnswer('', facts.rooms));
  if (facts.stays) parts.push(stayAnswer(facts.stays));
  if (facts.stock && (facts.stock.out > 0 || facts.stock.low > 0)) parts.push(stockAnswer('', facts.stock));
  if (facts.staff) parts.push(staffAnswer(facts.staff));
  if (facts.payrollOpen !== undefined && facts.payrollOpen > 0) {
    parts.push(`${count(facts.payrollOpen, 'payroll period')} ${be(facts.payrollOpen)} still draft or processing.`);
  }
  if (facts.invoices) {
    parts.push(`${count(facts.invoices.sales, 'sales invoice')} ${be(facts.invoices.sales)} still open, and ${count(facts.invoices.bills, 'supplier bill')} ${be(facts.invoices.bills)} unpaid.`);
  }
  if (facts.ordersOpen !== undefined) {
    parts.push(facts.ordersOpen === 0 ? 'No restaurant orders are open.' : `${count(facts.ordersOpen, 'restaurant order')} ${be(facts.ordersOpen)} open.`);
  }
  const security = securityAnswer(facts);
  if (security) parts.push(security);
  if (!parts.length && facts.extra.length) parts.push(facts.extra.join('. ') + '.');
  if (!parts.length) return `Live counts are not loaded on the ${label} desk yet. I can still draft a notice for you to send.`;
  return parts.join(' ');
}

function draftNotice(prompt: string, facts: Facts, notices: string[]): string {
  const lines: string[] = [];
  if (/\b(arriv\w*|front office|frontdesk)\b/i.test(prompt) && facts.stays) {
    lines.push(facts.stays.arriving === 0
      ? 'Front office: no arrivals are booked today.'
      : `Front office: ${count(facts.stays.arriving, 'guest')} ${be(facts.stays.arriving)} arriving today.`);
    lines.push(`${count(facts.stays.inHouse, 'guest')} ${be(facts.stays.inHouse)} already checked in.`);
  } else if (/\b(clean\w*|dirty|housekeep\w*|maint\w*|rooms?)\b/i.test(prompt) && facts.rooms) {
    lines.push(facts.rooms.dirty === 0
      ? 'Housekeeping: no rooms are waiting on a clean.'
      : `Housekeeping: ${count(facts.rooms.dirty, 'room')} still ${facts.rooms.dirty === 1 ? 'needs' : 'need'} cleaning.`);
    if (facts.rooms.maintenance > 0) lines.push(`${count(facts.rooms.maintenance, 'room')} ${be(facts.rooms.maintenance)} in maintenance.`);
  } else if (/\b(stock\w*|inventor\w*|reorder\w*|low)\b/i.test(prompt) && facts.stock) {
    const names = facts.stock.names.length ? ` (${list(facts.stock.names)})` : '';
    lines.push(`Stores: ${count(facts.stock.out, 'item')} ${be(facts.stock.out)} out of stock${names}. ${count(facts.stock.low, 'item')} ${be(facts.stock.low)} at or below reorder.`);
  } else if (/\b(payroll\w*|leave|staff|employees?)\b/i.test(prompt) && (facts.staff || facts.payrollOpen !== undefined)) {
    if (facts.staff) lines.push(`HR: ${staffAnswer(facts.staff)}`);
    if (facts.payrollOpen !== undefined) {
      lines.push(facts.payrollOpen === 0
        ? 'No payroll period is waiting.'
        : `${count(facts.payrollOpen, 'payroll period')} still need attention.`);
    }
  } else if (/\b(incidents?|security|duty|patrols?)\b/i.test(prompt)) {
    lines.push(`Security: ${securityAnswer(facts) || 'no duty or incident totals are loaded.'}`);
  } else if (/\b(kitchens?|orders?|restaurants?)\b/i.test(prompt) && facts.ordersOpen !== undefined) {
    lines.push(facts.ordersOpen === 0
      ? 'Kitchen: no restaurant orders are open.'
      : `Kitchen: ${count(facts.ordersOpen, 'order')} ${be(facts.ordersOpen)} still open.`);
  } else if (/\b(invoices?|bills?|end-of-day|accounting)\b/i.test(prompt) && facts.invoices) {
    lines.push(`Accounts: ${count(facts.invoices.sales, 'sales invoice')} open and ${count(facts.invoices.bills, 'supplier bill')} unpaid.`);
  } else {
    lines.push(briefing(facts, 'hotel'));
    if (notices[0]) lines.push(`Latest notice: ${notices[0]}.`);
  }
  return `${lines.join(' ')}\n\nYou still send this from Messenger. I do not post it.`;
}

function answerFromFacts(prompt: string, facts: Facts, notices: string[], label: string): string {
  const parts: string[] = [];
  if (/\b(rooms?|dirty|clean\w*|occup\w*|vacan\w*|housekeep\w*|maint\w*)\b/i.test(prompt) && facts.rooms) {
    parts.push(roomAnswer(prompt, facts.rooms));
  }
  if (/\b(arriv\w*|checked in|check-ins?|guests?|reservations?|in-house|in house)\b/i.test(prompt) && facts.stays) {
    parts.push(stayAnswer(facts.stays));
  }
  if (/\b(stock\w*|inventor\w*|reorder\w*)\b/i.test(prompt) && facts.stock) {
    parts.push(stockAnswer(prompt, facts.stock));
  }
  if (/\b(staff|employees?|leave|payroll\w*)\b/i.test(prompt)) {
    if (facts.staff) parts.push(staffAnswer(facts.staff));
    if (facts.payrollOpen !== undefined) {
      parts.push(facts.payrollOpen === 0
        ? 'No payroll period is still draft or processing.'
        : `${count(facts.payrollOpen, 'payroll period')} ${be(facts.payrollOpen)} still draft or processing.`);
    }
  }
  if (/\b(security|incidents?|patrols?|duty)\b/i.test(prompt)) {
    const security = securityAnswer(facts);
    if (security) parts.push(security);
  }
  if (/\b(orders?|restaurants?|kitchens?|bar)\b/i.test(prompt) && facts.ordersOpen !== undefined) {
    parts.push(facts.ordersOpen === 0
      ? 'No restaurant orders are open.'
      : `${count(facts.ordersOpen, 'restaurant order')} ${be(facts.ordersOpen)} open.`);
  }
  if (/\b(invoices?|bills?)\b/i.test(prompt) && facts.invoices) {
    parts.push(`${count(facts.invoices.sales, 'sales invoice')} ${be(facts.invoices.sales)} still open, and ${count(facts.invoices.bills, 'supplier bill')} ${be(facts.invoices.bills)} unpaid.`);
  }
  if (/\bnotices?\b/i.test(prompt)) parts.push(noticeAnswer(notices));
  if (parts.length) return parts.join('\n\n');
  if (/\b(summarize|summary|status|overview|briefing|how are we)\b/i.test(prompt)) {
    const summary = briefing(facts, label);
    return notices.length ? `${summary}\n\n${noticeAnswer(notices)}` : summary;
  }
  return `I can answer from this desk's counts and notices.\n\n${briefing(facts, label)}`;
}

/** Short reply used when the model is unavailable. Uses only the brief already built on the desk. */
export function localMamaniReply(
  prompt: string,
  brief: { label: string; snapshot: string[]; notices: string[]; help?: string[] },
): string {
  const drafting = /^\s*draft\b/i.test(prompt) || /\breminder\b/i.test(prompt);
  if (!drafting && isHelpQuestion(prompt) && !asksForLiveStatus(prompt)) {
    if (brief.help?.length) return brief.help.join('\n\n');
    return 'I do not have a help topic for that. Open Full Help for the rest of the screens.';
  }
  const text = prompt.trim();
  const facts = parseSnapshot(brief.snapshot);
  if (/^(thanks|thank you|ok|okay)\b/i.test(text)) {
    return 'Glad to help. Ask for rooms, stock, notices, or a draft whenever you need it.';
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(text) && text.length < 48 && !drafting) {
    const highlight = facts.rooms
      ? facts.rooms.dirty > 0
        ? ` ${count(facts.rooms.dirty, 'room')} ${be(facts.rooms.dirty)} dirty right now.`
        : ` ${count(facts.rooms.occupied, 'room')} ${be(facts.rooms.occupied)} occupied right now.`
      : '';
    return `I'm here on the ${brief.label} desk.${highlight} Ask for a count, today's notices, or a draft you can send.`;
  }
  if (drafting) return draftNotice(text, facts, brief.notices);
  return answerFromFacts(text, facts, brief.notices, brief.label);
}
