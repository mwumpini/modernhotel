'use client';

import React, { useState, useEffect } from 'react';
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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Divider,
  Textarea,
  Switch,
  Tooltip,
  Tabs,
  Tab,
  Accordion,
  AccordionItem,
} from "@heroui/react";
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useAccountingStore } from '@/app/lib/accounting/store';
import {
  chartHasGlCode,
  resyncCountryTaxRulesToAccounting,
  removeTaxRuleFromAccounting,
  syncTaxRuleFromApiResponse,
} from '@/app/lib/accounting/taxRuleAccountingSync';
import { useCalculateTax } from '@/app/hooks/useCalculateTax';
import { TaxRule } from '@/app/lib/models';
import {
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_COUNTRIES,
  DEFAULT_COMPLIANCE_COUNTRY,
  buildTemplateRules,
  findTemplateKeyForTypeName,
  formatRulesReferenceSummary,
  getCountryDisplayName,
  getCountryQuickApply,
  getDefaultTemplatesForCountry,
  getTemplateKeys,
  getTemplateMeta,
} from '@/app/lib/compliance/config';
import { getClientTenantSubdomain } from '@/app/lib/api/clientTenant';
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain';

// Every /api/compliance/* route now requires a tenant (tax rules/types/schedules are
// tenant-scoped, not shared across every tenant on the deployment) -- these fetch calls
// previously sent no headers at all.
function taxTenantHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

interface TaxRuleForm {
  id: string;
  countryCode: string;
  name: string;
  typeId?: string;
  rate: number;
  glCode: string;
  appliesTo: string[];
  description?: string;
  isActive: boolean;
  priority?: number;
  calculationBase?: 'subtotal' | 'subtotal_plus_applied' | 'per_person' | 'per_night' | 'per_person_night';
  method?: 'rate' | 'fixed' | 'tiered';
  fixedAmount?: number;
  tiers?: Array<{ upto?: number; rate?: number; fixed?: number }>;
  stacking?: 'additive' | 'compound';
  rounding?: 'none' | 'nearest' | 'down' | 'up';
  roundTo?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  tags?: string[];
  domain?: 'sales' | 'payroll' | 'corporate' | 'custom';
  operation?: 'internal' | 'external' | 'both';
  effect?: 'add' | 'subtract' | 'exclude_total' | 'informational';
  // Dual-sided contribution + base clamping (e.g. SSNIT: employee `rate`, employer
  // `employerRate`, both applied to the same base after floor/ceiling clamping).
  employerRate?: number;
  ceiling?: number;
  floor?: number;
}

export default function TaxRateBuilder() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isTypeOpen, onOpen: onOpenType, onClose: onCloseType } = useDisclosure();
  const { isOpen: isAssignOpen, onOpen: onOpenAssign, onClose: onCloseAssign } = useDisclosure();
  const { taxRules, taxTypes, setCountry, country: selectedCountry, isLoading: complianceLoading } = useComplianceStore();
  const calcTax = useCalculateTax();

  const flushAccountingSyncForCountry = React.useCallback((country: string, silent?: boolean) => {
    const fresh = useComplianceStore.getState().taxRules.filter((r) => r.countryCode === country);
    const errs = resyncCountryTaxRulesToAccounting(fresh, country);
    if (errs.length && !silent && typeof window !== 'undefined') {
      alert(`Some tax rules did not sync to accounting:\n${errs.join('\n')}`);
    }
  }, []);
  const [filterDomain, setFilterDomain] = useState<'sales' | 'purchases' | 'payroll' | 'corporate' | 'custom'>('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [sim, setSim] = useState({ amount: 1000, category: 'HOTEL', domain: 'sales', numPersons: 1, numNights: 1, roomType: '', industry: '' });
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  // Which specific template is applying, purely so the "Start from a template" list (which
  // shows several Apply buttons at once) only spins the one actually clicked instead of all
  // of them -- isApplyingTemplate itself stays the single re-entrancy guard below.
  const [applyingTemplateKey, setApplyingTemplateKey] = useState<string | null>(null);
  const [autoAppliedCountries, setAutoAppliedCountries] = useState<Set<string>>(new Set());
  const [workspaceTab, setWorkspaceTab] = useState<'rules' | 'types' | 'simulator'>('rules');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState('');
  const [isEditingType, setIsEditingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<{ countryCode: string; name: string; description: string; domain: 'sales'|'purchases'|'payroll'|'corporate'|'custom'; operation: 'internal'|'external'|'both' }>({ countryCode: DEFAULT_COMPLIANCE_COUNTRY, name: '', description: '', domain: 'sales', operation: 'both' });

  useEffect(() => {
    setTypeForm(prev => ({ ...prev, countryCode: selectedCountry }));
  }, [selectedCountry]);

  const availableTypes = React.useMemo(() => (
    (taxTypes || []).filter(t => t.countryCode === selectedCountry)
  ), [taxTypes, selectedCountry]);

  const [assignSelection, setAssignSelection] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState('');

  const handleSaveTaxType = async () => {
    const name = (typeForm.name || '').trim();
    if (!name) { try { alert('Tax type name is required.'); } catch {} return; }
    try {
      const res = await fetch('/api/compliance/tax-types/manage', {
        method: editingTypeId ? 'PUT' : 'POST',
        headers: taxTenantHeaders(),
        body: JSON.stringify({
          id: editingTypeId || undefined,
          countryCode: selectedCountry,
          name: name,
          description: (typeForm.description || '').trim(),
          domain: typeForm.domain,
          operation: deriveOperation(typeForm.domain)
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create tax type');
      }
      const saved = await res.json();
      await setCountry(selectedCountry);
      // Preselect the newly created type for convenience
      setFormData(prev => ({
        ...prev,
        typeId: saved?.id || prev.typeId,
        name: saved?.name || prev.name,
        domain: saved?.domain || prev.domain,
        operation: saved?.operation || prev.operation
      }));
      setTypeForm({ countryCode: selectedCountry, name: '', description: '', domain: 'sales', operation: 'both' });
      setIsEditingType(false);
      setEditingTypeId(null);
      onCloseType();
    } catch (e: any) {
      console.error('Create tax type failed', e);
      try { alert(e?.message || 'Failed to create tax type'); } catch {}
    }
  };

  React.useEffect(() => {
    // Gate on !complianceLoading — without it, this fires on the transiently-empty render
    // before the store's initial async fetch resolves (taxRules === [] is not the same as
    // "the server confirmed zero rules exist"), auto-applying the default template on top
    // of rules that are about to load a moment later and creating duplicates. This is a
    // real bug that existed before, but running the payroll rates editor alongside this tab
    // (both mounted under the same Tabs component) made it fire far more often, since every
    // save there also refreshes this shared store.
    if (complianceLoading) return;
    const code = selectedCountry;
    const already = autoAppliedCountries.has(code);
    const count = taxRules.filter(r => r.countryCode === code).length;
    if (count === 0 && !already) {
      const keys = getDefaultTemplatesForCountry(code);
      if (keys.length) {
        (async () => {
          // Client state said zero rules, but client state can still be stale relative to
          // the server (e.g. another tab/component's fetch is mid-flight). Verify directly
          // against the server immediately before writing anything — the previous
          // client-only check let this fire on a stale read and create duplicate rows via
          // ComplianceDB's read-modify-write (no locking, so a concurrent write from
          // elsewhere gets silently clobbered too, not just duplicated).
          try {
            const res = await fetch(`/api/compliance/taxes?country=${code}`, { headers: taxTenantHeaders() });
            if (res.ok) {
              const fresh = await res.json();
              if (Array.isArray(fresh) && fresh.length > 0) {
                setAutoAppliedCountries(prev => new Set([...Array.from(prev), code]));
                return;
              }
            }
          } catch {
            return; // can't verify — don't risk writing duplicates
          }
          for (const k of keys) {
            await applyTemplate(k, { silent: true, skipFilterSync: true });
          }
          setAutoAppliedCountries(prev => new Set([...Array.from(prev), code]));
        })();
      }
    }
  }, [selectedCountry, taxRules, complianceLoading]);
  const [editingRule, setEditingRule] = useState<TaxRule | TaxRuleForm | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<TaxRuleForm>({
    id: '',
    countryCode: DEFAULT_COMPLIANCE_COUNTRY,
    name: '',
    typeId: '',
    rate: 0,
    glCode: '',
    appliesTo: ['ALL'],
    description: '',
    isActive: true,
    priority: 100,
    calculationBase: 'subtotal',
    method: 'rate',
    fixedAmount: 0,
    tiers: [],
    stacking: 'additive',
    rounding: 'none',
    roundTo: 0.01,
    domain: 'sales',
    operation: 'both'
  });

  useEffect(() => {
    if (!selectedTypeId) return;
    const t: any = (taxTypes || []).find(x => x.id === selectedTypeId);
    if (t) {
      setSim(prev => ({ ...prev, domain: t.domain || prev.domain }));
      try {
        if (t.domain) setFilterDomain(t.domain as any);
      } catch {}
    }
  }, [selectedTypeId, taxTypes]);

  const openAssignRulesModal = (typeId: string) => {
    setSelectedTypeId(String(typeId));
    const current = new Set(
      taxRules
        .filter(r => r.countryCode === selectedCountry)
        .filter(r => String((r as any).typeId || '') === String(typeId))
        .map(r => String(r.id))
    );
    setAssignSelection(current);
    setAssignSearch('');
    onOpenAssign();
  };

  const saveAssignedRules = async () => {
    const typeId = selectedTypeId;
    if (!typeId) { onCloseAssign(); return; }
    const all = taxRules.filter(r => r.countryCode === selectedCountry);
    const selectedIds = Array.from(assignSelection);
    const selectedSet = new Set(selectedIds.map(String));
    for (const r of all) {
      const isSelected = selectedSet.has(String(r.id));
      const currently = String((r as any).typeId || '') === String(typeId);
      if (isSelected && !currently) {
        try {
          await fetch('/api/compliance/taxes/manage', {
            method: 'PUT',
            headers: taxTenantHeaders(),
            body: JSON.stringify({ ...r, typeId })
          });
        } catch {}
      }
      if (!isSelected && currently) {
        try {
          await fetch('/api/compliance/taxes/manage', {
            method: 'PUT',
            headers: taxTenantHeaders(),
            body: JSON.stringify({ ...r, typeId: '' })
          });
        } catch {}
      }
    }
    await setCountry(selectedCountry);
    onCloseAssign();
  };

  const handleOpenModal = (rule?: TaxRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        id: rule.id,
        countryCode: rule.countryCode,
        name: rule.name,
        typeId: (rule as any).typeId || '',
        rate: rule.rate,
        glCode: rule.glCode,
        appliesTo: rule.appliesTo || ['ALL'],
        description: rule.description || '',
        isActive: rule.enabled !== false,
        priority: rule.priority ?? 100,
        calculationBase: rule.calculationBase || 'subtotal',
        method: (rule as any).method || 'rate',
        fixedAmount: (rule as any).fixedAmount ?? 0,
        tiers: (rule as any).tiers || [],
        stacking: rule.stacking || 'additive',
        rounding: rule.rounding || 'none',
        roundTo: rule.roundTo ?? 0.01,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
        domain: (rule as any).domain || 'sales',
        operation: (rule as any).operation || 'both',
        effect: (rule as any).effect || 'add',
        tags: rule.tags || [],
        employerRate: (rule as any).employerRate,
        ceiling: (rule as any).ceiling,
        floor: (rule as any).floor
      });
      setIsEditMode(true);
    } else {
      setEditingRule(null);
      setFormData({
        id: '',
        countryCode: selectedCountry,
        name: '',
        typeId: selectedTypeId || '',
        rate: 0,
        glCode: '',
        appliesTo: ['ALL'],
        description: '',
        isActive: true,
        priority: 100,
        calculationBase: 'subtotal',
        method: 'rate',
        fixedAmount: 0,
        tiers: [],
        stacking: 'additive',
        rounding: 'none',
        roundTo: 0.01,
        domain: 'sales',
        operation: 'both',
        effect: 'add'
      });
      setIsEditMode(false);
    }
    onOpen();
  };

  const handleSave = async () => {
    try {
      const chart = useAccountingStore.getState().chartOfAccounts;
      if (String(formData.glCode || '').trim() && !chartHasGlCode(chart, formData.glCode)) {
        const ok =
          typeof window !== 'undefined'
            ? window.confirm(
                `GL code "${formData.glCode}" is not on the chart of accounts yet. The rule will be saved for compliance, but accounting will not sync until that account exists. Continue?`
              )
            : true;
        if (!ok) return;
      }

      const ruleData = {
        id: formData.id || undefined,
        countryCode: selectedCountry,
        name: formData.name,
        typeId: formData.typeId || undefined,
        rate: formData.rate,
        glCode: formData.glCode,
        appliesTo: formData.appliesTo,
        description: formData.description,
        enabled: formData.isActive,
        priority: formData.priority,
        calculationBase: formData.calculationBase,
        method: formData.method,
        fixedAmount: formData.fixedAmount,
        tiers: formData.tiers,
        stacking: formData.stacking,
        rounding: formData.rounding,
        roundTo: formData.roundTo,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo,
        domain: formData.domain,
        operation: deriveOperation(formData.domain),
        effect: formData.effect,
        tags: formData.tags,
        employerRate: formData.employerRate,
        ceiling: formData.ceiling,
        floor: formData.floor
      };

      let response;
      if (isEditMode) {
        // Update existing rule
        response = await fetch('/api/compliance/taxes/manage', {
          method: 'PUT',
          headers: taxTenantHeaders(),
          body: JSON.stringify(ruleData)
        });
      } else {
        // Create new rule
        response = await fetch('/api/compliance/taxes/manage', {
          method: 'POST',
          headers: taxTenantHeaders(),
          body: JSON.stringify(ruleData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save tax rule');
      }

      const savedRule = await response.json();
      console.log('Tax rule saved:', savedRule);

      const syncRes = syncTaxRuleFromApiResponse(savedRule);
      if (!syncRes.ok && syncRes.error) {
        try {
          alert(`Tax rule saved. Accounting sync: ${syncRes.error}`);
        } catch {}
      }

      // Refresh the tax rules
      await setCountry(selectedCountry);

      onClose();
      setFormData({
        id: '',
        countryCode: selectedCountry,
        name: '',
        rate: 0,
        glCode: '',
        appliesTo: ['ALL'],
        description: '',
        isActive: true
      });
    } catch (error) {
      console.error('Error saving tax rule:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this tax rule?')) {
      try {
        const response = await fetch(`/api/compliance/taxes/manage?id=${ruleId}`, {
          method: 'DELETE',
          headers: taxTenantHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete tax rule');
        }

        const result = await response.json();
        console.log('Tax rule deleted:', result);

        removeTaxRuleFromAccounting(ruleId);

        // Refresh the tax rules
        await setCountry(selectedCountry);
      } catch (error) {
        console.error('Error deleting tax rule:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const bulkSetEnabled = async (enabled: boolean) => {
    const ids = Array.from(selectedRuleIds);
    for (const id of ids) {
      const rule = taxRules.find(r => r.id === id);
      if (!rule) continue;
      try {
        await fetch('/api/compliance/taxes/manage', {
          method: 'PUT',
          headers: taxTenantHeaders(),
          body: JSON.stringify({ ...rule, enabled })
        });
      } catch {}
    }
    await setCountry(selectedCountry);
    flushAccountingSyncForCountry(selectedCountry, true);
    setSelectedRuleIds(new Set());
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedRuleIds);
    for (const id of ids) {
      removeTaxRuleFromAccounting(id);
      try { await fetch(`/api/compliance/taxes/manage?id=${id}`, { method: 'DELETE', headers: taxTenantHeaders() }); } catch {}
    }
    await setCountry(selectedCountry);
    setSelectedRuleIds(new Set());
  };

  const getCountrySortedRules = () => {
    return taxRules
      .filter(r => r.countryCode === selectedCountry)
      .filter((r, idx, arr) => arr.findIndex(x => x.id === r.id) === idx)
      .sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
  };

  const reorderRule = async (ruleId: string, dir: 'up' | 'down') => {
    const list = getCountrySortedRules();
    const idx = list.findIndex(r => r.id === ruleId);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const newOrder = [...list];
    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    // Reassign sequential priorities (10,20,30...)
    const updates = newOrder.map((r, i) => ({ id: r.id, priority: (i + 1) * 10 }));
    for (const u of updates) {
      try {
        const base = taxRules.find(tr => tr.id === u.id);
        if (!base) continue;
        await fetch('/api/compliance/taxes/manage', {
          method: 'PUT',
          headers: taxTenantHeaders(),
          body: JSON.stringify({ ...base, priority: u.priority })
        });
      } catch {}
    }
    await setCountry(selectedCountry);
    flushAccountingSyncForCountry(selectedCountry, true);
  };

  // Template builder — rules loaded from compliance config
  const applyTemplate = async (templateKey: string, options?: { silent?: boolean; skipFilterSync?: boolean; forceTypeId?: string; skipAccountingResync?: boolean }) => {
    if (isApplyingTemplate) return;
    setIsApplyingTemplate(true);
    setApplyingTemplateKey(templateKey);
    const rules = buildTemplateRules(templateKey, selectedCountry);
    if (rules.length === 0) {
      setIsApplyingTemplate(false);
      setApplyingTemplateKey(null);
      return;
    }
    const meta = getTemplateMeta(templateKey);
    const typeName = meta?.title || templateKey;
    let typeIdForTemplate: string | null = options?.forceTypeId || null;
    try {
      if (!typeIdForTemplate) {
        const templateTag = `template:${templateKey}`;
        const existing = (taxTypes || []).find(t => {
          if (t.countryCode !== selectedCountry) return false;
          const tags = (t as any).tags as string[] | undefined;
          if (Array.isArray(tags) && tags.includes(templateTag)) return true;
          return (t.name || '').trim() === (typeName || '').trim();
        });
        if (existing) {
          typeIdForTemplate = String((existing as any).id);
        } else {
          const typeRes = await fetch('/api/compliance/tax-types/manage', {
            method: 'POST',
            headers: taxTenantHeaders(),
            body: JSON.stringify({ countryCode: selectedCountry, name: typeName, description: `Auto-created from template ${templateKey}`, domain: meta?.domain, operation: meta?.operation, tags: [`template:${templateKey}`] })
          });
          if (typeRes.ok) {
            const created = await typeRes.json();
            typeIdForTemplate = String(created?.id);
          }
        }
      }
    } catch {}
    // Build a lookup of existing rules by country+name
    const existingByKey: Record<string, any> = {};
    taxRules
      .filter(r => r.countryCode === selectedCountry)
      .forEach(r => { existingByKey[`${String(r.countryCode)}:${String(r.name)}`] = r; });
    for (const rule of rules) {
      try {
        const key = `${String(rule.countryCode)}:${String(rule.name)}`;
        const found = existingByKey[key];
        const payload = found ? { ...found, ...rule, id: found.id, typeId: typeIdForTemplate || (found as any).typeId } : { ...rule, typeId: typeIdForTemplate || undefined };
        await fetch('/api/compliance/taxes/manage', {
          method: found ? 'PUT' : 'POST',
          headers: taxTenantHeaders(),
          body: JSON.stringify(payload)
        });
      } catch {}
    }
    await setCountry(selectedCountry);
    if (!options?.skipAccountingResync) {
      flushAccountingSyncForCountry(selectedCountry, !!options?.silent);
    }
    // Set filters to relevant context after apply (generic via templateMeta)
    if (!options?.skipFilterSync) {
      if (meta) {
        setFilterDomain(meta.domain);
      }
    }
    if (typeIdForTemplate) setSelectedTypeId(typeIdForTemplate);
    if (!options?.silent) {
      try { alert('Tax type applied successfully.'); } catch {}
    }
    setIsApplyingTemplate(false);
    setApplyingTemplateKey(null);
  };

  const getCountryFlag = (code: string) => {
    const c = COMPLIANCE_COUNTRIES.find((x) => x.code === code);
    return c?.flag || '🌍';
  };

  const getTemplateKeyForType = (type: any): string | null =>
    findTemplateKeyForTypeName(type?.name, type?.tags);

  const buildRuleKey = (r: any): string => {
    const name = (r?.name || '').toLowerCase();
    const gl = (r?.glCode || '').toLowerCase();
    const domain = (r?.domain || 'sales').toLowerCase();
    const op = (r?.operation || 'both').toLowerCase();
    const base = (r?.calculationBase || 'subtotal').toLowerCase();
    const method = (r?.method || 'rate').toLowerCase();
    const applies = Array.isArray(r?.appliesTo) ? [...r.appliesTo].sort().join(',').toLowerCase() : 'all';
    return `${name}|${gl}|${domain}|${op}|${base}|${method}|${applies}`;
  };

  const getFilteredRulesForDedup = (): any[] => {
    return taxRules
      .filter(rule => rule.countryCode === selectedCountry)
      .filter(rule => (selectedTypeId ? String((rule as any).typeId || '') === String(selectedTypeId) : true))
      .filter(rule => ((rule as any).domain || 'sales') === filterDomain)
      .filter(rule => {
        if (!searchTerm?.trim()) return true;
        const q = searchTerm.toLowerCase();
        return rule.name.toLowerCase().includes(q) || (rule.glCode || '').toLowerCase().includes(q);
      });
  };

  const duplicatesCount = React.useMemo(() => {
    const list = getFilteredRulesForDedup();
    const seen = new Set<string>();
    let dup = 0;
    for (const r of list) {
      const key = buildRuleKey(r);
      if (seen.has(key)) dup += 1; else seen.add(key);
    }
    return dup;
  }, [taxRules, selectedCountry, selectedTypeId, filterDomain, searchTerm]);

  /** Extra tax type cards beyond one per template tag or per name (same country). */
  const duplicateTaxTypesCount = React.useMemo(() => {
    const list = (taxTypes || []).filter((t) => t.countryCode === selectedCountry);
    const normalizeName = (s: string) =>
      String(s || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    const keyOf = (t: any) => {
      const tag = (t.tags || []).find((x: string) => typeof x === 'string' && x.startsWith('template:'));
      if (tag) return `tag:${tag}`;
      return `name:${normalizeName(t.name)}`;
    };
    const buckets: Record<string, number> = {};
    list.forEach((t) => {
      const k = keyOf(t);
      buckets[k] = (buckets[k] || 0) + 1;
    });
    return Object.values(buckets).reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  }, [taxTypes, selectedCountry]);

  const mergeDuplicateTaxTypes = async () => {
    if (!selectedCountry || duplicateTaxTypesCount === 0) return;
    const ok = typeof window !== 'undefined' ? window.confirm(
      `Merge ${duplicateTaxTypesCount} duplicate tax type(s) for this country? Rules will be moved to the kept type (the one with the most rules).`
    ) : true;
    if (!ok) return;
    try {
      const res = await fetch('/api/compliance/tax-types/dedupe', {
        method: 'POST',
        headers: taxTenantHeaders(),
        body: JSON.stringify({ countryCode: selectedCountry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Merge failed');
      await setCountry(selectedCountry);
      try {
        alert(`Merged duplicate tax types. Removed ${data.removed ?? 0} extra type(s).`);
      } catch {}
    } catch (e: any) {
      try {
        alert(e?.message || 'Merge failed');
      } catch {}
    }
  };

  const removeDuplicates = async () => {
    const list = getFilteredRulesForDedup().sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
    const keepByKey: Record<string, string> = {};
    const toDelete: string[] = [];
    for (const r of list) {
      const key = buildRuleKey(r);
      if (!keepByKey[key]) keepByKey[key] = String(r.id); else toDelete.push(String(r.id));
    }
    for (const id of toDelete) {
      removeTaxRuleFromAccounting(id);
      try { await fetch(`/api/compliance/taxes/manage?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: taxTenantHeaders() }); } catch {}
    }
    await setCountry(selectedCountry);
    flushAccountingSyncForCountry(selectedCountry, true);
  };

  const reApplyCountryTemplate = async () => {
    const key = getCountryQuickApply(selectedCountry)?.templateKey ?? getDefaultTemplatesForCountry(selectedCountry)[0];
    if (!key) return;
    await applyTemplate(key);
  };

  const salesRulesSummary = React.useMemo(
    () =>
      formatRulesReferenceSummary(
        taxRules
          .filter((r) => r.countryCode === selectedCountry && ((r as any).domain || 'sales') === 'sales')
          .map((r) => ({ name: r.name, rate: r.rate, glCode: r.glCode }))
      ),
    [taxRules, selectedCountry]
  );

  const countryQuickApply = getCountryQuickApply(selectedCountry);

  const filteredRules = React.useMemo(
    () =>
      taxRules
        .filter((rule) => rule.countryCode === selectedCountry)
        .filter((rule) => (selectedTypeId ? ((rule as any).typeId || '') === selectedTypeId : true))
        .filter((rule) => ((rule as any).domain || 'sales') === filterDomain)
        .filter((rule) => {
          if (!searchTerm?.trim()) return true;
          const q = searchTerm.toLowerCase();
          return rule.name.toLowerCase().includes(q) || (rule.glCode || '').toLowerCase().includes(q);
        })
        .filter((rule, idx, arr) => arr.findIndex((r) => r.id === rule.id) === idx)
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)),
    [taxRules, selectedCountry, selectedTypeId, filterDomain, searchTerm]
  );

  // Where a Tax Type of a given domain is actually selectable/applied in the rest of the
  // app — a small, hand-maintained registry rather than a live scan, so it's obviously
  // editable as each module gets wired onto Tax Types (only Purchase Orders so far).
  // 'sales' isn't module-specific: every sales-side screen (rooms, F&B, events) applies
  // whichever sales-domain rules match automatically, with no per-transaction picker.
  // Centre (Cost vs Revenue) turned out to be fully determined by Tax Area in every
  // rule that exists — sales is always Revenue, purchases and payroll are always
  // Cost, checked across every seed/template rule. So it's derived here rather than
  // asked as a second, independently-settable field that could silently disagree
  // with the area it's paired with.
  const deriveOperation = (domain: string | undefined): 'internal' | 'external' | 'both' => {
    switch (domain || 'sales') {
      case 'sales': return 'external';
      case 'purchases': return 'internal';
      case 'payroll': return 'internal';
      default: return 'both'; // Unrestricted — matches either centre
    }
  };

  const centreLabel = (domain: string | undefined): string =>
    deriveOperation(domain) === 'external' ? 'Revenue Centre' : deriveOperation(domain) === 'internal' ? 'Cost Centre' : 'Both';

  const taxAreaLabel = (domain: string | undefined): string => {
    switch (domain || 'sales') {
      case 'sales': return 'Sales';
      case 'purchases': return 'Purchases';
      case 'payroll': return 'Payroll';
      case 'custom': return 'Unrestricted';
      default: return domain || 'Sales';
    }
  };

  const getTaxTypeUsage = (domain: string | undefined): string | null => {
    switch (domain || 'sales') {
      case 'purchases': return 'Purchase Orders';
      case 'sales': return 'Applied automatically — Rooms, F&B, Events & Conferences';
      case 'payroll': return 'Payroll (PAYE, SSNIT, Tier 1–3)';
      default: return null;
    }
  };

  const countryTypesCount = (taxTypes || []).filter((t) => t.countryCode === selectedCountry).length;
  const selectedTypeName = selectedTypeId
    ? (taxTypes || []).find((t) => t.id === selectedTypeId)?.name
    : null;

  // Templates were only reachable through two narrow paths before this: the one
  // per-country "quick apply" button, and a Type card's "Apply" button (which only
  // works once a Type already exists with a matching name/tag). That left every other
  // template -- including withholding_services, which no button ever pointed at --
  // invisible. This makes the whole set for the selected country browsable directly.
  // Template keys follow a "<country>_..." naming convention (ghana_, us_, nigeria_,
  // south_africa_, kenya_, zimbabwe_); no template is currently shared across countries.
  const templateCountryPrefix: Record<string, string> = {
    GH: 'ghana_', US: 'us_', NG: 'nigeria_', ZA: 'south_africa_', KE: 'kenya_', ZW: 'zimbabwe_',
  };
  // A few templates don't follow the "<country>_..." key convention (they predate it, or
  // are written generically) but are still meant for a specific country's rule set —
  // added here by hand rather than guessed at from the key.
  const unprefixedCountryTemplates: Record<string, string[]> = { GH: ['withholding_services'] };
  const availableTemplates = React.useMemo(() => {
    const prefix = templateCountryPrefix[selectedCountry];
    if (!prefix) return [];
    const keys = new Set([
      ...getTemplateKeys().filter((key) => key.startsWith(prefix)),
      ...(unprefixedCountryTemplates[selectedCountry] || []),
    ]);
    return Array.from(keys)
      .map((key) => ({ key, meta: getTemplateMeta(key), ruleCount: buildTemplateRules(key, selectedCountry).length }))
      .filter((t) => t.meta);
  }, [selectedCountry]);

  return (
    <div className="space-y-3">
      {/* Compact filter toolbar — country is controlled by the page header */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3 p-3 rounded-lg bg-default-50 border border-default-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          <div>
            <span className="text-sm font-medium text-gray-700">Tax Area</span>
            <Select
              className="mt-1.5"
              selectedKeys={[filterDomain]}
              onSelectionChange={(keys) => setFilterDomain(Array.from(keys)[0] as any)}
              variant="bordered"
              size="sm"
            >
              <SelectItem key="sales">Sales</SelectItem>
              <SelectItem key="purchases">Purchases</SelectItem>
              <SelectItem key="custom">Unrestricted</SelectItem>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Payroll rates (PAYE, SSNIT, Tier 2/3) live under Payroll tax, not here.</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Search rules</span>
            <Input className="mt-1.5" placeholder="Name or GL code" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} variant="bordered" size="sm" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" variant="bordered" onPress={onOpenType}>+ Tax Type</Button>
          <Button size="sm" className="bg-ghana-green text-white" onPress={() => handleOpenModal()}>+ Tax Rule</Button>
        </div>
      </div>

      {selectedTypeName && (
        <div className="flex items-center gap-2 flex-wrap">
          <Chip variant="flat" color="success" onClose={() => setSelectedTypeId(null)}>
            Filtering: {selectedTypeName}
          </Chip>
          <Button size="sm" variant="light" onPress={() => setSelectedTypeId(null)}>Show all rules</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          selectedKey={workspaceTab}
          onSelectionChange={(key) => setWorkspaceTab(key as 'rules' | 'types' | 'simulator')}
          aria-label="Tax builder sections"
          size="sm"
          variant="solid"
          classNames={{
            ...deskBookTabsClassNames,
            base: 'w-auto',
            panel: 'hidden',
          }}
        >
          <Tab key="rules" title={`Rules (${filteredRules.length})`} />
          <Tab key="types" title={`Tax Types (${countryTypesCount})`} />
          <Tab key="simulator" title="Simulator" />
        </Tabs>
        {countryQuickApply && (
          <Accordion
            variant="bordered"
            className="min-w-0 flex-1 sm:max-w-xs"
            itemClasses={{
              base: 'px-2',
              title: 'text-xs font-medium',
              trigger: 'py-1.5 min-h-9 gap-2',
              content: 'pt-0 pb-2',
            }}
          >
            <AccordionItem
              key="country-ref"
              aria-label="Country tax reference"
              title={`${getCountryFlag(selectedCountry)} Loaded sales rules`}
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-600">
                  {salesRulesSummary}
                  {countryQuickApply.note ? ` — ${countryQuickApply.note}` : ''}
                </p>
                <Button
                  size="sm"
                  className="bg-ghana-green text-white shrink-0 self-start"
                  onPress={reApplyCountryTemplate}
                  isLoading={isApplyingTemplate}
                >
                  Apply country template
                </Button>
              </div>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      <Tabs
        selectedKey={workspaceTab}
        onSelectionChange={(key) => setWorkspaceTab(key as 'rules' | 'types' | 'simulator')}
        aria-label="Tax builder panels"
        classNames={{
          base: 'w-full',
          tabList: 'hidden',
          panel: 'pt-0',
        }}
      >
        <Tab key="rules" title={`Rules (${filteredRules.length})`}>
          <Card className="mt-1 border-0 shadow-sm" id="rules-section">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold">{getCountryDisplayName(selectedCountry)} — tax rules</p>
                <p className="text-xs text-gray-500">
                  {filteredRules.length} matching
                  {taxRules.filter((r) => r.countryCode === selectedCountry).length > filteredRules.length
                    ? ` (${taxRules.filter((r) => r.countryCode === selectedCountry).length} total for country)`
                    : ''}
                  {' '}· syncs to accounting on save
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="flat" onPress={() => bulkSetEnabled(true)} isDisabled={selectedRuleIds.size === 0}>Enable</Button>
                <Button size="sm" variant="flat" onPress={() => bulkSetEnabled(false)} isDisabled={selectedRuleIds.size === 0}>Disable</Button>
                <Button size="sm" color="danger" variant="flat" onPress={bulkDelete} isDisabled={selectedRuleIds.size === 0}>Delete</Button>
                <Button size="sm" variant="bordered" onPress={removeDuplicates} isDisabled={duplicatesCount === 0}>
                  Dedupe{duplicatesCount ? ` (${duplicatesCount})` : ''}
                </Button>
                {countryQuickApply && (
                  <Button size="sm" variant="flat" onPress={reApplyCountryTemplate}>Re-apply template</Button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              <Table
                aria-label="Tax rules table"
                selectionMode="multiple"
                selectedKeys={selectedRuleIds}
                onSelectionChange={(keys: any) => {
                  if (keys === 'all') {
                    setSelectedRuleIds(new Set(filteredRules.map((r) => r.id)));
                  } else if (keys && typeof keys === 'object') {
                    setSelectedRuleIds(new Set(Array.from(keys as any)));
                  }
                }}
              >
                <TableHeader>
                  <TableColumn>RULE</TableColumn>
                  <TableColumn>TYPE</TableColumn>
                  <TableColumn>RATE</TableColumn>
                  <TableColumn>GL</TableColumn>
                  <TableColumn>PRIORITY</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No rules match these filters. Add a rule or adjust filters.">
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{rule.description || rule.calculationBase || 'subtotal'}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{(taxTypes || []).find((t) => t.id === (rule as any).typeId)?.name || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Chip color="success" variant="flat" size="sm">{rule.rate}%</Chip>
                      </TableCell>
                      <TableCell>
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{rule.glCode}</code>
                      </TableCell>
                      <TableCell>
                        <Chip variant="flat" size="sm">{rule.priority ?? 100}</Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="bordered" onPress={() => reorderRule(rule.id, 'up')}>↑</Button>
                          <Button size="sm" variant="bordered" onPress={() => reorderRule(rule.id, 'down')}>↓</Button>
                          <Button size="sm" variant="bordered" onPress={() => handleOpenModal(rule)}>Edit</Button>
                          <Button size="sm" color="danger" variant="bordered" onPress={() => handleDelete(rule.id)}>Del</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {selectedRuleIds.size > 0 && (
                <p className="text-xs text-gray-500 mt-2">{selectedRuleIds.size} selected</p>
              )}
            </CardBody>
          </Card>
        </Tab>

        <Tab key="types" title={`Tax Types (${countryTypesCount})`}>
          <Card className="mt-4 border-0 shadow-sm">
            <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <p className="text-sm text-gray-600">Group rules by type. Click a type to filter the Rules tab.</p>
              <div className="flex flex-wrap gap-2">
                <Input className="w-48" placeholder="Search types" value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)} variant="bordered" size="sm" />
                <Tooltip content="Merge duplicate types — keeps the one with the most rules.">
                  <Button size="sm" variant="flat" className={duplicateTaxTypesCount > 0 ? 'bg-amber-100 text-amber-900' : ''} onPress={mergeDuplicateTaxTypes} isDisabled={duplicateTaxTypesCount === 0}>
                    Merge dupes{duplicateTaxTypesCount > 0 ? ` (${duplicateTaxTypesCount})` : ''}
                  </Button>
                </Tooltip>
                <Button size="sm" variant="bordered" onPress={() => { setIsEditingType(false); setEditingTypeId(null); setTypeForm({ countryCode: selectedCountry, name: '', description: '', domain: 'sales', operation: 'both' }); onOpenType(); }}>+ Create</Button>
              </div>
            </CardHeader>
            <CardBody>
              {availableTemplates.length > 0 && (
                <Accordion variant="bordered" itemClasses={{ title: 'text-sm font-medium' }} className="mb-4">
                  <AccordionItem
                    key="templates"
                    aria-label="Start from a template"
                    title={`Start from a template (${availableTemplates.length} available for ${getCountryDisplayName(selectedCountry)})`}
                  >
                    <p className="text-xs text-gray-500 mb-3">
                      A template creates (or refreshes) a Tax Type and its Rules in one click — the same thing
                      "+ Create" plus adding each Rule by hand would build. Applying an already-added template
                      updates it to the template's current rates rather than duplicating it.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availableTemplates.map(({ key, meta, ruleCount }) => (
                        <div key={key} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-default-200">
                          <div>
                            <p className="text-sm font-medium">{meta!.title}</p>
                            <p className="text-xs text-gray-500">
                              {taxAreaLabel(meta!.domain)} · {ruleCount} rule{ruleCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="flat"
                            className="bg-ghana-green text-white shrink-0"
                            isLoading={applyingTemplateKey === key}
                            isDisabled={isApplyingTemplate && applyingTemplateKey !== key}
                            onPress={() => applyTemplate(key)}
                          >
                            Apply
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionItem>
                </Accordion>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(taxTypes || [])
                  .filter((t) => t.countryCode === selectedCountry)
                  .filter((t) => !typeSearch.trim() ? true : (t.name.toLowerCase().includes(typeSearch.toLowerCase()) || (t.description || '').toLowerCase().includes(typeSearch.toLowerCase())))
                  .filter((t) => (filterDomain ? ((t as any).domain || 'sales') === filterDomain || (t as any).domain === 'custom' : true))
                  .map((t) => {
                    const count = taxRules.filter((r) => r.countryCode === selectedCountry && (r as any).typeId === t.id).length;
                    const selected = selectedTypeId === t.id;
                    return (
                      <Card
                        key={t.id}
                        isPressable
                        className={`border transition-shadow ${selected ? 'border-ghana-green shadow-md' : 'border-default-200 hover:border-default-400'}`}
                        onPress={() => { setSelectedTypeId(String(t.id)); setWorkspaceTab('rules'); }}
                      >
                        <CardBody className="gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-medium ${selected ? 'text-ghana-green' : ''}`}>{t.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {taxAreaLabel((t as any).domain)} · {(t as any).operation || 'both'}
                              </p>
                              {getTaxTypeUsage((t as any).domain) && (
                                <p className="text-xs text-ghana-green mt-0.5">Used in: {getTaxTypeUsage((t as any).domain)}</p>
                              )}
                            </div>
                            <Chip size="sm" variant="flat">{count}</Chip>
                          </div>
                          {t.description && <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>}
                          <div className="flex flex-wrap gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" className="bg-ghana-green text-white" onPress={() => openAssignRulesModal(String(t.id))}>Rules</Button>
                            <Button size="sm" variant="flat" onPress={async () => {
                              const key = getTemplateKeyForType(t);
                              if (!key) { try { alert('No default rule template linked to this tax type.'); } catch {} return; }
                              await applyTemplate(key, { forceTypeId: String(t.id) });
                              setSelectedTypeId(String(t.id));
                              setWorkspaceTab('rules');
                            }}>Apply</Button>
                            <Button size="sm" variant="bordered" onPress={() => { setIsEditingType(true); setEditingTypeId(String(t.id)); setTypeForm({ countryCode: selectedCountry, name: t.name, description: t.description || '', domain: (t as any).domain || 'sales', operation: (t as any).operation || 'both' }); onOpenType(); }}>Edit</Button>
                            <Button size="sm" color="danger" variant="light" onPress={async () => {
                              const ok = typeof window !== 'undefined' ? window.confirm(`Delete tax type "${t.name}"? Rules are kept but unassigned from this type.`) : true;
                              if (!ok) return;
                              try {
                                await fetch(`/api/compliance/tax-types/manage?id=${encodeURIComponent(String(t.id))}`, { method: 'DELETE', headers: taxTenantHeaders() });
                                await setCountry(selectedCountry);
                                if (selectedTypeId === t.id) setSelectedTypeId(null);
                              } catch {}
                            }}>Del</Button>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
              </div>
            </CardBody>
          </Card>
        </Tab>

        <Tab key="simulator" title="Simulator">
          <Card className="mt-4 border-0 shadow-sm">
            <CardHeader>
              <p className="font-semibold">Test calculation</p>
              <p className="text-xs text-gray-500">Uses live rules for {selectedCountry} — same engine as invoices and folios</p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Input label="Amount" type="number" value={String(sim.amount)} onChange={(e) => setSim({ ...sim, amount: parseFloat(e.target.value || '0') })} variant="bordered" size="sm" />
                <Input label="Category" value={sim.category} onChange={(e) => setSim({ ...sim, category: e.target.value })} variant="bordered" size="sm" />
                <Select label="Tax Area" selectedKeys={[sim.domain]} onSelectionChange={(k) => setSim({ ...sim, domain: Array.from(k)[0] as any })} variant="bordered" size="sm">
                  <SelectItem key="sales">Sales</SelectItem>
                  <SelectItem key="purchases">Purchases</SelectItem>
                  <SelectItem key="custom">Unrestricted</SelectItem>
                </Select>
                <div className="flex flex-col justify-end">
                  <span className="text-xs text-gray-500">Centre</span>
                  <span className="text-sm py-1.5">{centreLabel(sim.domain)}</span>
                </div>
                <Input label="Persons" type="number" value={String(sim.numPersons)} onChange={(e) => setSim({ ...sim, numPersons: parseInt(e.target.value || '1', 10) })} variant="bordered" size="sm" />
                <Input label="Nights" type="number" value={String(sim.numNights)} onChange={(e) => setSim({ ...sim, numNights: parseInt(e.target.value || '1', 10) })} variant="bordered" size="sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-default-50">
                <div>
                  <h4 className="text-sm font-medium mb-2">Breakdown</h4>
                  <div className="space-y-1 text-sm">
                    {(() => {
                      const ctx: any = { numPersons: sim.numPersons, numNights: sim.numNights, roomType: sim.roomType, industry: sim.industry, domain: sim.domain, operation: deriveOperation(sim.domain), typeId: selectedTypeId };
                      const res = calcTax(Number(sim.amount) || 0, sim.category, ctx);
                      if (!res.taxes.length) return <p className="text-gray-500 text-xs">No taxes applied for this scenario.</p>;
                      return res.taxes.map((t: any, idx: number) => (
                        <div key={`${t.name}-${idx}`} className="flex justify-between">
                          <span>{t.name}</span>
                          <span className="font-mono">{t.amount.toFixed(2)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const ctx: any = { numPersons: sim.numPersons, numNights: sim.numNights, roomType: sim.roomType, industry: sim.industry, domain: sim.domain, operation: deriveOperation(sim.domain), typeId: selectedTypeId };
                    const res = calcTax(Number(sim.amount) || 0, sim.category, ctx);
                    const tax = res.taxes.reduce((s: number, t: any) => s + t.amount, 0);
                    return (
                      <>
                        <div className="flex justify-between font-medium"><span>Total incl. tax</span><span className="font-mono">{res.total.toFixed(2)}</span></div>
                        <div className="flex justify-between text-gray-600"><span>Effective rate</span><span className="font-mono">{((tax / (Number(sim.amount) || 1)) * 100).toFixed(1)}%</span></div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      {/* Create Tax Type Modal */}
      <Modal isOpen={isTypeOpen} onClose={() => { onCloseType(); setIsEditingType(false); setEditingTypeId(null); }}>
        <ModalContent>
          <ModalHeader>{isEditingType ? 'Edit Tax Type' : 'Create Tax Type'}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Country <span className="text-danger-600">*</span></label>
                  <Select selectedKeys={[selectedCountry]} isDisabled isRequired variant="bordered">
                    <SelectItem key={selectedCountry}>{selectedCountry}</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tax Area <span className="text-danger-600">*</span></label>
                  <Select selectedKeys={[typeForm.domain]} onSelectionChange={(k) => setTypeForm(prev => ({ ...prev, domain: Array.from(k)[0] as any }))} isRequired variant="bordered">
                    <SelectItem key="sales">Sales</SelectItem>
                    <SelectItem key="purchases">Purchases</SelectItem>
                    <SelectItem key="payroll">Payroll</SelectItem>
                    <SelectItem key="custom">Unrestricted</SelectItem>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">Centre
                  <Tooltip content="Follows Tax Area automatically — Sales is always Revenue Centre, Purchases and Payroll are always Cost Centre.">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                  </Tooltip>
                </label>
                <p className="text-sm py-1.5 text-gray-700">{centreLabel(typeForm.domain)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Tax Type Name <span className="text-danger-600">*</span></label>
                <Input
                  placeholder="e.g., VAT (Standard Rate)"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm(prev => ({ ...prev, name: e.target.value }))}
                  isRequired
                  variant="bordered"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  placeholder="Short description of this tax type"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm(prev => ({ ...prev, description: e.target.value }))}
                  variant="bordered"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onCloseType}>Cancel</Button>
            <Button className="bg-ghana-green text-white" onPress={handleSaveTaxType} isDisabled={!typeForm.name.trim()}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Existing Rules to Tax Type Modal */}
      <Modal isOpen={isAssignOpen} onClose={onCloseAssign} size="2xl">
        <ModalContent>
          <ModalHeader>Assign Rules to {(taxTypes || []).find(t => String(t.id) === String(selectedTypeId))?.name || 'Tax Type'}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Input className="w-64" placeholder="Search rules (name / GL)" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} variant="bordered" />
                <Button size="sm" variant="flat" onPress={() => setAssignSelection(new Set(
                  taxRules.filter(r => r.countryCode === selectedCountry).map(r => String(r.id))
                ))}>Select All</Button>
                <Button size="sm" variant="flat" onPress={() => setAssignSelection(new Set())}>Clear</Button>
              </div>
              <div className="max-h-[420px] overflow-auto divide-y divide-default-200 rounded-medium border border-default-200">
                {taxRules
                  .filter(r => r.countryCode === selectedCountry)
                  .filter((r, idx, arr) => {
                    // De-duplicate in modal view by content key
                    const key = buildRuleKey(r);
                    return arr.findIndex(x => buildRuleKey(x) === key) === idx;
                  })
                  .filter(r => {
                    const q = assignSearch.trim().toLowerCase();
                    if (!q) return true;
                    return r.name.toLowerCase().includes(q) || (r.glCode || '').toLowerCase().includes(q);
                  })
                  .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
                  .map(r => {
                    const id = String(r.id);
                    const checked = assignSelection.has(id);
                    return (
                      <div key={id} className="flex items-center justify-between py-2 px-3">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setAssignSelection(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(id); else next.delete(id);
                              return next;
                            });
                          }} />
                          <div>
                            <div className="text-sm font-medium">{r.name}</div>
                            <div className="text-xs text-gray-500">GL {r.glCode} • {taxAreaLabel((r as any).domain)} • {(r as any).operation || 'both'} • Priority {r.priority ?? 100}</div>
                          </div>
                        </div>
                        <Chip size="sm" variant="flat">{r.rate}%</Chip>
                      </div>
                    );
                  })}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onCloseAssign}>Cancel</Button>
            <Button className="bg-ghana-green text-white" onPress={saveAssignedRules} isDisabled={!selectedTypeId}>Apply Selection</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Tax Rule Form Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl">
        <ModalContent>
          <ModalHeader>
            {isEditMode ? 'Edit Tax Rule' : 'Create New Tax Rule'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Status removed: Active moved next to Tax Type below */}

              {/* Tax Type Context (selection happens in cards above) */}
                <div>
                <label className="text-sm font-medium">Tax Type <span className="text-danger-600">*</span></label>
                <div className="mt-1 flex items-center justify-between gap-4">
                  {selectedTypeId ? (
                    <div className="flex items-center gap-2">
                      <Chip variant="flat">{(taxTypes || []).find(t => t.id === selectedTypeId)?.name || 'Selected Type'}</Chip>
                        </div>
                  ) : (
                    <div className="text-xs text-danger-600">Select a Tax Type from the list above to add rules under it.</div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Active</span>
                    <Switch
                      isSelected={formData.isActive}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Rule Name */}
              <div>
                <label className="text-sm font-medium">Rule Name <span className="text-danger-600">*</span></label>
                <Input
                  className="mt-1"
                  placeholder="e.g., VAT (Standard Rate)"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  isRequired
                />
              </div>

              {/* Rate and GL Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tax Rate (%) <span className="text-danger-600">*</span></label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="15.0"
                    value={formData.rate.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                    isRequired
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">GL Code <span className="text-danger-600">*</span></label>
                  <Input
                    placeholder="2100"
                    value={formData.glCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, glCode: e.target.value }))}
                    isRequired
                    variant="bordered"
                  />
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className="text-sm font-medium">Applies To Categories</label>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {COMPLIANCE_CATEGORIES.map((category) => (
                    <div key={category.key} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={category.key}
                        checked={formData.appliesTo.includes(category.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              appliesTo: [...prev.appliesTo, category.key]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              appliesTo: prev.appliesTo.filter(c => c !== category.key)
                            }));
                          }
                        }}
                      />
                      <label htmlFor={category.key} className="text-sm">
                        {category.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  placeholder="Enter description for this tax rule..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  variant="bordered"
                />
              </div>

              {/* Advanced Settings */}
              <Divider className="my-2" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1"> 
                    <span>Calculation Order</span>
                    <Tooltip content="Rules run in ascending order (smaller number runs first). Earlier rules can change the base for later ones (e.g., levies before VAT; compound stacks on previous). Use gaps like 10, 20, 30.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                    </Tooltip>
                  </label>
                  <Input
                    type="number"
                    value={(formData.priority ?? 100).toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value || '100', 10) }))}
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Calculation Base</label>
                  <Select
                    selectedKeys={[formData.calculationBase || 'subtotal']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, calculationBase: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="subtotal">Subtotal</SelectItem>
                    <SelectItem key="subtotal_plus_applied">Subtotal + Applied Taxes</SelectItem>
                    <SelectItem key="per_person">Per Person</SelectItem>
                    <SelectItem key="per_night">Per Night</SelectItem>
                    <SelectItem key="per_person_night">Per Person x Night</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Method</label>
                  <Select
                    selectedKeys={[formData.method || 'rate']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, method: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="rate">Rate (%)</SelectItem>
                    <SelectItem key="fixed">Fixed Amount</SelectItem>
                    <SelectItem key="tiered">Tiered</SelectItem>
                  </Select>
                </div>
                {formData.method === 'rate' && formData.domain === 'payroll' && (
                  <>
                    <div>
                      <label className="text-sm font-medium flex items-center gap-1">
                        <span>Employer Rate %</span>
                        <Tooltip content="For dual-sided contributions (e.g. SSNIT): the employer-paid percentage, on the same base as Rate %. Leave blank if this rule has no employer-side contribution.">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                        </Tooltip>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData.employerRate ?? '').toString()}
                        onChange={(e) => setFormData(prev => ({ ...prev, employerRate: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        variant="bordered"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium flex items-center gap-1">
                        <span>Ceiling</span>
                        <Tooltip content="Maximum base the rate applies to (e.g. SSNIT's insurable-earnings ceiling). Leave blank for no cap.">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                        </Tooltip>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData.ceiling ?? '').toString()}
                        onChange={(e) => setFormData(prev => ({ ...prev, ceiling: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        variant="bordered"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium flex items-center gap-1">
                        <span>Floor</span>
                        <Tooltip content="Minimum base the rate applies to (e.g. SSNIT's minimum insurable earnings — an employee paid below this still contributes as if they earned it). Leave blank for no floor.">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                        </Tooltip>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData.floor ?? '').toString()}
                        onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        variant="bordered"
                      />
                    </div>
                  </>
                )}
                {formData.method === 'fixed' && (
                  <div>
                    <label className="text-sm font-medium">Fixed Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(formData.fixedAmount ?? 0).toString()}
                      onChange={(e) => setFormData(prev => ({ ...prev, fixedAmount: parseFloat(e.target.value || '0') }))}
                      variant="bordered"
                    />
                  </div>
                )}
                {formData.method === 'tiered' && (
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium">Tiers</label>
                    <div className="text-xs text-gray-500 mt-1">Define progressive brackets. Each tier can use a percentage (Rate %) or a fixed amount; tiers are applied from top to bottom based on the base amount.</div>
                    <div className="space-y-2 mt-2">
                      {(formData.tiers || []).map((t, idx) => (
                        <div key={idx} className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Upto amount"
                            type="number"
                            value={t.upto?.toString() || ''}
                            onChange={(e) => {
                              const v = e.target.value ? parseFloat(e.target.value) : undefined;
                              setFormData(prev => ({
                                ...prev,
                                tiers: prev.tiers?.map((x, i) => i === idx ? { ...x, upto: v } : x) || []
                              }));
                            }}
                            variant="bordered"
                          />
                          <Input
                            placeholder="Rate % (optional)"
                            type="number"
                            value={t.rate?.toString() || ''}
                            onChange={(e) => {
                              const v = e.target.value ? parseFloat(e.target.value) : undefined;
                              setFormData(prev => ({
                                ...prev,
                                tiers: prev.tiers?.map((x, i) => i === idx ? { ...x, rate: v } : x) || []
                              }));
                            }}
                            variant="bordered"
                          />
                          <Input
                            placeholder="Fixed amount (optional)"
                            type="number"
                            value={t.fixed?.toString() || ''}
                            onChange={(e) => {
                              const v = e.target.value ? parseFloat(e.target.value) : undefined;
                              setFormData(prev => ({
                                ...prev,
                                tiers: prev.tiers?.map((x, i) => i === idx ? { ...x, fixed: v } : x) || []
                              }));
                            }}
                            variant="bordered"
                          />
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="bordered"
                        onPress={() => setFormData(prev => ({ ...prev, tiers: [...(prev.tiers || []), {}] }))}
                      >
                        + Add Tier
                      </Button>
                      <div className="text-xs text-gray-500">Example: Upto 1000 = 2% then remaining = 1% will charge 2% on the first 1000 and 1% on the rest.</div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Stacking</label>
                  <Select
                    selectedKeys={[formData.stacking || 'additive']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, stacking: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="additive">Additive</SelectItem>
                    <SelectItem key="compound">Compound</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Rounding</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      selectedKeys={[formData.rounding || 'none']}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as any;
                        setFormData(prev => ({ ...prev, rounding: selectedKey }));
                      }}
                      variant="bordered"
                    >
                      <SelectItem key="none">None</SelectItem>
                      <SelectItem key="nearest">Nearest</SelectItem>
                      <SelectItem key="down">Down</SelectItem>
                      <SelectItem key="up">Up</SelectItem>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.01"
                      value={(formData.roundTo ?? 0.01).toString()}
                      onChange={(e) => setFormData(prev => ({ ...prev, roundTo: parseFloat(e.target.value || '0.01') }))}
                      variant="bordered"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">Tax Area
                    <Tooltip content="Which part of the business this rule belongs to: Sales/Revenue, Purchases/Procurement, Payroll, or Unrestricted (matches regardless of area). Centre (Cost vs Revenue) is chosen separately.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                    </Tooltip>
                  </label>
                  <Select
                    selectedKeys={[formData.domain || 'sales']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, domain: selectedKey }));
                    }}
                    isDisabled={Boolean(selectedTypeId || formData.typeId)}
                    variant="bordered"
                  >
                    <SelectItem key="sales">Sales</SelectItem>
                    <SelectItem key="purchases">Purchases</SelectItem>
                    <SelectItem key="payroll">Payroll</SelectItem>
                    <SelectItem key="custom">Unrestricted</SelectItem>
                  </Select>
                  {Boolean(selectedTypeId || formData.typeId) && (
                    <div className="text-xs text-gray-500 mt-1">Inherited from selected tax type</div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">Centre
                    <Tooltip content="Follows Tax Area automatically — Sales is always Revenue Centre, Purchases and Payroll are always Cost Centre.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                    </Tooltip>
                  </label>
                  <p className="text-sm py-1.5 text-gray-700">{centreLabel(formData.domain)}</p>
                  {formData.domain === 'payroll' && (
                    <div className="text-xs text-amber-600 mt-1">
                      Existing payroll rates (PAYE, SSNIT, Tier 2/3) are edited under Payroll tax, not here. Only use
                      Payroll here to add a genuinely new statutory rule — it won't appear in this screen's list
                      afterward, so note its name/GL code before saving.
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">Effect
                    <Tooltip content="Add: increases the total (most taxes — VAT, NHIL, levies). Subtract: reduces what's paid out (e.g. resident Withholding Tax). Exclude from Total: tracked for reporting but not added/subtracted (e.g. a zero-rated line). Informational: shown on the document but doesn't affect any total.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                    </Tooltip>
                  </label>
                  <Select
                    selectedKeys={[formData.effect || 'add']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, effect: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="add">Add to Total</SelectItem>
                    <SelectItem key="subtract">Subtract (Withholding)</SelectItem>
                    <SelectItem key="exclude_total">Exclude from Total</SelectItem>
                    <SelectItem key="informational">Informational Only</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Effective From</label>
                  <Input
                    type="date"
                    value={formData.effectiveFrom || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Effective To</label>
                  <Input
                    type="date"
                    value={formData.effectiveTo || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                    variant="bordered"
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button 
              className="bg-ghana-green text-white"
              onPress={handleSave}
              isDisabled={!formData.name || !formData.glCode || !formData.typeId}
            >
              {isEditMode ? 'Update Rule' : 'Create Rule'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
