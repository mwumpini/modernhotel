const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion'];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const tens = TENS[Math.floor(n / 10)];
    const rest = n % 10;
    parts.push(rest ? `${tens}-${ONES[rest]}` : tens);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  const groups: string[] = [];
  let scaleIndex = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      groups.unshift(`${threeDigitsToWords(chunk)}${SCALES[scaleIndex] ? ' ' + SCALES[scaleIndex] : ''}`);
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }
  return groups.join(' ');
}

/** "Ghana Cedis Five Hundred and Ninety-Six and Twenty-Five Pesewas Only" style. */
export function amountInWords(amount: number, currencyName = 'Ghana Cedis', minorUnitName = 'Pesewas'): string {
  const value = Math.abs(amount);
  const whole = Math.floor(value);
  const minor = Math.round((value - whole) * 100);
  const wholeWords = `${currencyName} ${integerToWords(whole)}`;
  const minorWords = minor > 0 ? ` and ${integerToWords(minor)} ${minorUnitName}` : '';
  return `${wholeWords}${minorWords} Only`;
}
