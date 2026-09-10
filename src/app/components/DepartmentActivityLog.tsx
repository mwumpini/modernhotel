'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button } from "@heroui/react";
import { auditLogStore, AuditArea } from '../lib/analytics/auditLogStore';

interface Props {
	 area: AuditArea;
	 title?: string;
	 showCategory?: boolean;
	 showAlias?: boolean;
}

type SortKey = 'at' | 'action' | 'entity' | 'details';

export default function DepartmentActivityLog({ area, title, showCategory, showAlias }: Props) {
	 const [rows, setRows] = React.useState(auditLogStore.byArea(area));
	 const [search, setSearch] = React.useState('');
	 const [action, setAction] = React.useState('');
	 const [severity, setSeverity] = React.useState('');
	 const [from, setFrom] = React.useState('');
	 const [to, setTo] = React.useState('');
	 const [sortKey, setSortKey] = React.useState<SortKey>('at');
	 const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

	 React.useEffect(() => {
		 const sync = () => setRows(auditLogStore.byArea(area));
		 sync();
		 return auditLogStore.subscribe(sync);
	 }, [area]);

	 const filtered = React.useMemo(() => {
		 return rows
			.filter(r => !action || r.action === action)
			.filter(r => !severity || r.severity === (severity as any))
			.filter(r => {
				 if (!from && !to) return true;
				 const t = new Date(r.at).getTime();
				 const after = from ? t >= new Date(from).getTime() : true;
				 const before = to ? t <= new Date(to + 'T23:59:59').getTime() : true;
				 return after && before;
			 })
			.filter(r => {
				 if (!search.trim()) return true;
				 const hay = `${new Date(r.at).toLocaleString()} ${r.action} ${r.entity || ''} ${r.details || ''} ${JSON.stringify(r.meta || {})}`.toLowerCase();
				 return hay.includes(search.toLowerCase());
			 });
	 }, [rows, search, action, severity, from, to]);

	 const sorted = React.useMemo(() => {
		 const copy = [...filtered];
		 copy.sort((a, b) => {
			 const av = sortKey === 'at' ? a.at : (sortKey === 'action' ? a.action : (sortKey === 'entity' ? (a.entity || '') : (a.details || '')));
			 const bv = sortKey === 'at' ? b.at : (sortKey === 'action' ? b.action : (sortKey === 'entity' ? (b.entity || '') : (b.details || '')));
			 if (av < bv) return sortDir === 'asc' ? -1 : 1;
			 if (av > bv) return sortDir === 'asc' ? 1 : -1;
			 return 0;
		 });
		 return copy;
	 }, [filtered, sortKey, sortDir]);

	 const exportCsv = () => {
		 const header = ['Time', 'Action', 'Entity', 'Details', 'Severity'];
		 const lines = sorted.map(r => [new Date(r.at).toLocaleString(), r.action, r.entity || '', (r.details || '').replace(/\n/g, ' '), r.severity || ''].map(f => `"${String(f).replace(/"/g, '""')}"`).join(','));
		 const body = [header.join(','), ...lines].join('\n');
		 const blob = new Blob([body], { type: 'text/csv' });
		 const url = URL.createObjectURL(blob);
		 const a = document.createElement('a');
		 a.href = url;
		 a.download = `${area}-activities-${new Date().toISOString().slice(0,10)}.csv`;
		 a.click();
		 URL.revokeObjectURL(url);
	 };

	 // Build dynamic columns to avoid falsy children in Table composition
	 const columns = React.useMemo(() => {
		 const base = [
			 { key: 'time', label: 'TIME' },
			 { key: 'action', label: 'ACTION' },
		 ];
		 if (showAlias) base.push({ key: 'alias', label: 'ITEM CODE' });
		 if (showCategory) base.push({ key: 'category', label: 'CATEGORY' });
		 base.push({ key: 'entity', label: 'ENTITY' });
		 base.push({ key: 'details', label: 'DETAILS' });
		 return base as Array<{ key: string; label: string }>;
	 }, [showAlias, showCategory]);

	 return (
		 <Card className="border-0 shadow-lg">
			 <CardHeader className="pb-3">
				 <div className="flex items-center justify-between w-full">
					 <h3 className="text-xl font-semibold text-ghana-black">{title || 'View Activities'}</h3>
					 <div className="flex gap-2">
						 <Button size="sm" variant="flat" onClick={exportCsv}>Export CSV</Button>
					 </div>
				 </div>
			 </CardHeader>
			 <CardBody>
				 <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
					 <Input size="sm" label="Search (time, unit, qty, item, etc.)" value={search} onChange={(e) => setSearch(e.target.value)} />
					 <Select size="sm" label="Action" selectedKeys={[action]} onSelectionChange={(k) => setAction(Array.from(k as Set<string>)[0] || '')}>
						 <SelectItem key="">All</SelectItem>
						 <SelectItem key="create">Create</SelectItem>
						 <SelectItem key="update">Update</SelectItem>
						 <SelectItem key="delete">Delete</SelectItem>
						 <SelectItem key="status">Status</SelectItem>
						 <SelectItem key="assign">Assign</SelectItem>
						 <SelectItem key="print">Print</SelectItem>
						 <SelectItem key="export">Export</SelectItem>
						 <SelectItem key="view">View</SelectItem>
					 </Select>
					 <Select size="sm" label="Severity" selectedKeys={[severity]} onSelectionChange={(k) => setSeverity(Array.from(k as Set<string>)[0] || '')}>
						 <SelectItem key="">All</SelectItem>
						 <SelectItem key="critical">Critical</SelectItem>
						 <SelectItem key="high">High</SelectItem>
						 <SelectItem key="medium">Medium</SelectItem>
						 <SelectItem key="low">Low</SelectItem>
					 </Select>
					 <Input size="sm" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
					 <Input size="sm" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
				 </div>

				 <div className="flex items-center gap-2 mb-2 text-sm">
					 <span>Sort:</span>
					 <Select size="sm" selectedKeys={[sortKey]} onSelectionChange={(k) => setSortKey(Array.from(k as Set<string>)[0] as SortKey)}>
						 <SelectItem key="at">Time</SelectItem>
						 <SelectItem key="action">Action</SelectItem>
						 <SelectItem key="entity">Entity</SelectItem>
						 <SelectItem key="details">Details</SelectItem>
					 </Select>
					 <Select size="sm" selectedKeys={[sortDir]} onSelectionChange={(k) => setSortDir(Array.from(k as Set<string>)[0] as 'asc' | 'desc')}>
						 <SelectItem key="asc">Asc</SelectItem>
						 <SelectItem key="desc">Desc</SelectItem>
					 </Select>
				 </div>

				 <div className="max-h-[520px] overflow-y-auto">
					 <Table aria-label="Department activities table" selectionMode="none">
						 <TableHeader columns={columns}>
							 {column => (
								 <TableColumn key={column.key}>{column.label}</TableColumn>
							 )}
						 </TableHeader>
						 <TableBody items={sorted} emptyContent="No activities found for this department.">
							 {item => (
								 <TableRow key={item.id}>
									 {columnKey => {
										 switch (String(columnKey)) {
											 case 'time':
												 return <TableCell>{new Date(item.at).toLocaleString()}</TableCell>;
											 case 'action':
												 return <TableCell>{item.action}</TableCell>;
											 case 'alias':
												 return <TableCell>{String((item.meta as any)?.alias ?? (item.meta as any)?.itemCode ?? '-')}</TableCell>;
											 case 'category':
												 return <TableCell>{String((item.meta as any)?.category ?? '-')}</TableCell>;
											 case 'entity':
												 return <TableCell>{item.entity || '-'}</TableCell>;
											 case 'details':
												 return <TableCell className="max-w-xl truncate" title={item.details || ''}>{item.details || '-'}</TableCell>;
											 default:
												 return <TableCell>-</TableCell>;
										 }
									 }}
								 </TableRow>
							 )}
						 </TableBody>
					 </Table>
				 </div>
			 </CardBody>
		 </Card>
	 );
}


