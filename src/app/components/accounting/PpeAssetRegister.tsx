'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
  Alert,
  Checkbox,
} from '@heroui/react';
import { usePpeRegisterStore } from '@/app/lib/accounting/ppeStore';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { capturePpeCapitalization } from '@/app/lib/accounting/ppe/ledgerSync';
import PpeSummaryPivotTable, {
  FS_PIVOT_ROWS,
  GRA_PIVOT_ROWS,
  FS_COLUMN_LABELS,
  GRA_COLUMN_LABELS,
} from './PpeSummaryPivotTable';
import {
  computeAllAssets,
  fsSummarySection4,
  graRollforward,
  disposalsList,
  PRESENTATION_GROUPS,
  GRA_CLASSES,
  reportDateFromInput,
  assetTotalCost,
  type PpeAsset,
  type CapExpStatus,
  type PpeCategory,
  type PresentationGroup,
  type GraClass,
  type GraMethod,
  type IasMethod,
} from '@/app/lib/accounting/ppe';
import { DEFAULT_ORG_ID } from '@/app/lib/accounting/ppe/categories';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';

// formatAccountingCurrency always shows a magnitude, so the sign (disposal gain/loss
// can be negative) is reattached in front of it here.
const fmt = (n: number) => (n < 0 ? '-' : '') + formatAccountingCurrency(n);

const CAP_EXP_OPTIONS: CapExpStatus[] = ['Capitalise', 'Expense', 'Disposed'];
const GRA_METHOD_OPTIONS: GraMethod[] = ['SL', 'RB'];
const IAS_METHOD_OPTIONS: IasMethod[] = ['SL', 'RB'];

const defaultForm = {
  purchaseDate: new Date().toISOString().slice(0, 10),
  assetCode: '',
  assetName: '',
  categoryId: 'cat-ffe',
  quantity: 1,
  unitPrice: 0,
  capExp: 'Capitalise' as CapExpStatus,
  disposalDate: '',
  disposalProceeds: '',
  postToLedger: true,
  paymentGlCode: '2200',
};

const defaultCategoryForm = {
  name: '',
  presentationGroup: 'Furniture & Fixtures' as PresentationGroup,
  graClass: 'Class 3' as GraClass,
  graRatePct: '20',
  graMethod: 'RB' as GraMethod,
  iasMethod: 'SL' as IasMethod,
  iasRatePct: '20',
  usefulLifeYrs: '7',
  residualPct: '5',
};

export default function PpeAssetRegisterPage() {
  const {
    assets,
    categories,
    reportDate,
    error,
    setReportDate,
    addAsset,
    updateAsset,
    deleteAsset,
    setCapitalizationJournalId,
    upsertCategory,
    deleteCategory,
    initializePpeRegister,
    clearError,
  } = usePpeRegisterStore();
  const { initializeAccounting } = useAccountingStore();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isCategoryOpen,
    onOpen: onCategoryOpen,
    onClose: onCategoryClose,
  } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState('register');
  const [form, setForm] = useState(defaultForm);
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);

  useEffect(() => {
    initializePpeRegister();
  }, [initializePpeRegister]);

  const reportDateObj = useMemo(() => reportDateFromInput(reportDate), [reportDate]);

  const computedRows = useMemo(
    () => computeAllAssets(assets, categories, reportDateObj),
    [assets, categories, reportDateObj]
  );

  const fsSummary = useMemo(
    () => fsSummarySection4(assets, categories, reportDateObj),
    [assets, categories, reportDateObj]
  );

  const gra = useMemo(
    () => graRollforward(assets, categories, reportDateObj),
    [assets, categories, reportDateObj]
  );

  const disposals = useMemo(
    () => disposalsList(assets, categories, reportDateObj),
    [assets, categories, reportDateObj]
  );

  const totals = useMemo(() => {
    const capitalised = computedRows.filter((r) => r.asset.capExp === 'Capitalise');
    return {
      cost: capitalised.reduce((s, r) => s + r.computed.totalCost, 0),
      nbv: capitalised.reduce((s, r) => s + r.computed.nbv, 0),
      dep: capitalised.reduce((s, r) => s + r.computed.accumDep, 0),
      graCa: capitalised.reduce((s, r) => s + r.computed.graCaThisYear, 0),
      graWdv: capitalised.reduce((s, r) => s + r.computed.graWdvCurrent, 0),
    };
  }, [computedRows]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...defaultForm, assetCode: `CA-${String(assets.length + 1).padStart(3, '0')}` });
    setFormError(null);
    onOpen();
  };

  const openEdit = (asset: PpeAsset) => {
    setEditingId(asset.id);
    setForm({
      purchaseDate: asset.purchaseDate.slice(0, 10),
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      categoryId: asset.categoryId,
      quantity: asset.quantity,
      unitPrice: asset.unitPrice,
      capExp: asset.capExp,
      disposalDate: asset.disposalDate?.slice(0, 10) || '',
      disposalProceeds: asset.disposalProceeds != null ? String(asset.disposalProceeds) : '',
      postToLedger: false,
      paymentGlCode: '2200',
    });
    setFormError(null);
    onOpen();
  };

  const handleSave = () => {
    setFormError(null);
    const payload = {
      purchaseDate: form.purchaseDate,
      assetCode: form.assetCode.trim(),
      assetName: form.assetName.trim(),
      categoryId: form.categoryId,
      quantity: Number(form.quantity),
      unitPrice: Number(form.unitPrice),
      capExp: form.capExp,
      disposalDate: form.capExp === 'Disposed' ? form.disposalDate || null : null,
      disposalProceeds:
        form.capExp === 'Disposed' && form.disposalProceeds !== ''
          ? Number(form.disposalProceeds)
          : null,
    };

    if (editingId) {
      if (updateAsset(editingId, payload)) {
        setNotice('Asset updated.');
        onClose();
      } else {
        setFormError(usePpeRegisterStore.getState().error || 'Update failed');
      }
      return;
    }

    const created = addAsset(payload);
    if (!created) {
      setFormError(usePpeRegisterStore.getState().error || 'Could not save asset');
      return;
    }

    if (form.capExp === 'Capitalise' && form.postToLedger) {
      const cost = assetTotalCost(created);
      const result = capturePpeCapitalization({
        ppeAssetId: created.id,
        assetCode: created.assetCode,
        name: created.assetName,
        purchaseDate: created.purchaseDate,
        cost,
        paymentGlCode: form.paymentGlCode || '2200',
      });
      if (result) {
        setCapitalizationJournalId(created.id, result.journalEntryId);
        void initializeAccounting();
        setNotice(`Asset saved and capitalized — JE ${result.journalEntryId}`);
      } else {
        setNotice('Asset saved (ledger posting failed — use Sync to ledger).');
      }
    } else {
      setNotice('Asset saved.');
    }
    onClose();
  };

  const assetCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      counts.set(a.categoryId, (counts.get(a.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [assets]);

  const openAddCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm({ ...defaultCategoryForm });
    setCategoryFormError(null);
    onCategoryOpen();
  };

  const openEditCategory = (category: PpeCategory) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      presentationGroup: category.presentationGroup,
      graClass: category.graClass,
      graRatePct: String(Math.round(category.graRate * 100)),
      graMethod: category.graMethod,
      iasMethod: category.iasMethod,
      iasRatePct: String(Math.round(category.iasRate * 100)),
      usefulLifeYrs: String(category.usefulLifeYrs),
      residualPct: String(Math.round(category.residualPct * 100)),
    });
    setCategoryFormError(null);
    onCategoryOpen();
  };

  const handleSaveCategory = () => {
    setCategoryFormError(null);
    const graRate = Number(categoryForm.graRatePct) / 100;
    const iasRate = Number(categoryForm.iasRatePct) / 100;
    const usefulLifeYrs = Number(categoryForm.usefulLifeYrs);
    const residualPct = Number(categoryForm.residualPct) / 100;

    const category: PpeCategory = {
      id: editingCategoryId ?? `cat-${Date.now()}`,
      name: categoryForm.name.trim(),
      presentationGroup: categoryForm.presentationGroup,
      graClass: categoryForm.graClass,
      graRate,
      graMethod: categoryForm.graMethod,
      iasMethod: categoryForm.iasMethod,
      iasRate: categoryForm.iasMethod === 'RB' ? iasRate : usefulLifeYrs > 0 ? 1 / usefulLifeYrs : 0,
      usefulLifeYrs,
      residualPct,
      organisationId: DEFAULT_ORG_ID,
    };

    if (upsertCategory(category)) {
      setNotice(editingCategoryId ? 'Category updated.' : 'Category added.');
      onCategoryClose();
    } else {
      setCategoryFormError(usePpeRegisterStore.getState().error || 'Could not save category');
    }
  };

  const handleDeleteCategory = (category: PpeCategory) => {
    if (deleteCategory(category.id)) {
      setNotice(`Category "${category.name}" deleted.`);
    }
  };

  const fsPivotValues = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const col of [...PRESENTATION_GROUPS, 'TOTAL']) {
      out[col] = { ...fsSummary[col as keyof typeof fsSummary] };
    }
    return out;
  }, [fsSummary]);

  const graPivotValues = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const col of [...GRA_CLASSES, 'TOTAL']) {
      out[col] = { ...gra[col as keyof typeof gra] };
    }
    return out;
  }, [gra]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PPE Asset Register</h1>
          <p className="text-sm text-gray-600 mt-1">
            IAS 16 book depreciation and GRA capital allowances — all figures computed from the report date.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            type="date"
            label="Report date"
            size="sm"
            className="w-44"
            value={reportDate}
            onValueChange={setReportDate}
            description={`Year ${reportDateObj.getFullYear()} — drives all tabs`}
          />
          <Button color="primary" size="sm" onPress={openAdd}>
            Add asset
          </Button>
        </div>
      </div>

      {(notice || error) && (
        <Alert
          color={error ? 'danger' : 'success'}
          className="mb-4"
          onClose={() => {
            setNotice(null);
            clearError();
          }}
        >
          {error || notice}
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="shadow-sm"><CardBody className="py-3 text-center"><div className="text-lg font-bold text-blue-700">{fmt(totals.cost)}</div><div className="text-xs text-gray-500">Total cost</div></CardBody></Card>
        <Card className="shadow-sm"><CardBody className="py-3 text-center"><div className="text-lg font-bold text-orange-700">{fmt(totals.dep)}</div><div className="text-xs text-gray-500">Accum. dep (IAS)</div></CardBody></Card>
        <Card className="shadow-sm"><CardBody className="py-3 text-center"><div className="text-lg font-bold text-green-700">{fmt(totals.nbv)}</div><div className="text-xs text-gray-500">Net book value</div></CardBody></Card>
        <Card className="shadow-sm"><CardBody className="py-3 text-center"><div className="text-lg font-bold text-indigo-700">{fmt(totals.graWdv)}</div><div className="text-xs text-gray-500">GRA closing WDV</div></CardBody></Card>
        <Card className="shadow-sm"><CardBody className="py-3 text-center"><div className="text-lg font-bold text-violet-700">{fmt(totals.graCa)}</div><div className="text-xs text-gray-500">GRA CA this year</div></CardBody></Card>
      </div>

      <Card className="shadow-sm">
        <CardBody className="p-0">
          <Tabs selectedKey={selectedTab} onSelectionChange={(k) => setSelectedTab(k as string)} size="sm" variant="underlined" classNames={{ tabList: 'px-2 overflow-x-auto flex-nowrap' }}>
            <Tab key="register" title="Asset register">
              <div className="p-4 overflow-x-auto">
                <Table aria-label="PPE register" removeWrapper classNames={{ th: 'text-xs' }}>
                  <TableHeader>
                    <TableColumn>CODE</TableColumn>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>CAP/EXP</TableColumn>
                    <TableColumn className="text-right">COST</TableColumn>
                    <TableColumn className="text-right">ACCUM DEP</TableColumn>
                    <TableColumn className="text-right">NBV</TableColumn>
                    <TableColumn className="text-right">GRA WDV</TableColumn>
                    <TableColumn className="text-right">GRA CA YR</TableColumn>
                    <TableColumn>REMAINING</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No assets — add your first PPE item.">
                    {computedRows.map(({ asset, category, computed }) => (
                      <TableRow key={asset.id}>
                        <TableCell><span className="font-mono text-xs">{asset.assetCode}</span></TableCell>
                        <TableCell><div className="font-medium text-sm">{asset.assetName}</div><div className="text-xs text-gray-400">{asset.purchaseDate.slice(0, 10)}</div></TableCell>
                        <TableCell><div className="text-xs">{category.name}</div><div className="text-[10px] text-gray-400">{category.graClass}</div></TableCell>
                        <TableCell><Chip size="sm" variant="flat" color={asset.capExp === 'Capitalise' ? 'success' : asset.capExp === 'Expense' ? 'default' : 'warning'}>{asset.capExp}</Chip></TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(computed.totalCost)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(computed.accumDep)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(computed.nbv)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(computed.graWdvCurrent)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(computed.graCaThisYear)}</TableCell>
                        <TableCell className="text-xs">{computed.remainingLife?.display || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="light" onPress={() => openEdit(asset)}>Edit</Button>
                            <Button size="sm" variant="light" color="danger" onPress={() => {
                              if (confirm(`Delete "${asset.assetName}" (${asset.assetCode})? This cannot be undone.`)) {
                                deleteAsset(asset.id);
                              }
                            }}>Del</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="fs" title="FS Summary §4">
              <div className="p-4">
                <PpeSummaryPivotTable
                  title="FS Summary — Section 4 (PPE)"
                  reportDate={reportDate}
                  exportBasename="ppe_fs_summary"
                  rowLabelHeader="Line"
                  rows={FS_PIVOT_ROWS}
                  columns={[...PRESENTATION_GROUPS, 'TOTAL']}
                  columnLabels={FS_COLUMN_LABELS}
                  totalKey="TOTAL"
                  values={fsPivotValues}
                />
              </div>
            </Tab>

            <Tab key="gra" title="GRA rollforward">
              <div className="p-4">
                <PpeSummaryPivotTable
                  title="GRA capital allowance rollforward"
                  reportDate={reportDate}
                  exportBasename="ppe_gra_rollforward"
                  rowLabelHeader="Movement"
                  rows={GRA_PIVOT_ROWS}
                  columns={[...GRA_CLASSES, 'TOTAL']}
                  columnLabels={GRA_COLUMN_LABELS}
                  totalKey="TOTAL"
                  values={graPivotValues}
                />
              </div>
            </Tab>

            <Tab key="disposals" title="Disposals">
              <div className="p-4 overflow-x-auto">
                <Table aria-label="Disposals" removeWrapper>
                  <TableHeader>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>ASSET</TableColumn>
                    <TableColumn className="text-right">COST</TableColumn>
                    <TableColumn className="text-right">ACCUM DEP</TableColumn>
                    <TableColumn className="text-right">NBV</TableColumn>
                    <TableColumn className="text-right">PROCEEDS</TableColumn>
                    <TableColumn className="text-right">GAIN / (LOSS)</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={`No disposals in ${reportDateObj.getFullYear()}.`}>
                    {disposals.map((d, i) => (
                      <TableRow key={`${d.assetCode}-${i}`}>
                        <TableCell>{d.disposalDate.slice(0, 10)}</TableCell>
                        <TableCell><div>{d.assetName}</div><div className="text-xs font-mono">{d.assetCode}</div></TableCell>
                        <TableCell className="text-right font-mono">{fmt(d.cost)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(d.accumDep)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(d.nbvAtDisposal)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(d.proceeds)}</TableCell>
                        <TableCell className={`text-right font-mono ${(d.gainLoss ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {d.gainLoss != null ? fmt(d.gainLoss) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="categories" title="Categories">
              <div className="p-4 overflow-x-auto">
                <div className="flex justify-end mb-3">
                  <Button size="sm" color="primary" onPress={openAddCategory}>
                    Add category
                  </Button>
                </div>
                <Table aria-label="Categories" removeWrapper classNames={{ th: 'text-xs' }}>
                  <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>FS GROUP</TableColumn>
                    <TableColumn>GRA</TableColumn>
                    <TableColumn>GRA RATE</TableColumn>
                    <TableColumn>IAS</TableColumn>
                    <TableColumn>LIFE (YRS)</TableColumn>
                    <TableColumn>RESIDUAL</TableColumn>
                    <TableColumn>ASSETS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {categories.map((c: PpeCategory) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell className="text-xs">{c.presentationGroup}</TableCell>
                        <TableCell>{c.graClass}</TableCell>
                        <TableCell>{(c.graRate * 100).toFixed(0)}% {c.graMethod}</TableCell>
                        <TableCell>{c.iasMethod}{(c.iasMethod === 'RB' ? ` ${(c.iasRate * 100).toFixed(0)}%` : '')}</TableCell>
                        <TableCell>{c.usefulLifeYrs || '—'}</TableCell>
                        <TableCell>{(c.residualPct * 100).toFixed(0)}%</TableCell>
                        <TableCell>{assetCountByCategory.get(c.id) ?? 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="light" onPress={() => openEditCategory(c)}>Edit</Button>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              isDisabled={(assetCountByCategory.get(c.id) ?? 0) > 0}
                              onPress={() => handleDeleteCategory(c)}
                            >
                              Del
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>{editingId ? 'Edit asset' : 'Add asset'}</ModalHeader>
          <ModalBody>
            {formError && <Alert color="warning" className="mb-3">{formError}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Asset code" value={form.assetCode} onValueChange={(v) => setForm({ ...form, assetCode: v })} />
              <Input label="Asset name" value={form.assetName} onValueChange={(v) => setForm({ ...form, assetName: v })} />
              <Input type="date" label="Purchase date" value={form.purchaseDate} onValueChange={(v) => setForm({ ...form, purchaseDate: v })} />
              <Select label="Category" selectedKeys={[form.categoryId]} onSelectionChange={(k) => setForm({ ...form, categoryId: Array.from(k)[0] as string })}>
                {categories.map((c) => <SelectItem key={c.id}>{c.name}</SelectItem>)}
              </Select>
              <Input type="number" label="Quantity" value={String(form.quantity)} onValueChange={(v) => setForm({ ...form, quantity: Number(v) || 0 })} />
              <Input type="number" label="Unit price (GHS)" value={String(form.unitPrice)} onValueChange={(v) => setForm({ ...form, unitPrice: Number(v) || 0 })} />
              <Select label="Capitalise / Expense" selectedKeys={[form.capExp]} onSelectionChange={(k) => setForm({ ...form, capExp: Array.from(k)[0] as CapExpStatus })}>
                {CAP_EXP_OPTIONS.map((o) => <SelectItem key={o}>{o}</SelectItem>)}
              </Select>
              {form.capExp === 'Disposed' && (
                <>
                  <Input type="date" label="Disposal date" value={form.disposalDate} onValueChange={(v) => setForm({ ...form, disposalDate: v })} />
                  <Input type="number" label="Disposal proceeds" value={form.disposalProceeds} onValueChange={(v) => setForm({ ...form, disposalProceeds: v })} />
                </>
              )}
              {!editingId && form.capExp === 'Capitalise' && (
                <>
                  <Select label="Credit GL on acquisition" selectedKeys={[form.paymentGlCode]} onSelectionChange={(k) => setForm({ ...form, paymentGlCode: Array.from(k)[0] as string })}>
                    <SelectItem key="2200">2200 — Accounts Payable</SelectItem>
                    <SelectItem key="1000">1000 — Cash</SelectItem>
                    <SelectItem key="1100">1100 — Bank</SelectItem>
                  </Select>
                  <div className="col-span-2">
                    <Checkbox isSelected={form.postToLedger} onValueChange={(v) => setForm({ ...form, postToLedger: v })}>
                      Post to ledger (Dr 1510 / Cr selected account) — {fmt(form.quantity * form.unitPrice)}
                    </Checkbox>
                  </div>
                </>
              )}
              {form.categoryId && (
                <div className="col-span-2 text-xs text-gray-500 rounded-md bg-slate-50 p-2 border">
                  {(() => {
                    const c = categoryById.get(form.categoryId);
                    if (!c) return null;
                    return (
                      <>
                        <strong>{c.presentationGroup}</strong> · GRA {c.graClass} {(c.graRate * 100).toFixed(0)}% {c.graMethod}
                        {' · '}IAS {c.iasMethod}{c.iasMethod === 'SL' ? ` ${c.usefulLifeYrs}yr` : ` ${(c.iasRate * 100).toFixed(0)}%`}
                        {' · '}Residual {(c.residualPct * 100).toFixed(0)}%
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={handleSave}>{editingId ? 'Save' : 'Save asset'}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCategoryOpen} onClose={onCategoryClose} size="2xl">
        <ModalContent>
          <ModalHeader>{editingCategoryId ? 'Edit category' : 'Add category'}</ModalHeader>
          <ModalBody>
            {categoryFormError && <Alert color="warning" className="mb-3">{categoryFormError}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Name"
                className="col-span-2"
                value={categoryForm.name}
                onValueChange={(v) => setCategoryForm({ ...categoryForm, name: v })}
              />
              <Select
                label="FS presentation group"
                className="col-span-2"
                selectedKeys={[categoryForm.presentationGroup]}
                onSelectionChange={(k) =>
                  setCategoryForm({ ...categoryForm, presentationGroup: Array.from(k)[0] as PresentationGroup })
                }
              >
                {PRESENTATION_GROUPS.map((g) => (
                  <SelectItem key={g}>{g}</SelectItem>
                ))}
              </Select>
              <Select
                label="GRA class"
                selectedKeys={[categoryForm.graClass]}
                onSelectionChange={(k) =>
                  setCategoryForm({ ...categoryForm, graClass: Array.from(k)[0] as GraClass })
                }
              >
                {GRA_CLASSES.map((c) => (
                  <SelectItem key={c}>{c}</SelectItem>
                ))}
              </Select>
              <Input
                type="number"
                label="GRA rate (%)"
                value={categoryForm.graRatePct}
                onValueChange={(v) => setCategoryForm({ ...categoryForm, graRatePct: v })}
              />
              <Select
                label="GRA method"
                selectedKeys={[categoryForm.graMethod]}
                onSelectionChange={(k) =>
                  setCategoryForm({ ...categoryForm, graMethod: Array.from(k)[0] as GraMethod })
                }
              >
                {GRA_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m}>{m === 'SL' ? 'Straight line (SL)' : 'Reducing balance (RB)'}</SelectItem>
                ))}
              </Select>
              <Select
                label="IAS method"
                selectedKeys={[categoryForm.iasMethod]}
                onSelectionChange={(k) =>
                  setCategoryForm({ ...categoryForm, iasMethod: Array.from(k)[0] as IasMethod })
                }
              >
                {IAS_METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m}>{m === 'SL' ? 'Straight line (SL)' : 'Reducing balance (RB)'}</SelectItem>
                ))}
              </Select>
              {categoryForm.iasMethod === 'RB' ? (
                <Input
                  type="number"
                  label="IAS rate (%)"
                  value={categoryForm.iasRatePct}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, iasRatePct: v })}
                />
              ) : (
                <Input
                  type="number"
                  label="Useful life (years)"
                  value={categoryForm.usefulLifeYrs}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, usefulLifeYrs: v })}
                  description={categoryForm.presentationGroup === 'Land' ? 'Use 0 for land' : undefined}
                />
              )}
              {categoryForm.iasMethod === 'SL' && (
                <Input
                  type="number"
                  label="Residual value (%)"
                  value={categoryForm.residualPct}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, residualPct: v })}
                />
              )}
              {categoryForm.iasMethod === 'RB' && (
                <>
                  <Input
                    type="number"
                    label="Useful life (years)"
                    value={categoryForm.usefulLifeYrs}
                    onValueChange={(v) => setCategoryForm({ ...categoryForm, usefulLifeYrs: v })}
                    description="For remaining-life display"
                  />
                  <Input
                    type="number"
                    label="Residual value (%)"
                    value={categoryForm.residualPct}
                    onValueChange={(v) => setCategoryForm({ ...categoryForm, residualPct: v })}
                  />
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onCategoryClose}>Cancel</Button>
            <Button color="primary" onPress={handleSaveCategory}>
              {editingCategoryId ? 'Save changes' : 'Add category'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
