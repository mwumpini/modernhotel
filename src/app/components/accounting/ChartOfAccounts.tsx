'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card, CardBody, Input, Select, SelectItem, Button, Spinner, Alert,
} from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { buildCoaTree, subtreeMatchesFilter } from '@/app/lib/accounting/coaTree';
import { toRollupCoa } from '@/app/lib/accounting/coaHierarchy';
import { coaLevelLabel } from '@/app/lib/accounting/prebuiltChartOfAccounts';
import {
  buildFinancialAccountTree,
  type AccountNode,
} from '@/app/lib/accounting/financialReportRollup';
import { COA_ACCOUNT_TYPES, type CoaAccountType, type CoaTreeNode } from '@/app/lib/accounting/models';

function flattenBalances(nodes: AccountNode[], out = new Map<string, number>()): Map<string, number> {
  for (const n of nodes) {
    out.set(n.code, Number.isFinite(n.balance) ? n.balance : 0);
    flattenBalances(n.children, out);
  }
  return out;
}

function formatCoaBalance(amount: number, currency = 'GHS'): string {
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return '—';
  const prefix = amount < 0 ? '(' : '';
  const suffix = amount < 0 ? ')' : '';
  const abs = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${prefix}${currency} ${abs}${suffix}`;
}

const TYPE_PILL: Record<string, string> = {
  Asset: 'bg-[#E6F1FB] text-[#185FA5] dark:bg-[#0C447C] dark:text-[#B5D4F4]',
  Liability: 'bg-[#FAEEDA] text-[#854F0B] dark:bg-[#633806] dark:text-[#FAC775]',
  Equity: 'bg-[#EEEDFE] text-[#534AB7] dark:bg-[#3C3489] dark:text-[#CECBF6]',
  Revenue: 'bg-[#EAF3DE] text-[#3B6D11] dark:bg-[#27500A] dark:text-[#C0DD97]',
  'Cost of Sales': 'bg-[#FAECE7] text-[#993C1D] dark:bg-[#712B13] dark:text-[#F5C4B3]',
  'Operating Expense': 'bg-[#FBEAF0] text-[#993556] dark:bg-[#72243E] dark:text-[#F4C0D1]',
  Contra: 'bg-[#F1EFE8] text-[#5F5E5A] dark:bg-[#444441] dark:text-[#D3D1C7]',
};

type AddingAt = { parentId: string; inheritType: CoaAccountType } | { parentId: null; inheritType: CoaAccountType };

function TypePill({ type }: { type: string }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${TYPE_PILL[type] ?? TYPE_PILL.Asset}`}>
      {type}
    </span>
  );
}

function InlineAddForm({
  inheritType,
  isChild,
  onCommit,
  onCancel,
}: {
  inheritType: CoaAccountType;
  /** A child account can't hold a different fundamental type than its parent — mixing types
   *  breaks the parent's rollup total (financialReportRollup.ts sums children by assuming they
   *  share the parent's normal balance side). Locked to `inheritType` when true. */
  isChild?: boolean;
  onCommit: (name: string, type: CoaAccountType, code?: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<CoaAccountType>(inheritType);

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCommit(trimmed, isChild ? inheritType : type, code.trim() || undefined);
  };

  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2.5 my-0.5 flex-wrap">
      <Input
        autoFocus
        size="sm"
        placeholder="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        classNames={{ input: 'text-xs font-mono', inputWrapper: 'h-7 min-h-7 w-20' }}
        className="w-20 shrink-0"
      />
      <Input
        size="sm"
        placeholder="Account name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        classNames={{ input: 'text-xs', inputWrapper: 'h-7 min-h-7' }}
        className="flex-1 min-w-[140px]"
      />
      <select
        value={isChild ? inheritType : type}
        onChange={(e) => setType(e.target.value as CoaAccountType)}
        disabled={isChild}
        title={isChild ? 'A child account keeps its parent\'s type' : undefined}
        className="text-xs h-7 px-1.5 rounded-md border border-default-200 bg-content1 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {COA_ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <Button size="sm" color="primary" className="h-7 min-w-0 px-2.5 text-xs" onPress={commit}>
        Add
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="text-lg leading-none text-default-400 hover:text-foreground px-1"
        title="Cancel"
      >
        ×
      </button>
    </div>
  );
}

function CoaTreeNodeRow({
  node,
  depth,
  searchTerm,
  typeFilter,
  expandedIds,
  addingAt,
  onToggle,
  onStartAdd,
  onCommitAdd,
  onCancelAdd,
  onDelete,
  balanceByCode,
}: {
  node: CoaTreeNode;
  depth: number;
  searchTerm: string;
  typeFilter: string;
  expandedIds: Set<string>;
  addingAt: AddingAt | null;
  onToggle: (id: string) => void;
  onStartAdd: (parentId: string, inheritType: CoaAccountType) => void;
  onCommitAdd: (parentId: string | null, name: string, type: CoaAccountType, code?: string) => void;
  onCancelAdd: () => void;
  onDelete: (id: string, name: string) => void;
  balanceByCode: Map<string, number>;
}) {
  if (!subtreeMatchesFilter(node, searchTerm, typeFilter)) return null;

  const searching = !!searchTerm.trim() || (typeFilter && typeFilter !== 'all');
  const isAddingHere = addingAt?.parentId === node.id;
  const hasChildren = node.children.length > 0;
  const isOpen = searching || expandedIds.has(node.id) || isAddingHere;
  const nameClass = depth === 0 ? 'text-sm font-medium' : depth === 1 ? 'text-[13px] font-medium' : 'text-[13px]';
  const balance = balanceByCode.get(node.code) ?? 0;

  return (
    <div className="mb-0.5">
      <div
        className="group flex items-center gap-2 py-1.5 px-2.5 rounded-md cursor-pointer hover:bg-default-100"
        onClick={() => onToggle(node.id)}
      >
        <span style={{ width: depth * 16 }} className="shrink-0" />
        <span
          className={`text-sm text-default-400 shrink-0 transition-transform ${isOpen && (hasChildren || isAddingHere) ? 'rotate-90' : ''}`}
          aria-hidden
        >
          ›
        </span>
        <span className="font-mono text-[11px] text-default-400 shrink-0 w-10">{node.code}</span>
        <span className={`flex-1 min-w-0 truncate text-foreground ${nameClass}`}>{node.name}</span>
        <span className="text-[10px] text-default-400 shrink-0 hidden sm:inline">{coaLevelLabel(node.level)}</span>
        <TypePill type={node.type} />
        <span
          className={`text-xs font-mono tabular-nums shrink-0 w-32 text-right ${
            balance < 0 ? 'text-danger' : balance > 0 ? 'text-foreground' : 'text-default-400'
          }`}
          title="Rolled-up balance (includes child accounts)"
        >
          {formatCoaBalance(balance, node.currency)}
        </span>
        <button
          type="button"
          className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-default-400 text-foreground/80 bg-default-100/60 hover:bg-default-200 hover:text-foreground dark:border-default-500 dark:bg-default-100/10 dark:text-default-300 dark:hover:bg-default-100/20 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onStartAdd(node.id, node.type);
          }}
        >
          + add child
        </button>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 text-default-400 hover:text-danger text-sm px-1 rounded shrink-0 transition-opacity"
          title="Delete account and all children"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id, node.name);
          }}
        >
          🗑
        </button>
      </div>

      {isOpen && (hasChildren || isAddingHere) && (
        <div className="ml-5 border-l border-default-200 pl-2.5 mt-0.5 mb-0.5">
          {node.children.map((child) => (
            <CoaTreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              searchTerm={searchTerm}
              typeFilter={typeFilter}
              expandedIds={expandedIds}
              addingAt={addingAt}
              onToggle={onToggle}
              onStartAdd={onStartAdd}
              onCommitAdd={onCommitAdd}
              onCancelAdd={onCancelAdd}
              onDelete={onDelete}
              balanceByCode={balanceByCode}
            />
          ))}
          {isAddingHere && addingAt && (
            <InlineAddForm
              inheritType={addingAt.inheritType}
              isChild
              onCommit={(name, type, code) => onCommitAdd(node.id, name, type, code)}
              onCancel={onCancelAdd}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccountsPage() {
  const {
    chartOfAccounts,
    journalEntries,
    isLoading,
    error,
    addCoaChild,
    deleteChartOfAccount,
  } = useAccountingStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingAt, setAddingAt] = useState<AddingAt | null>(null);
  const [rootAdding, setRootAdding] = useState(false);

  const tree = useMemo(() => buildCoaTree(chartOfAccounts), [chartOfAccounts]);

  const balanceByCode = useMemo(() => {
    const rollup = toRollupCoa(chartOfAccounts);
    const accountTree = buildFinancialAccountTree(rollup, journalEntries, {
      kind: 'cumulative',
      endDate: new Date(),
    });
    return flattenBalances(accountTree);
  }, [chartOfAccounts, journalEntries]);

  const coaTypeFilterItems = useMemo(
    () => [
      { key: 'all', label: 'All types' },
      ...COA_ACCOUNT_TYPES.map((t) => ({ key: t, label: t })),
    ],
    [],
  );

  const toggleNode = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStartAdd = useCallback((parentId: string, inheritType: CoaAccountType) => {
    setRootAdding(false);
    setAddingAt({ parentId, inheritType });
    setExpandedIds((prev) => new Set(prev).add(parentId));
  }, []);

  const handleCommitAdd = useCallback(
    (parentId: string | null, name: string, type: CoaAccountType, code?: string) => {
      addCoaChild(parentId, { name, type, code });
      setAddingAt(null);
      setRootAdding(false);
      if (parentId) {
        setExpandedIds((prev) => new Set(prev).add(parentId));
      }
    },
    [addCoaChild]
  );

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!confirm(`Delete "${name}" and all its child accounts?`)) return;
      deleteChartOfAccount(id);
    },
    [deleteChartOfAccount]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Chart of Accounts</h1>
        <p className="text-default-500 text-sm mt-1">
          Prebuilt Ghana hotel GL with coded main, sub, and detail accounts — keep, delete, or add your own.
        </p>
      </div>

      {error && (
        <Alert color="danger" className="mb-4">{error}</Alert>
      )}

      <Card className="mb-4 w-full">
        <CardBody className="gap-3">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Search by name or code…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="sm"
              className="flex-1"
              startContent={<span className="text-default-400 text-sm">🔍</span>}
            />
            <Select
              size="sm"
              selectedKeys={[filterType]}
              onSelectionChange={(keys) => setFilterType(Array.from(keys)[0] as string)}
              className="w-44"
              aria-label="Filter by type"
              items={coaTypeFilterItems}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>
          </div>
          <Button
            size="sm"
            variant="bordered"
            onPress={() => {
              setAddingAt(null);
              setRootAdding(true);
            }}
          >
            + Add top-level account
          </Button>
        </CardBody>
      </Card>

      <Card className="w-full">
        <CardBody className="py-3">
          {tree.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 pb-2 mb-1 border-b border-default-200 text-[10px] font-medium uppercase tracking-wide text-default-400">
              <span className="w-4 shrink-0" />
              <span className="w-10 shrink-0">Code</span>
              <span className="flex-1 min-w-0">Account</span>
              <span className="w-12 shrink-0 hidden sm:inline">Level</span>
              <span className="w-24 shrink-0">Type</span>
              <span className="w-32 shrink-0 text-right">Balance</span>
              <span className="w-[148px] shrink-0" />
            </div>
          )}
          {tree.length === 0 && !rootAdding ? (
            <p className="text-sm text-default-400 px-2.5 py-2">
              No accounts loaded. Open Accounting to initialize the prebuilt chart, or add a top-level account.
            </p>
          ) : (
            <>
              {tree.map((node) => (
                <CoaTreeNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  searchTerm={searchTerm}
                  typeFilter={filterType}
                  expandedIds={expandedIds}
                  addingAt={addingAt}
                  onToggle={toggleNode}
                  onStartAdd={handleStartAdd}
                  onCommitAdd={handleCommitAdd}
                  onCancelAdd={() => setAddingAt(null)}
                  onDelete={handleDelete}
                  balanceByCode={balanceByCode}
                />
              ))}
              {rootAdding && (
                <InlineAddForm
                  inheritType="Asset"
                  onCommit={(name, type, code) => handleCommitAdd(null, name, type, code)}
                  onCancel={() => setRootAdding(false)}
                />
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
