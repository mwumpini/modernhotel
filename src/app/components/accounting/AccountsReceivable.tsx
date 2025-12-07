'use client';

import React, { useMemo, useState } from 'react';
import {
	Card, CardBody, Button, Progress,
	Tabs, Tab,
	Input, Select, SelectItem,
	Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
	Chip
} from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';

interface SalesInvoice {
	id: string;
	number: string;
	date: string;
	customer: string;
	dueDate: string;
	currency: string;
	subtotal: number;
	tax: number;
	total: number;
	paid: number;
	balance: number;
	status: 'Draft' | 'Open' | 'Overdue' | 'Paid' | 'Cancelled';
}

const demo: SalesInvoice[] = [
	{ id: 'SI-1001', number: 'SI-1001', date: '2025-02-01', customer: 'Akwaaba Estates', dueDate: '2025-02-10', currency: 'GHS', subtotal: 3000, tax: 600, total: 3600, paid: 1800, balance: 1800, status: 'Overdue' },
	{ id: 'SI-1002', number: 'SI-1002', date: '2025-02-15', customer: 'Comfort Guest', dueDate: '2025-02-18', currency: 'GHS', subtotal: 700, tax: 120, total: 820, paid: 0, balance: 820, status: 'Open' },
	{ id: 'SI-1003', number: 'SI-1003', date: '2025-02-20', customer: 'Safari Logistics', dueDate: '2025-03-05', currency: 'USD', subtotal: 400, tax: 60, total: 460, paid: 460, balance: 0, status: 'Paid' },
];

export default function AccountsReceivable() {
	const [selectedTab, setSelectedTab] = useState('invoices');
	const [status, setStatus] = useState<'All' | SalesInvoice['status']>('All');
	const [customer, setCustomer] = useState('All Customers');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [q, setQ] = useState('');

	const rows = useMemo(() => {
		return demo
			.filter(r => (status === 'All' ? true : r.status === status))
			.filter(r => (customer === 'All Customers' ? true : r.customer === customer))
			.filter(r => (q ? (r.number + r.customer).toLowerCase().includes(q.toLowerCase()) : true))
			.filter(r => (from ? r.date >= from : true))
			.filter(r => (to ? r.date <= to : true));
	}, [status, customer, q, from, to]);

	const totals = rows.reduce(
		(acc, r) => {
			acc.total += r.total;
			acc.balance += r.balance;
			acc.paid += r.paid;
			return acc;
		},
		{ total: 0, balance: 0, paid: 0 }
	);

    // Live data from store (customers, sales invoices, receipts)
    const {
        businessPartners,
        invoices,
        payments,
        addPayment,
    } = useAccountingStore();

    const customers = useMemo(() => businessPartners.filter(p => p.type === 'Customer' || p.type === 'Both'), [businessPartners]);
    const salesInvoices = useMemo(() => invoices.filter(inv => inv.type === 'Sales'), [invoices]);
    const receipts = useMemo(() => payments.filter(p => p.type === 'Receipt'), [payments]);

    // Receipt dialog state
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [receiptForm, setReceiptForm] = useState<any>({});
    const [formError, setFormError] = useState<string>('');

    // Sales invoice modal state
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState<any>({});
    const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string>>({});

    function openNewReceipt() {
        setReceiptForm({
            businessPartnerId: customers[0]?.id || '',
            date: new Date().toISOString().slice(0,10),
            amount: 0,
            paymentMethod: 'Cash',
            reference: '',
            invoiceId: '',
        });
        setFormError('');
        setIsReceiptOpen(true);
    }

    function saveReceipt() {
        setFormError('');
        const amt = Number(receiptForm.amount || 0);
        if (!receiptForm.businessPartnerId) { setFormError('Select customer'); return; }
        if (!receiptForm.date) { setFormError('Select date'); return; }
        if (!(amt > 0)) { setFormError('Amount must be > 0'); return; }
        // Optional invoice validation
        if (receiptForm.invoiceId) {
            const inv = salesInvoices.find(i => i.id === receiptForm.invoiceId);
            if (inv) {
                const paidForInvoice = receipts.filter(r => r.invoiceId === inv.id).reduce((s, r) => s + (r.amount || 0), 0);
                const outstanding = Math.max(0, (inv.total || 0) - paidForInvoice);
                if (amt > outstanding) {
                    setFormError(`Amount exceeds outstanding (₵${outstanding.toLocaleString()})`);
                    return;
                }
            }
        }
        const payload = {
            id: `RCPT-${Date.now()}`,
            paymentNumber: `AR-RCPT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
            date: new Date(receiptForm.date).toISOString(),
            type: 'Receipt' as const,
            businessPartnerId: receiptForm.businessPartnerId,
            invoiceId: receiptForm.invoiceId || undefined,
            description: receiptForm.reference || 'Customer receipt',
            amount: amt,
            currency: 'GHS',
            paymentMethod: receiptForm.paymentMethod || 'Cash',
            status: 'Draft' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as any;
        addPayment(payload);
        setIsReceiptOpen(false);
    }

    function openNewInvoice() {
        setInvoiceErrors({});
        setInvoiceForm({
            businessPartnerId: customers[0]?.id || '',
            invoiceNumber: '',
            date: new Date().toISOString().slice(0,10),
            dueDate: new Date().toISOString().slice(0,10),
            currency: 'GHS',
            lines: [
                { id: `SL-${Date.now()}-0`, description: '', quantity: 1, unitPrice: 0, taxPercent: 0 },
            ],
            notes: ''
        });
        setIsInvoiceOpen(true);
    }

    function computeInvoiceTotals(f: any) {
        const subtotal = (f.lines || []).reduce((s: number, ln: any) => s + Number(ln.quantity || 0) * Number(ln.unitPrice || 0), 0);
        const tax = (f.lines || []).reduce((s: number, ln: any) => s + ((Number(ln.quantity || 0) * Number(ln.unitPrice || 0)) * Number(ln.taxPercent || 0) / 100), 0);
        return { subtotal: +subtotal.toFixed(2), taxAmount: +tax.toFixed(2), total: +(subtotal + tax).toFixed(2) };
    }

    function validateInvoice(): boolean {
        const e: Record<string, string> = {};
        if (!invoiceForm.businessPartnerId) e.businessPartnerId = 'Customer is required';
        if (!invoiceForm.date) e.date = 'Date is required';
        if (!invoiceForm.dueDate) e.dueDate = 'Due date is required';
        if (!Array.isArray(invoiceForm.lines) || invoiceForm.lines.length === 0) e.lines = 'Add at least one line';
        setInvoiceErrors(e);
        return Object.keys(e).length === 0;
    }

    function saveInvoice() {
        if (!validateInvoice()) return;
        const totals = computeInvoiceTotals(invoiceForm);
        const id = `INV-${Date.now()}`;
        const lines = (invoiceForm.lines || []).map((ln: any, idx: number) => {
            const amount = +(Number(ln.quantity || 0) * Number(ln.unitPrice || 0)).toFixed(2);
            const taxAmount = +((amount * Number(ln.taxPercent || 0)) / 100).toFixed(2);
            return {
                id: ln.id || `SIL-${Date.now()}-${idx}`,
                invoiceId: id,
                description: ln.description || '',
                quantity: Number(ln.quantity || 0),
                unitPrice: Number(ln.unitPrice || 0),
                amount,
                taxAmount,
                glAccountCode: ln.glAccountCode || '4100'
            };
        });
        const payload = {
            id,
            invoiceNumber: invoiceForm.invoiceNumber || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
            type: 'Sales' as const,
            date: new Date(invoiceForm.date).toISOString(),
            dueDate: new Date(invoiceForm.dueDate).toISOString(),
            businessPartnerId: invoiceForm.businessPartnerId,
            description: invoiceForm.notes || 'Sales invoice',
            subtotal: totals.subtotal,
            taxAmount: totals.taxAmount,
            total: totals.total,
            currency: invoiceForm.currency || 'GHS',
            status: 'Posted' as const,
            paidAmount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lines,
        } as any;
        // Reuse store addInvoice
        useAccountingStore.getState().addInvoice(payload);
        setIsInvoiceOpen(false);
    }

	return (
		<div className="p-6">
			<div className="mb-6">
				<h1 className="text-3xl font-bold text-gray-900">🧾 Accounts Receivable</h1>
				<p className="text-gray-600 mt-2">Manage customer accounts, sales invoices, and payments</p>
			</div>

			{/* Summary cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
				<Card>
					<CardBody className="text-center">
						<div className="text-2xl font-bold text-blue-600">₵{(totals.total).toLocaleString()}</div>
						<div className="text-sm text-gray-600">Total Invoices</div>
						<Progress value={100} size="sm" color="primary" className="mt-2" />
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center">
						<div className="text-2xl font-bold text-orange-600">₵{(totals.balance).toLocaleString()}</div>
						<div className="text-sm text-gray-600">Outstanding</div>
						<Progress value={100} size="sm" color="warning" className="mt-2" />
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center">
						<div className="text-2xl font-bold text-green-600">₵{(totals.paid).toLocaleString()}</div>
						<div className="text-sm text-gray-600">Total Payments</div>
						<Progress value={100} size="sm" color="success" className="mt-2" />
					</CardBody>
				</Card>
				<Card>
					<CardBody className="text-center">
						<div className="text-2xl font-bold text-emerald-600">{rows.length}</div>
						<div className="text-sm text-gray-600">Invoices Listed</div>
						<Progress value={100} size="sm" color="secondary" className="mt-2" />
					</CardBody>
				</Card>
			</div>

			<Card>
				<CardBody className="p-0">
					<Tabs selectedKey={selectedTab} onSelectionChange={(k) => setSelectedTab(k as string)} className="w-full">
						<Tab key="balances" title="📊 Customer Balances & Aging">
							<div className="p-6 text-sm text-gray-600">Aging analysis UI goes here (UI-only placeholder).</div>
						</Tab>

						<Tab key="customers" title="👥 Customers">
							<div className="p-6 text-sm text-gray-600">Customers list UI (UI-only placeholder).</div>
						</Tab>

                        <Tab key="invoices" title="🧾 Sales Invoices">
							<div className="p-6 space-y-4">
                                <div className="flex flex-wrap items-end gap-3">
									<Input label="Search" placeholder="Invoice no. or customer..." value={q} onValueChange={setQ} className="w-64" />
									<Select label="Status" selectedKeys={[status]} onSelectionChange={(s: any) => setStatus(Array.from(s)[0] as any)} className="w-48">
										<SelectItem key="All">All</SelectItem>
										<SelectItem key="Draft">Draft</SelectItem>
										<SelectItem key="Open">Open</SelectItem>
										<SelectItem key="Overdue">Overdue</SelectItem>
										<SelectItem key="Paid">Paid</SelectItem>
										<SelectItem key="Cancelled">Cancelled</SelectItem>
									</Select>
									<Select label="Customer" selectedKeys={[customer]} onSelectionChange={(s: any) => setCustomer(Array.from(s)[0] as any)} className="w-60">
										<SelectItem key="All Customers">All Customers</SelectItem>
										{[...new Set(demo.map(d => d.customer))].map(c => (
											<SelectItem key={c}>{c}</SelectItem>
										))}
									</Select>
									<Input label="From" type="date" value={from} onValueChange={setFrom} className="w-40" />
									<Input label="To" type="date" value={to} onValueChange={setTo} className="w-40" />
                                    <div className="flex-1" />
                                    <Button color="primary" onClick={openNewInvoice}>➕ Add Invoice</Button>
								</div>

								<Table aria-label="Sales invoices table">
									<TableHeader>
										<TableColumn>INVOICE #</TableColumn>
										<TableColumn>CUSTOMER</TableColumn>
										<TableColumn>DATE</TableColumn>
										<TableColumn>DUE DATE</TableColumn>
										<TableColumn align="end">SUBTOTAL</TableColumn>
										<TableColumn align="end">TAX</TableColumn>
										<TableColumn align="end">TOTAL</TableColumn>
										<TableColumn align="end">PAID</TableColumn>
										<TableColumn align="end">BALANCE</TableColumn>
										<TableColumn>STATUS</TableColumn>
										<TableColumn>AGING</TableColumn>
										<TableColumn>ACTIONS</TableColumn>
									</TableHeader>
									<TableBody emptyContent="No sales invoices found.">
										{rows.map(r => (
											<TableRow key={r.id}>
												<TableCell className="font-medium">{r.number}</TableCell>
												<TableCell>{r.customer}</TableCell>
												<TableCell>{r.date}</TableCell>
												<TableCell>{r.dueDate}</TableCell>
												<TableCell className="text-right">{r.currency} {r.subtotal.toFixed(2)}</TableCell>
												<TableCell className="text-right">{r.currency} {r.tax.toFixed(2)}</TableCell>
												<TableCell className="text-right">{r.currency} {r.total.toFixed(2)}</TableCell>
												<TableCell className="text-right">{r.currency} {r.paid.toFixed(2)}</TableCell>
												<TableCell className="text-right">{r.currency} {r.balance.toFixed(2)}</TableCell>
												<TableCell>
													<Chip size="sm" color={r.status === 'Overdue' ? 'danger' : r.status === 'Paid' ? 'success' : r.status === 'Open' ? 'primary' : 'default'} variant="flat">
														{r.status}
													</Chip>
												</TableCell>
												<TableCell />
												<TableCell><Button size="sm" variant="light">View</Button></TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</Tab>

                        <Tab key="payments" title="💳 Payments (Receipts)">
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">Customer Receipts</h3>
                                    <Button color="primary" onClick={openNewReceipt}>Record Receipt</Button>
                                </div>
                                <Table aria-label="Customer Receipts">
                                    <TableHeader>
                                        <TableColumn>RECEIPT #</TableColumn>
                                        <TableColumn>CUSTOMER</TableColumn>
                                        <TableColumn>DATE</TableColumn>
                                        <TableColumn align="end">AMOUNT</TableColumn>
                                        <TableColumn>METHOD</TableColumn>
                                        <TableColumn>STATUS</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent="No receipts found.">
                                        {receipts.map((p: any) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-mono text-sm">{p.paymentNumber || p.id}</TableCell>
                                                <TableCell>{customers.find(c => c.id === p.businessPartnerId)?.name || p.businessPartnerId}</TableCell>
                                                <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">₵{Number(p.amount || 0).toLocaleString()}</TableCell>
                                                <TableCell><Chip size="sm" variant="flat">{p.paymentMethod || 'Cash'}</Chip></TableCell>
                                                <TableCell><Chip size="sm" color={p.status === 'Posted' ? 'success' : 'default'} variant="flat">{p.status || 'Draft'}</Chip></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Tab>
					</Tabs>
				</CardBody>
			</Card>

            {/* Receipt modal */}
            <Modal isOpen={isReceiptOpen} onOpenChange={setIsReceiptOpen} placement="center">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Record Customer Receipt</ModalHeader>
                            <ModalBody>
                                {formError && <div className="text-red-600 text-sm">{formError}</div>}
                                <div className="grid grid-cols-2 gap-4">
                                    <Select label="Customer" selectedKeys={[receiptForm.businessPartnerId || customers[0]?.id]} onSelectionChange={(keys) => setReceiptForm({ ...receiptForm, businessPartnerId: Array.from(keys)[0] })}>
                                        {customers.map(c => (<SelectItem key={c.id}>{c.name}</SelectItem>))}
                                    </Select>
                                    <Input type="date" label="Date" value={receiptForm.date} onValueChange={(v)=> setReceiptForm({ ...receiptForm, date: v })} />
                                    <Input type="number" label="Amount" value={(receiptForm.amount ?? 0).toString()} onChange={(e)=> setReceiptForm({ ...receiptForm, amount: parseFloat(e.target.value) || 0 })} />
                                    <Select label="Method" selectedKeys={[receiptForm.paymentMethod || 'Cash']} onSelectionChange={(keys)=> setReceiptForm({ ...receiptForm, paymentMethod: Array.from(keys)[0] })}>
                                        <SelectItem key="Cash">Cash</SelectItem>
                                        <SelectItem key="Card">Card</SelectItem>
                                        <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                                        <SelectItem key="Bank">Bank</SelectItem>
                                    </Select>
                                    <Select label="Apply to Invoice (optional)" selectedKeys={[receiptForm.invoiceId || '']} onSelectionChange={(keys)=> setReceiptForm({ ...receiptForm, invoiceId: Array.from(keys)[0] })}>
                                        <SelectItem key="">— None —</SelectItem>
                                        {salesInvoices.map(inv => (
                                            <SelectItem key={inv.id}>{inv.invoiceNumber || inv.id}</SelectItem>
                                        ))}
                                    </Select>
                                    <Input label="Reference" value={receiptForm.reference || ''} onChange={(e)=> setReceiptForm({ ...receiptForm, reference: e.target.value })} />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" onPress={saveReceipt}>Save Receipt</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Sales Invoice modal */}
            <Modal isOpen={isInvoiceOpen} onOpenChange={setIsInvoiceOpen} placement="center" size="3xl">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>New Sales Invoice</ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-3 gap-4">
                                    <Select label="Customer" selectedKeys={[invoiceForm.businessPartnerId || customers[0]?.id]} onSelectionChange={(keys)=> setInvoiceForm({ ...invoiceForm, businessPartnerId: Array.from(keys)[0] })}>
                                        {customers.map(c => (<SelectItem key={c.id}>{c.name}</SelectItem>))}
                                    </Select>
                                    <Input label="Invoice #" value={invoiceForm.invoiceNumber || ''} onChange={(e)=> setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} />
                                    <Input label="Currency" value={invoiceForm.currency || 'GHS'} onChange={(e)=> setInvoiceForm({ ...invoiceForm, currency: e.target.value })} />
                                    <Input type="date" label="Date" value={invoiceForm.date} onValueChange={(v)=> setInvoiceForm({ ...invoiceForm, date: v })} />
                                    <Input type="date" label="Due Date" value={invoiceForm.dueDate} onValueChange={(v)=> setInvoiceForm({ ...invoiceForm, dueDate: v })} />
                                </div>
                                {invoiceErrors.businessPartnerId && <div className="text-red-600 text-xs">{invoiceErrors.businessPartnerId}</div>}
                                {(invoiceErrors.date || invoiceErrors.dueDate) && <div className="text-red-600 text-xs">{invoiceErrors.date || invoiceErrors.dueDate}</div>}

                                <div className="mt-4">
                                    <div className="text-sm font-medium mb-2">Lines</div>
                                    <Table aria-label="Sales lines">
                                        <TableHeader>
                                            <TableColumn>DESCRIPTION</TableColumn>
                                            <TableColumn align="end">QTY</TableColumn>
                                            <TableColumn align="end">UNIT PRICE</TableColumn>
                                            <TableColumn align="end">TAX %</TableColumn>
                                            <TableColumn align="end">AMOUNT</TableColumn>
                                            <TableColumn>ACTIONS</TableColumn>
                                        </TableHeader>
                                        <TableBody emptyContent="No lines">
                                            {(invoiceForm.lines || []).map((ln: any, idx: number) => {
                                                const amount = (Number(ln.quantity || 0) * Number(ln.unitPrice || 0));
                                                return (
                                                    <TableRow key={ln.id || idx}>
                                                        <TableCell>
                                                            <Input size="sm" value={ln.description || ''} onChange={(e)=> {
                                                                const lines = [...invoiceForm.lines];
                                                                lines[idx] = { ...lines[idx], description: e.target.value };
                                                                setInvoiceForm({ ...invoiceForm, lines });
                                                            }} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input size="sm" type="number" value={(ln.quantity ?? 0).toString()} onChange={(e)=> {
                                                                const lines = [...invoiceForm.lines];
                                                                lines[idx] = { ...lines[idx], quantity: parseFloat(e.target.value) || 0 };
                                                                setInvoiceForm({ ...invoiceForm, lines });
                                                            }} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input size="sm" type="number" value={(ln.unitPrice ?? 0).toString()} onChange={(e)=> {
                                                                const lines = [...invoiceForm.lines];
                                                                lines[idx] = { ...lines[idx], unitPrice: parseFloat(e.target.value) || 0 };
                                                                setInvoiceForm({ ...invoiceForm, lines });
                                                            }} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input size="sm" type="number" value={(ln.taxPercent ?? 0).toString()} onChange={(e)=> {
                                                                const lines = [...invoiceForm.lines];
                                                                lines[idx] = { ...lines[idx], taxPercent: parseFloat(e.target.value) || 0 };
                                                                setInvoiceForm({ ...invoiceForm, lines });
                                                            }} />
                                                        </TableCell>
                                                        <TableCell className="text-right">₵{amount.toFixed(2)}</TableCell>
                                                        <TableCell>
                                                            <Button size="sm" variant="light" onClick={()=>{
                                                                const lines = invoiceForm.lines.filter((_: any, i: number) => i !== idx);
                                                                setInvoiceForm({ ...invoiceForm, lines });
                                                            }}>Remove</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    {invoiceErrors.lines && <div className="text-red-600 text-xs mt-1">{invoiceErrors.lines}</div>}
                                    <div className="mt-2">
                                        <Button size="sm" variant="bordered" onClick={()=> setInvoiceForm({ ...invoiceForm, lines: [...(invoiceForm.lines || []), { id: `SL-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxPercent: 0 }] })}>Add Line</Button>
                                    </div>
                                </div>

                                {(() => {
                                    const t = computeInvoiceTotals(invoiceForm);
                                    return (
                                        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                                            <div className="col-span-2" />
                                            <Card>
                                                <CardBody className="space-y-1">
                                                    <div className="flex justify-between"><span>Subtotal</span><span>₵{t.subtotal.toFixed(2)}</span></div>
                                                    <div className="flex justify-between"><span>Tax</span><span>₵{t.taxAmount.toFixed(2)}</span></div>
                                                    <div className="flex justify-between font-semibold"><span>Total</span><span>₵{t.total.toFixed(2)}</span></div>
                                                </CardBody>
                                            </Card>
                                        </div>
                                    );
                                })()}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" onPress={saveInvoice}>Save Invoice</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
		</div>
	);
}


