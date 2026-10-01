/**
 * Shared layout chrome for Reports & Analysis pages.
 * Tuned for phone, tablet, desktop, and browser zoom (`short:` = max-height 600px).
 */

export const reportPageRootClass = (embedded = false) =>
  embedded
    ? 'max-w-full overflow-x-clip p-2 short:p-1.5'
    : 'min-h-0 max-w-full overflow-x-clip bg-slate-50/70 p-2 sm:p-3 md:p-4 lg:p-6 short:p-2';

export const reportPageInnerClass =
  'mx-auto w-full max-w-[1600px] space-y-2 sm:space-y-3 short:space-y-2';

export const reportPageHeaderClass =
  'flex flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:justify-between';

export const reportPageEyebrowClass =
  'mb-1 hidden items-center gap-2 text-xs font-semibold text-blue-700 sm:flex short:hidden';

export const reportPageTitleClass =
  'min-w-0 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl md:text-3xl short:text-lg';

export const reportPageActionsClass =
  'flex max-w-full shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]';

export const reportFilterCardBodyClass = 'gap-2 p-2 sm:p-3 short:gap-1.5 short:p-2';

/** HeroUI Tabs classNames — category strip scrolls on narrow / zoomed screens. */
export const reportCategoryTabsClassNames = {
  base: 'w-full max-w-full',
  tabList:
    'gap-2 sm:gap-3 w-full max-w-full overflow-x-auto flex-nowrap [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5',
  cursor: 'w-full',
  tab: 'px-0 h-8 shrink-0 text-sm',
} as const;

/** Report picker + period: stack on phone, side-by-side from tablet up. */
export const reportSelectGridClass =
  'grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-[minmax(0,0.75fr)_minmax(0,2fr)]';

/** Full width on phone; ~75% of the picker column from md up. */
export const reportSelectClass = 'w-full max-w-full md:max-w-[75%]';

export const reportSummaryBodyClass =
  'overflow-x-auto px-2 py-1.5 sm:px-3 short:px-2 short:py-1';

export const reportSummaryRowClass =
  'flex min-w-max items-center gap-2 sm:gap-3';

export const reportPrintHeaderClass =
  'flex flex-col items-start gap-2 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4';

export const reportPrintBodyClass = 'p-3 sm:p-5 short:p-2';

export const reportDateInputClass = 'w-full min-w-0 sm:w-44';
