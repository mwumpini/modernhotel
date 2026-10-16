'use client';

import React, { useState } from 'react';
import { Button } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { useAccountingStore } from '../../lib/accounting/store';
import { HOME_CURRENCY_CODE, listCurrencies, workingCurrency, type HotelCurrency } from '../../lib/settings/currencies';
import type { BankAccount } from '../../lib/accounting/models';

const field = 'mt-1 w-full h-10 rounded-lg border border-default-300 bg-transparent px-3 text-sm focus:border-ghana-green focus:outline-none focus:ring-2 focus:ring-ghana-green/20';
const label = 'text-xs font-medium text-gray-500';

function account(id: string, code: string, kind: 'bank' | 'cash', now: string): BankAccount {
	const cash = kind === 'cash';
	return {
		id,
		accountNumber: cash ? `${code}-CASH` : `${code}-BANK`,
		accountName: cash ? `${code} cash` : `${code} bank`,
		bankName: cash ? 'Cash' : code,
		currency: code,
		glAccountCode: cash ? '1110' : '1120',
		openingBalanceType: 'period',
		openingBalance: 0,
		currentBalance: 0,
		isActive: true,
		createdAt: now,
		updatedAt: now,
	};
}

export default function CurrenciesPolicy() {
	const financialSettings = useSettingsStore((s) => s.financialSettings);
	const updateFinancialSettings = useSettingsStore((s) => s.updateFinancialSettings);
	const currencies = listCurrencies(financialSettings.currencies);
	const working = workingCurrency(financialSettings);
	const home = currencies[0];
	const others = currencies.slice(1);
	const [draft, setDraft] = useState({ code: '', majorName: '', minorName: '', rate: '' });
	const [error, setError] = useState('');

	const save = (next: HotelCurrency[], activeCurrencyCode?: string) => {
		updateFinancialSettings({
			currencies: next,
			...(activeCurrencyCode ? { activeCurrencyCode } : {}),
		});
	};

	const patch = (code: string, fields: Partial<HotelCurrency>) => {
		save(currencies.map((c) => (c.code === code ? { ...c, ...fields } : c)));
	};

	const add = () => {
		const code = draft.code.trim().toUpperCase();
		const majorName = draft.majorName.trim();
		const minorName = draft.minorName.trim();
		const rate = Number(draft.rate);
		if (!/^[A-Z]{2,6}$/.test(code)) {
			setError('Write the code in letters, such as USD.');
			return;
		}
		if (code === HOME_CURRENCY_CODE || currencies.some((c) => c.code === code)) {
			setError(`${code} is already in the list.`);
			return;
		}
		if (!majorName || !minorName) {
			setError('Write the main unit and the small unit. Those words are used in amount in words.');
			return;
		}
		if (!(rate > 0)) {
			setError('Write how many cedis one unit is worth.');
			return;
		}
		const now = new Date().toISOString();
		const bankAccountId = `fx-bank-${code}`;
		const cashAccountId = `fx-cash-${code}`;
		const books = useAccountingStore.getState();
		if (!books.bankAccounts.some((a) => a.id === bankAccountId)) books.addBankAccount(account(bankAccountId, code, 'bank', now));
		if (!books.bankAccounts.some((a) => a.id === cashAccountId)) books.addBankAccount(account(cashAccountId, code, 'cash', now));
		save([...currencies, { code, majorName, minorName, rate, bankAccountId, cashAccountId }]);
		setDraft({ code: '', majorName: '', minorName: '', rate: '' });
		setError('');
	};

	return (
		<div className="xl:col-span-2 space-y-4">
			<p className="text-sm text-gray-600">
				Taking <strong>{working.code === HOME_CURRENCY_CODE ? home.majorName : `${working.code} · ${working.majorName}`}</strong>.
				The books stay in cedis.
			</p>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<label className={label}>
					Code
					<input className={field} value={HOME_CURRENCY_CODE} disabled />
				</label>
				<label className={label}>
					Main unit
					<input className={field} value={home.majorName} onChange={(e) => patch(HOME_CURRENCY_CODE, { majorName: e.target.value })} />
				</label>
				<label className={label}>
					Small unit
					<input className={field} value={home.minorName} onChange={(e) => patch(HOME_CURRENCY_CODE, { minorName: e.target.value })} />
				</label>
			</div>
			<p className="text-xs text-gray-500">Cedis documents say these words in the amount in words. This currency stays on.</p>

			{others.map((c) => {
				const on = working.code === c.code;
				return (
					<div key={c.code} className="rounded-xl border border-default-200 p-3 space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<span className="text-sm font-semibold text-ghana-black">{c.code}</span>
							<Button size="sm" variant={on ? 'flat' : 'solid'} color={on ? 'default' : 'primary'} onPress={() => save(currencies, on ? HOME_CURRENCY_CODE : c.code)}>
								{on ? 'Back to cedis' : 'Use this'}
							</Button>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<label className={label}>
								Main unit
								<input className={field} value={c.majorName} onChange={(e) => patch(c.code, { majorName: e.target.value })} />
							</label>
							<label className={label}>
								Small unit
								<input className={field} value={c.minorName} onChange={(e) => patch(c.code, { minorName: e.target.value })} />
							</label>
							<label className={label}>
								Cedis per 1 {c.code}
								<input className={field} type="number" min="0" step="0.0001" value={String(c.rate)} onChange={(e) => patch(c.code, { rate: Number(e.target.value) })} />
							</label>
						</div>
						<p className="text-xs text-gray-500">Bank account {c.code} bank · cash account {c.code} cash. Receipts use the bank, unless the method is cash.</p>
					</div>
				);
			})}

			<div className="rounded-xl border border-dashed border-default-300 p-3 space-y-3">
				<h4 className="text-sm font-semibold text-ghana-black">Add a currency</h4>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
					<label className={label}>
						Code
						<input className={field} placeholder="USD" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
					</label>
					<label className={label}>
						Main unit
						<input className={field} placeholder="US dollar" value={draft.majorName} onChange={(e) => setDraft({ ...draft, majorName: e.target.value })} />
					</label>
					<label className={label}>
						Small unit
						<input className={field} placeholder="cents" value={draft.minorName} onChange={(e) => setDraft({ ...draft, minorName: e.target.value })} />
					</label>
					<label className={label}>
						Cedis per 1
						<input className={field} type="number" min="0" step="0.0001" placeholder="15.50" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} />
					</label>
				</div>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<Button size="sm" color="primary" onPress={add}>Add currency</Button>
			</div>
		</div>
	);
}
