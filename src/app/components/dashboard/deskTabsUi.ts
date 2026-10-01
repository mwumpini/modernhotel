'use client';

/** Shared ops tabs — solid pill strip (Kitchen / Front Office standard). */
export const deskBookTabsClassNames = {
  tabList:
    'gap-2 p-1 h-fit max-w-full bg-default-100 rounded-medium overflow-x-auto flex-nowrap scrollbar-thin [scrollbar-width:thin] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:h-1.5',
  tab: 'px-3 min-w-fit text-sm h-10 md:h-9',
  tabContent: 'text-sm text-default-600 group-data-[selected=true]:text-foreground group-data-[selected=true]:font-semibold',
  cursor: 'bg-white shadow-sm rounded-md',
  panel: 'p-0',
} as const;

export const deskBookTabPanelClassName = 'mt-2 px-2 pb-2 md:px-3';
