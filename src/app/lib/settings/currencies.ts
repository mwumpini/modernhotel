import { useSettingsStore } from './store';

/** A currency the hotel can take. The books stay in cedis; `rate` is cedis for 1 unit. */
export type HotelCurrency = {
	code: string;
	/** Printed in amount in words, such as "Ghana Cedis" or "US dollar". */
	majorName: string;
	/** The hundredth, such as "Pesewas" or "cents". */
	minorName: string;
	rate: number;
	bankAccountId?: string;
	cashAccountId?: string;
};

export const HOME_CURRENCY_CODE = 'GHS';

export const HOME_CURRENCY: HotelCurrency = {
	code: HOME_CURRENCY_CODE,
	majorName: 'Ghana Cedis',
	minorName: 'Pesewas',
	rate: 1,
};

export function listCurrencies(currencies?: HotelCurrency[] | null): HotelCurrency[] {
	const rows = Array.isArray(currencies) ? currencies.filter((c) => c?.code) : [];
	const home = rows.find((c) => c.code.toUpperCase() === HOME_CURRENCY_CODE);
	const rest = rows
		.filter((c) => c.code.toUpperCase() !== HOME_CURRENCY_CODE)
		.map((c) => ({ ...c, code: c.code.toUpperCase() }));
	return [
		{
			...HOME_CURRENCY,
			...home,
			code: HOME_CURRENCY_CODE,
			rate: 1,
			majorName: home?.majorName?.trim() || HOME_CURRENCY.majorName,
			minorName: home?.minorName?.trim() || HOME_CURRENCY.minorName,
		},
		...rest,
	];
}

export function workingCurrency(fs?: { currencies?: HotelCurrency[]; activeCurrencyCode?: string } | null): HotelCurrency {
	const all = listCurrencies(fs?.currencies);
	const code = String(fs?.activeCurrencyCode || HOME_CURRENCY_CODE).toUpperCase();
	return all.find((c) => c.code === code) || all[0];
}

/** The currency a receipt was recorded in. Edits keep that rate, not today's rate. */
export function currencyForStored(
	payment: { currency?: string; exchangeRate?: number } | null | undefined,
	fs?: { currencies?: HotelCurrency[]; activeCurrencyCode?: string } | null,
): HotelCurrency {
	const code = String(payment?.currency || HOME_CURRENCY_CODE).toUpperCase();
	const known = listCurrencies(fs?.currencies).find((c) => c.code === code);
	const rate = code === HOME_CURRENCY_CODE ? 1 : Number(payment?.exchangeRate || known?.rate || 0);
	return {
		code,
		majorName: known?.majorName || code,
		minorName: known?.minorName || 'cents',
		rate,
		bankAccountId: known?.bankAccountId,
		cashAccountId: known?.cashAccountId,
	};
}

export function homeCurrencyNames(): { majorName: string; minorName: string } {
	const home = listCurrencies(useSettingsStore.getState().financialSettings.currencies)[0];
	return { majorName: home.majorName, minorName: home.minorName };
}
