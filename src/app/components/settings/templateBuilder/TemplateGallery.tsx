'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Chip } from '@heroui/react';
import { useSettingsStore } from '../../../lib/settings/store';
import { listBuiltInTemplates } from '../../../lib/print/blockDefaults';
import type { BlockTemplate } from '../../../lib/print/blocks';
import type { PrintType } from '../../../lib/print/templates';

interface TemplateGalleryProps {
  docType: PrintType;
  onEdit: (template: BlockTemplate) => void;
  onView: (template: BlockTemplate) => void;
  onCreateNew: () => void;
}

export default function TemplateGallery({ docType, onEdit, onView, onCreateNew }: TemplateGalleryProps) {
  const settingsStore = useSettingsStore();
  const builtIns = listBuiltInTemplates(docType);
  const custom = settingsStore.getDocBuilderTemplatesByType(docType);
  const activeId = settingsStore.printing[docType];

  const setActive = (id: string) => {
    settingsStore.updateNestedSetting(`printing.${docType}`, id);
  };

  const duplicate = (t: BlockTemplate) => {
    const now = new Date().toISOString();
    const copy: BlockTemplate = {
      ...t,
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${t.name} (Copy)`,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    settingsStore.addDocBuilderTemplate(copy);
  };

  const remove = async (t: BlockTemplate) => {
    const { confirmDelete } = await import('../../DangerConfirm');
    if (!(await confirmDelete(t.name, 'This print template will be permanently removed.'))) return;
    if (activeId === t.id) {
      // Fall back to the type's first built-in preset so a real Print button never
      // resolves to a template that no longer exists.
      setActive(builtIns[0]?.id || '');
    }
    settingsStore.deleteDocBuilderTemplate(t.id);
  };

  const renderCard = (t: BlockTemplate) => (
    <Card key={t.id} className="border-0 shadow-md">
      <CardHeader className="flex items-center justify-between pb-2">
        <h4 className="font-semibold text-ghana-black">{t.name}</h4>
        <div className="flex gap-1">
          {t.isBuiltIn && <Chip size="sm" variant="flat" color="secondary">Built-in</Chip>}
          {activeId === t.id && <Chip size="sm" variant="flat" color="success">Active</Chip>}
        </div>
      </CardHeader>
      <CardBody className="pt-0 flex flex-row flex-wrap gap-2">
        <Button size="sm" color="primary" onPress={() => onView(t)}>View</Button>
        <Button size="sm" variant="flat" onPress={() => onEdit(t)}>Edit</Button>
        <Button size="sm" variant="flat" onPress={() => duplicate(t)}>Duplicate</Button>
        {!t.isBuiltIn && (
          <Button size="sm" variant="flat" color="danger" onPress={() => remove(t)}>Delete</Button>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">View a default before activating it, edit it as a starting point, or create your own from scratch.</p>
        <Button color="primary" onPress={onCreateNew}>+ Create New Template</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {builtIns.map(renderCard)}
        {custom.map(renderCard)}
      </div>
    </div>
  );
}
