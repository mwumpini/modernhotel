/** Cash leaving the till. Each code is a postable expense leaf, not a header. */
export const PETTY_EXPENSES = [
  { code: '5620', name: 'Travelling and Transport' },
  { code: '5645', name: 'Printing and Stationery' },
  { code: '5670', name: 'Cleaning and Sanitation' },
  { code: '5420', name: 'Vehicle Running Expenses' },
  { code: '5410', name: 'Repairs - Equipment' },
  { code: '5315', name: 'Generator Fuel and Repairs' },
  { code: '5680', name: 'Miscellaneous Expenses' },
] as const

export function pettyExpenseName(code: string): string | undefined {
  return PETTY_EXPENSES.find((row) => row.code === code)?.name
}
