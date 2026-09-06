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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import { usePpeRegisterStore } from '@/app/lib/accounting/ppeStore';
import { useAccountingStore } from '@/app/lib/accounting/store';
import {
  capturePpeCapitalization,
  postPpeDisposalIfNeeded,
  reconcilePpeToLedger,
  type PpeSyncResult,
} from '@/app/lib/accounting/ppe/ledgerSync';
import AttachmentUpload from '@/app/components/shared/AttachmentUpload';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
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
import { DEFAULT_ORG_ID, PRESENTATION_GROUP_PREFIX } from '@/app/lib/accounting/ppe/categories';
import BankAccountOptionLabel from '@/app/components/shared/BankAccountOptionLabel';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';

// formatAccountingCurrency always shows a magnitude, so the sign (disposal gain/loss
// can be negative) is reattached in front of it here.
const fmt = (n: number) => (n < 0 ? '-' : '') + formatAccountingCurrency(n);
// Table cells: the ₵ sign is in the column header once, not repeated on every row.
const fmtNum = (n: number) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });


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
  disposalProceedsBankAccountId: '',
  postToLedger: true,
  paymentGlCode: '2200',
  attachments: [] as string[],
};

const defaultCategoryForm = {
  name: '',
  codePrefix: '',
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
    setLedgerAccumDepPosted,
    setDisposalJournalId,
    upsertCategory,
    deleteCategory,
    initializePpeRegister,
    clearError,
  } = usePpeRegisterStore();
  const { initializeAccounting, journalEntries, chartOfAccounts, bankAccounts } = useAccountingStore();
  const activeBankAccounts = useMemo(() => bankAccounts.filter((b) => b.isActive), [bankAccounts]);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [categoryFieldErrors, setCategoryFieldErrors] = useState<Record<string, string>>({});
  const [syncResult, setSyncResult] = useState<PpeSyncResult | null>(null);
  const [assetCodeTouched, setAssetCodeTouched] = useState(false);

  const prefixForCategory = (cat: PpeCategory | undefined) =>
    cat?.codePrefix?.trim() || (cat?.presentationGroup && PRESENTATION_GROUP_PREFIX[cat.presentationGroup]) || 'CA';

  const nextAssetCodeForCategory = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    const prefix = prefixForCategory(cat);
    // Sequence within whatever shares this prefix (category or its whole presentation group,
    // for categories still on the default prefix), not just this one category.
    const countSharingPrefix = assets.filter(
      (a) => prefixForCategory(categories.find((c) => c.id === a.categoryId)) === prefix
    ).length;
    return `${prefix}-${String(countSharingPrefix + 1).padStart(3, '0')}`;
  };

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
    setForm({ ...defaultForm, assetCode: nextAssetCodeForCategory(defaultForm.categoryId) });
    setAssetCodeTouched(false);
    setFormError(null);
    setFieldErrors({});
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
      disposalProceedsBankAccountId: asset.disposalProceedsBankAccountId || activeBankAccounts[0]?.id || '',
      postToLedger: false,
      paymentGlCode: '2200',
      attachments: asset.attachments || [],
    });
    setAssetCodeTouched(true);
    setFormError(null);
    setFieldErrors({});
    onOpen();
  };

  const validateAssetForm = (f: typeof form) => {
    const errs: Record<string, string> = {};
    if (!f.assetCode.trim()) errs.assetCode = 'Asset code is required';
    if (!f.assetName.trim()) errs.assetName = 'Asset name is required';
    if (!f.purchaseDate) errs.purchaseDate = 'Purchase date is required';
    if (!f.categoryId) errs.categoryId = 'Category is required';
    if (!f.quantity || f.quantity <= 0) errs.quantity = 'Quantity must be greater than 0';
    if (!f.unitPrice || f.unitPrice <= 0) errs.unitPrice = 'Unit price must be greater than 0';
    if (f.capExp === 'Disposed') {
      if (!f.disposalDate) errs.disposalDate = 'Disposal date is required';
      else if (f.disposalDate < f.purchaseDate) errs.disposalDate = 'Disposal date cannot be before purchase date';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    setFormError(null);
    if (!validateAssetForm(form)) return;
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
      disposalProceedsBankAccountId: form.capExp === 'Disposed' ? form.disposalProceedsBankAccountId || undefined : undefined,
      attachments: form.attachments,
    };

    if (editingId) {
      const wasDisposedPosted = !!assets.find((a) => a.id === editingId)?.disposalJournalEntryId;
      if (updateAsset(editingId, payload)) {
        const after = usePpeRegisterStore.getState().assets.find((a) => a.id === editingId);
        if (form.capExp === 'Disposed' && !wasDisposedPosted) {
          setNotice(
            after?.disposalJournalEntryId
              ? 'Asset updated and disposed — cost/accum. dep written off and gain/(loss) posted. See the Disposals tab.'
              : 'Asset updated (ledger posting failed — use Sync to ledger).'
          );
        } else {
          setNotice('Asset updated.');
        }
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
      const isApPayment = form.paymentGlCode === '2200';
      const result = capturePpeCapitalization({
        ppeAssetId: created.id,
        assetCode: created.assetCode,
        name: created.assetName,
        purchaseDate: created.purchaseDate,
        cost,
        paymentGlCode: isApPayment ? '2200' : undefined,
        paymentBankAccountId: isApPayment ? undefined : form.paymentGlCode,
      });
      if (result) {
        setCapitalizationJournalId(created.id, result.journalEntryId);
        void initializeAccounting();
        setNotice(`Asset saved and capitalized — JE ${result.journalEntryId}`);
      } else {
        setNotice('Asset saved (ledger posting failed — use Sync to ledger).');
      }
    } else if (form.capExp === 'Disposed') {
      const category = categories.find((c) => c.id === created.categoryId);
      const result = category
        ? postPpeDisposalIfNeeded(created, category, {
            setLedgerAccumDepPosted,
            setDisposalJournalId,
          })
        : null;
      void initializeAccounting();
      if (result?.ok) {
        setNotice(`Asset saved and disposed — gain/(loss) ${result.gainLoss?.toFixed(2)}.`);
      } else {
        setNotice(`Asset saved (ledger posting failed${result?.error ? `: ${result.error}` : ''} — use Sync to ledger).`);
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
    setCategoryFieldErrors({});
    onCategoryOpen();
  };

  const openEditCategory = (category: PpeCategory) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      codePrefix: category.codePrefix || '',
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
    setCategoryFieldErrors({});
    onCategoryOpen();
  };

  const validateCategoryForm = (cf: typeof categoryForm) => {
    const errs: Record<string, string> = {};
    if (!cf.name.trim()) errs.name = 'Category name is required';
    const graRate = Number(cf.graRatePct);
    if (Number.isNaN(graRate) || graRate < 0 || graRate > 100) errs.graRatePct = 'GRA rate must be between 0% and 100%';
    const residual = Number(cf.residualPct);
    if (Number.isNaN(residual) || residual < 0 || residual > 100) errs.residualPct = 'Residual value must be between 0% and 100%';
    const life = Number(cf.usefulLifeYrs);
    const isLand = cf.presentationGroup === 'Land';
    if (!isLand && (Number.isNaN(life) || life < 0)) errs.usefulLifeYrs = 'Useful life cannot be negative';
    if (cf.iasMethod === 'RB') {
      const iasRate = Number(cf.iasRatePct);
      if (Number.isNaN(iasRate) || iasRate <= 0 || iasRate > 100) errs.iasRatePct = 'IAS rate is required for declining balance (0–100%)';
    } else if (!isLand && !life) {
      errs.usefulLifeYrs = 'Useful life (years) is required for straight-line IAS';
    }
    setCategoryFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveCategory = () => {
    setCategoryFormError(null);
    if (!validateCategoryForm(categoryForm)) return;
    const graRate = Number(categoryForm.graRatePct) / 100;
    const iasRate = Number(categoryForm.iasRatePct) / 100;
    const usefulLifeYrs = Number(categoryForm.usefulLifeYrs);
    const residualPct = Number(categoryForm.residualPct) / 100;

    const category: PpeCategory = {
      id: editingCategoryId ?? `cat-${Date.now()}`,
      name: categoryForm.name.trim(),
      codePrefix: categoryForm.codePrefix.trim().toUpperCase() || undefined,
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

  const glRecon = useMemo(
    () => reconcilePpeToLedger(assets, categories, journalEntries, chartOfAccounts, reportDate),
    [assets, categories, journalEntries, chartOfAccounts, reportDate]
  );

  const handleSyncToLedger = () => {
    const result = usePpeRegisterStore.getState().syncToLedger();
    void initializeAccounting();
    setSyncResult(result);
  };

  const exportAssetsCSV = () => {
    downloadCSV(
      computedRows.map(({ asset, category, computed }) => ({
        code: asset.assetCode,
        name: asset.assetName,
        category: category.name,
        capExp: asset.capExp,
        cost: computed.totalCost.toFixed(2),
        accumDep: computed.accumDep.toFixed(2),
        nbv: computed.nbv.toFixed(2),
        graWdv: computed.graWdvCurrent.toFixed(2),
        graCaYr: computed.graCaThisYear.toFixed(2),
        remaining: computed.remainingLife?.display || '',
      })),
      'ppe_asset_register',
      [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        { key: 'capExp', label: 'Cap/Exp' },
        { key: 'cost', label: 'Cost' },
        { key: 'accumDep', label: 'Accum Dep' },
        { key: 'nbv', label: 'NBV' },
        { key: 'graWdv', label: 'GRA WDV' },
        { key: 'graCaYr', label: 'GRA CA Yr' },
        { key: 'remaining', label: 'Remaining Life' },
      ]
    );
  };

  const printAssetsPDF = () => {
    const rows = computedRows.map(({ asset, category, computed }) => `<tr>
      <td>${asset.assetCode}</td>
      <td>${asset.assetName}</td>
      <td>${category.name}</td>
      <td><span class="badge ${asset.capExp === 'Capitalise' ? 'badge-success' : asset.capExp === 'Expense' ? 'badge-info' : 'badge-warning'}">${asset.capExp}</span></td>
      <td class="amount">${fmt(computed.totalCost)}</td>
      <td class="amount">${fmt(computed.accumDep)}</td>
      <td class="amount">${fmt(computed.nbv)}</td>
      <td class="amount">${fmt(computed.graWdvCurrent)}</td>
      <td class="amount">${fmt(computed.graCaThisYear)}</td>
    </tr>`).join('');
    const html = generatePdfHtml('PPE Asset Register', `
      <div class="header">
        <h1>🏗️ PPE Asset Register</h1>
        <div class="subtitle">As at ${reportDate} — Generated on ${new Date().toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Total Cost</div><div class="meta-value">${fmt(totals.cost)}</div></div>
        <div class="meta-item"><div class="meta-label">Accum. Dep</div><div class="meta-value">${fmt(totals.dep)}</div></div>
        <div class="meta-item"><div class="meta-label">Net Book Value</div><div class="meta-value">${fmt(totals.nbv)}</div></div>
        <div class="meta-item"><div class="meta-label">GRA Closing WDV</div><div class="meta-value">${fmt(totals.graWdv)}</div></div>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Cap/Exp</th><th>Cost</th><th>Accum Dep</th><th>NBV</th><th>GRA WDV</th><th>GRA CA Yr</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'PPE Asset Register');
    openPrintPreview(html);
  };

  const exportDisposalsCSV = () => {
    downloadCSV(
      disposals.map((d) => ({
        date: d.disposalDate.slice(0, 10),
        code: d.assetCode,
        name: d.assetName,
        cost: d.cost.toFixed(2),
        accumDep: d.accumDep.toFixed(2),
        nbv: d.nbvAtDisposal.toFixed(2),
        proceeds: d.proceeds.toFixed(2),
        gainLoss: d.gainLoss != null ? d.gainLoss.toFixed(2) : '',
      })),
      'ppe_disposals',
      [
        { key: 'date', label: 'Date' },
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'cost', label: 'Cost' },
        { key: 'accumDep', label: 'Accum Dep' },
        { key: 'nbv', label: 'NBV' },
        { key: 'proceeds', label: 'Proceeds' },
        { key: 'gainLoss', label: 'Gain/(Loss)' },
      ]
    );
  };

  const printDisposalsPDF = () => {
    const rows = disposals.map((d) => `<tr>
      <td>${d.disposalDate.slice(0, 10)}</td>
      <td>${d.assetName}<div style="font-size:10px;color:#888">${d.assetCode}</div></td>
      <td class="amount">${fmt(d.cost)}</td>
      <td class="amount">${fmt(d.accumDep)}</td>
      <td class="amount">${fmt(d.nbvAtDisposal)}</td>
      <td class="amount">${fmt(d.proceeds)}</td>
      <td class="amount">${d.gainLoss != null ? fmt(d.gainLoss) : '—'}</td>
    </tr>`).join('');
    const html = generatePdfHtml('PPE Disposals', `
      <div class="header">
        <h1>🏗️ PPE Disposals — ${reportDateObj.getFullYear()}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Asset</th><th>Cost</th><th>Accum Dep</th><th>NBV</th><th>Proceeds</th><th>Gain/(Loss)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'PPE Asset Register');
    openPrintPreview(html);
  };

  const exportCategoriesCSV = () => {
    downloadCSV(
      categories.map((c) => ({
        name: c.name,
        fsGroup: c.presentationGroup,
        graClass: c.graClass,
        graRate: `${(c.graRate * 100).toFixed(0)}% ${c.graMethod}`,
        iasMethod: c.iasMethod,
        life: c.usefulLifeYrs || '',
        residual: `${(c.residualPct * 100).toFixed(0)}%`,
        assets: assetCountByCategory.get(c.id) ?? 0,
      })),
      'ppe_categories',
      [
        { key: 'name', label: 'Name' },
        { key: 'fsGroup', label: 'FS Group' },
        { key: 'graClass', label: 'GRA Class' },
        { key: 'graRate', label: 'GRA Rate' },
        { key: 'iasMethod', label: 'IAS Method' },
        { key: 'life', label: 'Life (Yrs)' },
        { key: 'residual', label: 'Residual' },
        { key: 'assets', label: 'Assets' },
      ]
    );
  };

  const printCategoriesPDF = () => {
    const rows = categories.map((c) => `<tr>
      <td>${c.name}</td>
      <td>${c.presentationGroup}</td>
      <td>${c.graClass}</td>
      <td>${(c.graRate * 100).toFixed(0)}% ${c.graMethod}</td>
      <td>${c.iasMethod}</td>
      <td>${c.usefulLifeYrs || '—'}</td>
      <td>${(c.residualPct * 100).toFixed(0)}%</td>
      <td class="amount">${assetCountByCategory.get(c.id) ?? 0}</td>
    </tr>`).join('');
    const html = generatePdfHtml('PPE Categories', `
      <div class="header">
        <h1>🏗️ PPE Categories</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>FS Group</th><th>GRA Class</th><th>GRA Rate</th><th>IAS</th><th>Life (Yrs)</th><th>Residual</th><th>Assets</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, 'PPE Asset Register');
    openPrintPreview(html);
  };

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

      {syncResult && (
        <Alert
          color={syncResult.errors.length ? 'warning' : 'success'}
          className="mb-4"
          onClose={() => setSyncResult(null)}
        >
          {syncResult.errors.length
            ? `${syncResult.messages.length} posted, ${syncResult.errors.length} failed: ${syncResult.errors.join('; ')}`
            : syncResult.messages.length
              ? syncResult.messages.join(' · ')
              : 'Already in sync with the ledger — nothing to post.'}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <Chip size="sm" variant="flat" color={glRecon.inSync ? 'success' : 'warning'}>
          GL 1510/1520 {glRecon.inSync ? 'in sync' : `gap ₵${Math.abs(glRecon.costGap).toFixed(2)} cost / ₵${Math.abs(glRecon.accumDepGap).toFixed(2)} dep`}
        </Chip>
        {glRecon.uncapitalizedCount > 0 && (
          <Chip size="sm" variant="flat" color="warning">{glRecon.uncapitalizedCount} not yet capitalized</Chip>
        )}
        {glRecon.pendingDisposalCount > 0 && (
          <Chip size="sm" variant="flat" color="warning">{glRecon.pendingDisposalCount} disposal(s) pending GL post</Chip>
        )}
        {glRecon.depPostingGap > 0.01 && (
          <Chip size="sm" variant="flat" color="warning">₵{glRecon.depPostingGap.toFixed(2)} depreciation not yet posted</Chip>
        )}
        {!glRecon.inSync && (
          <Button size="sm" variant="bordered" onPress={handleSyncToLedger}>🔄 Sync to ledger</Button>
        )}
      </div>

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
                <div className="flex justify-end mb-3">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="bordered">📥 Export</Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportAssetsCSV}>CSV spreadsheet</DropdownItem>
                      <DropdownItem key="pdf" onPress={printAssetsPDF}>📑 Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
                <Table aria-label="PPE register" removeWrapper classNames={{ th: 'text-xs' }}>
                  <TableHeader>
                    <TableColumn>CODE</TableColumn>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>CAP/EXP</TableColumn>
                    <TableColumn className="text-right">COST (₵)</TableColumn>
                    <TableColumn className="text-right">ACCUM DEP (₵)</TableColumn>
                    <TableColumn className="text-right">NBV (₵)</TableColumn>
                    <TableColumn className="text-right">GRA WDV (₵)</TableColumn>
                    <TableColumn className="text-right">GRA CA YR (₵)</TableColumn>
                    <TableColumn>REMAINING</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No assets — add your first PPE item.">
                    {computedRows.map(({ asset, category, computed }) => (
                      <TableRow key={asset.id}>
                        <TableCell><span className="font-mono text-xs">{asset.assetCode}</span></TableCell>
                        <TableCell>
                          <div className="font-medium text-sm inline-flex items-center gap-1">
                            {asset.assetName}
                            {!!asset.attachments?.length && <span title={`${asset.attachments.length} attachment(s)`}>📎</span>}
                          </div>
                          <div className="text-xs text-gray-400">{asset.purchaseDate.slice(0, 10)}</div>
                        </TableCell>
                        <TableCell><div className="text-xs">{category.name}</div><div className="text-[10px] text-gray-400">{category.graClass}</div></TableCell>
                        <TableCell><Chip size="sm" variant="flat" color={asset.capExp === 'Capitalise' ? 'success' : asset.capExp === 'Expense' ? 'default' : 'warning'}>{asset.capExp}</Chip></TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNum(computed.totalCost)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNum(computed.accumDep)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNum(computed.nbv)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNum(computed.graWdvCurrent)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNum(computed.graCaThisYear)}</TableCell>
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
                <div className="flex justify-end mb-3">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="bordered">📥 Export</Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportDisposalsCSV}>CSV spreadsheet</DropdownItem>
                      <DropdownItem key="pdf" onPress={printDisposalsPDF}>📑 Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
                <Table aria-label="Disposals" removeWrapper>
                  <TableHeader>
                    <TableColumn>DATE</TableColumn>
                    <TableColumn>ASSET</TableColumn>
                    <TableColumn className="text-right">COST (₵)</TableColumn>
                    <TableColumn className="text-right">ACCUM DEP (₵)</TableColumn>
                    <TableColumn className="text-right">NBV (₵)</TableColumn>
                    <TableColumn className="text-right">PROCEEDS (₵)</TableColumn>
                    <TableColumn className="text-right">GAIN / (LOSS) (₵)</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={`No disposals in ${reportDateObj.getFullYear()}.`}>
                    {disposals.map((d, i) => (
                      <TableRow key={`${d.assetCode}-${i}`}>
                        <TableCell>{d.disposalDate.slice(0, 10)}</TableCell>
                        <TableCell><div>{d.assetName}</div><div className="text-xs font-mono">{d.assetCode}</div></TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(d.cost)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(d.accumDep)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(d.nbvAtDisposal)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(d.proceeds)}</TableCell>
                        <TableCell className={`text-right font-mono ${(d.gainLoss ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {d.gainLoss != null ? fmtNum(d.gainLoss) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="categories" title="Categories">
              <div className="p-4 overflow-x-auto">
                <div className="flex justify-end gap-2 mb-3">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="bordered">📥 Export</Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                      <DropdownItem key="csv" onPress={exportCategoriesCSV}>CSV spreadsheet</DropdownItem>
                      <DropdownItem key="pdf" onPress={printCategoriesPDF}>📑 Print PDF</DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
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
              <div>
                <Input
                  label="Asset code"
                  isRequired
                  isInvalid={!!fieldErrors.assetCode}
                  value={form.assetCode}
                  onValueChange={(v) => {
                    setAssetCodeTouched(true);
                    setForm({ ...form, assetCode: v });
                  }}
                  description="Auto-suggested from category — edit freely"
                />
                {fieldErrors.assetCode && <div className="text-xs text-danger mt-1">{fieldErrors.assetCode}</div>}
              </div>
              <div>
                <Input label="Asset name" isRequired isInvalid={!!fieldErrors.assetName} value={form.assetName} onValueChange={(v) => setForm({ ...form, assetName: v })} />
                {fieldErrors.assetName && <div className="text-xs text-danger mt-1">{fieldErrors.assetName}</div>}
              </div>
              <div>
                <Input type="date" label="Purchase date" isRequired isInvalid={!!fieldErrors.purchaseDate} value={form.purchaseDate} onValueChange={(v) => setForm({ ...form, purchaseDate: v })} />
                {fieldErrors.purchaseDate && <div className="text-xs text-danger mt-1">{fieldErrors.purchaseDate}</div>}
              </div>
              <div>
                <Select
                  label="Category"
                  isRequired
                  isInvalid={!!fieldErrors.categoryId}
                  selectedKeys={[form.categoryId]}
                  onSelectionChange={(k) => {
                    const categoryId = Array.from(k)[0] as string;
                    setForm((f) => ({
                      ...f,
                      categoryId,
                      assetCode: assetCodeTouched ? f.assetCode : nextAssetCodeForCategory(categoryId),
                    }));
                  }}
                >
                  {categories.map((c) => <SelectItem key={c.id}>{c.name}</SelectItem>)}
                </Select>
                {fieldErrors.categoryId && <div className="text-xs text-danger mt-1">{fieldErrors.categoryId}</div>}
              </div>
              <div>
                <Input type="number" min="0" label="Quantity" isRequired isInvalid={!!fieldErrors.quantity} value={String(form.quantity)} onValueChange={(v) => setForm({ ...form, quantity: Number(v) || 0 })} />
                {fieldErrors.quantity && <div className="text-xs text-danger mt-1">{fieldErrors.quantity}</div>}
              </div>
              <div>
                <Input type="number" min="0" step="0.01" label="Unit price (GHS)" isRequired isInvalid={!!fieldErrors.unitPrice} value={String(form.unitPrice)} onValueChange={(v) => setForm({ ...form, unitPrice: Number(v) || 0 })} />
                {fieldErrors.unitPrice && <div className="text-xs text-danger mt-1">{fieldErrors.unitPrice}</div>}
              </div>
              <Select label="Capitalise / Expense" selectedKeys={[form.capExp]} onSelectionChange={(k) => setForm({ ...form, capExp: Array.from(k)[0] as CapExpStatus })}>
                {CAP_EXP_OPTIONS.map((o) => <SelectItem key={o}>{o}</SelectItem>)}
              </Select>
              {form.capExp === 'Disposed' && (
                <>
                  <div>
                    <Input type="date" label="Disposal date" isRequired isInvalid={!!fieldErrors.disposalDate} value={form.disposalDate} onValueChange={(v) => setForm({ ...form, disposalDate: v })} />
                    {fieldErrors.disposalDate && <div className="text-xs text-danger mt-1">{fieldErrors.disposalDate}</div>}
                  </div>
                  <Input type="number" min="0" step="0.01" label="Disposal proceeds" value={form.disposalProceeds} onValueChange={(v) => setForm({ ...form, disposalProceeds: v })} />
                  {Number(form.disposalProceeds) > 0 && (
                    activeBankAccounts.length ? (
                      <Select
                        label="Proceeds received into"
                        selectedKeys={form.disposalProceedsBankAccountId ? [form.disposalProceedsBankAccountId] : []}
                        onSelectionChange={(k) => setForm({ ...form, disposalProceedsBankAccountId: Array.from(k)[0] as string })}
                        description="Writes off cost/accum. dep, books the gain/(loss), and deposits the proceeds into this account"
                      >
                        {activeBankAccounts.map((b) => (
                          <SelectItem key={b.id} textValue={b.accountName}>
                            <BankAccountOptionLabel account={b} />
                          </SelectItem>
                        ))}
                      </Select>
                    ) : (
                      <div className="text-xs text-gray-500 flex items-end">No bank/cash accounts yet — add one under Bank & Cash first.</div>
                    )
                  )}
                </>
              )}
              {!editingId && form.capExp === 'Capitalise' && (
                <>
                  <Select
                    label="Paid from"
                    selectedKeys={[form.paymentGlCode]}
                    onSelectionChange={(k) => setForm({ ...form, paymentGlCode: Array.from(k)[0] as string })}
                    description="Which account settles this purchase — posts the withdrawal there too, or leaves it on account payable"
                  >
                    {[
                      <SelectItem key="2200">📋 On account (2200 — Accounts Payable)</SelectItem>,
                      ...activeBankAccounts.map((b) => (
                        <SelectItem key={b.id} textValue={b.accountName}>
                          <BankAccountOptionLabel account={b} />
                        </SelectItem>
                      )),
                    ]}
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
              <div className="col-span-2">
                <AttachmentUpload
                  label="Invoice / source document"
                  attachments={form.attachments}
                  onChange={(next) => setForm({ ...form, attachments: next })}
                />
              </div>
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
              <div className="col-span-2">
                <Input
                  label="Name"
                  isRequired
                  isInvalid={!!categoryFieldErrors.name}
                  value={categoryForm.name}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, name: v })}
                />
                {categoryFieldErrors.name && <div className="text-xs text-danger mt-1">{categoryFieldErrors.name}</div>}
              </div>
              <Input
                label="Asset code prefix"
                className="col-span-2"
                value={categoryForm.codePrefix}
                onValueChange={(v) => setCategoryForm({ ...categoryForm, codePrefix: v.toUpperCase() })}
                placeholder={(PRESENTATION_GROUP_PREFIX[categoryForm.presentationGroup] || 'CA')}
                description={`New assets in this category auto-suggest "${(categoryForm.codePrefix.trim() || PRESENTATION_GROUP_PREFIX[categoryForm.presentationGroup] || 'CA')}-001", "-002"... Leave blank to use the default for ${categoryForm.presentationGroup}.`}
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
              <div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  label="GRA rate (%)"
                  isRequired
                  isInvalid={!!categoryFieldErrors.graRatePct}
                  value={categoryForm.graRatePct}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, graRatePct: v })}
                />
                {categoryFieldErrors.graRatePct && <div className="text-xs text-danger mt-1">{categoryFieldErrors.graRatePct}</div>}
              </div>
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
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    label="IAS rate (%)"
                    isRequired
                    isInvalid={!!categoryFieldErrors.iasRatePct}
                    value={categoryForm.iasRatePct}
                    onValueChange={(v) => setCategoryForm({ ...categoryForm, iasRatePct: v })}
                  />
                  {categoryFieldErrors.iasRatePct && <div className="text-xs text-danger mt-1">{categoryFieldErrors.iasRatePct}</div>}
                </div>
              ) : (
                <div>
                  <Input
                    type="number"
                    min="0"
                    label="Useful life (years)"
                    isRequired={categoryForm.presentationGroup !== 'Land'}
                    isInvalid={!!categoryFieldErrors.usefulLifeYrs}
                    value={categoryForm.usefulLifeYrs}
                    onValueChange={(v) => setCategoryForm({ ...categoryForm, usefulLifeYrs: v })}
                    description={categoryForm.presentationGroup === 'Land' ? 'Use 0 for land' : undefined}
                  />
                  {categoryFieldErrors.usefulLifeYrs && <div className="text-xs text-danger mt-1">{categoryFieldErrors.usefulLifeYrs}</div>}
                </div>
              )}
              {categoryForm.iasMethod === 'SL' && (
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    label="Residual value (%)"
                    isRequired
                    isInvalid={!!categoryFieldErrors.residualPct}
                    value={categoryForm.residualPct}
                    onValueChange={(v) => setCategoryForm({ ...categoryForm, residualPct: v })}
                  />
                  {categoryFieldErrors.residualPct && <div className="text-xs text-danger mt-1">{categoryFieldErrors.residualPct}</div>}
                </div>
              )}
              {categoryForm.iasMethod === 'RB' && (
                <>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      label="Useful life (years)"
                      isInvalid={!!categoryFieldErrors.usefulLifeYrs}
                      value={categoryForm.usefulLifeYrs}
                      onValueChange={(v) => setCategoryForm({ ...categoryForm, usefulLifeYrs: v })}
                      description="For remaining-life display"
                    />
                    {categoryFieldErrors.usefulLifeYrs && <div className="text-xs text-danger mt-1">{categoryFieldErrors.usefulLifeYrs}</div>}
                  </div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      label="Residual value (%)"
                      isRequired
                      isInvalid={!!categoryFieldErrors.residualPct}
                      value={categoryForm.residualPct}
                      onValueChange={(v) => setCategoryForm({ ...categoryForm, residualPct: v })}
                    />
                    {categoryFieldErrors.residualPct && <div className="text-xs text-danger mt-1">{categoryFieldErrors.residualPct}</div>}
                  </div>
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
