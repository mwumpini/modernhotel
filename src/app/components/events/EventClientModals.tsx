'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react';
import { buildContractPrintData } from '../../lib/events/contractDocument';
import { buildOrgProfile } from '../../lib/print/buildOrgProfile';
import { renderPrint } from '../../lib/print/engine';
import { useSettingsStore } from '../../lib/settings/store';
import { useEventsScreen } from './eventsScreenContext';

/** Events → client details and contract dialogs. */
export function EventClientModals() {
  const eventsScreen = useEventsScreen();
  const contractTemplates = eventsScreen.listSelectableTemplates('event-contract');
  const [contractTemplateKey, setContractTemplateKey] = useState('');
  useEffect(() => {
    if (!eventsScreen.isContractModalOpen) return;
    const active = eventsScreen.resolveEventTemplateKey('event-contract');
    setContractTemplateKey(active || contractTemplates[0]?.key || '');
  }, [eventsScreen.isContractModalOpen]);
  return (
  <>
        {/* Events Add/Edit Client modal removed; use canonical client form via redirect */}
        {/* Client View Modal */}
        <Modal 
          isOpen={eventsScreen.isClientViewModalOpen} 
          onClose={() => eventsScreen.setIsClientViewModalOpen(false)} 
          size="2xl" 
          scrollBehavior="inside" 
          classNames={{
            base: "max-w-[70vw] max-h-[90vh]",
            body: "p-6"
          }}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👁️</span>
                <div>
                  <h3 className="text-lg font-semibold">
                    Client Details
                  </h3>
                  <p className="text-sm text-gray-600">Viewing client information and contract details</p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              {eventsScreen.selectedClient && (
                <>
                  {/* Client Basic Information */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      👤 Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Client Name</p>
                        <p className="font-medium">{eventsScreen.selectedClient.name}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Position/Title</p>
                        <p className="font-medium">{eventsScreen.selectedClient.position}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Contact Number</p>
                        <p className="font-medium">{eventsScreen.selectedClient.contact}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Email Address</p>
                        <p className="font-medium text-blue-600">{eventsScreen.selectedClient.email}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">WhatsApp Available</p>
                        <p className="font-medium">{eventsScreen.selectedClient.whatsapp ? '✅ Yes' : '❌ No'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Company Information */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      🏢 Company & Organization
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-600">Company Name</p>
                        <p className="font-medium text-blue-800">{eventsScreen.selectedClient.organization}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-600">Industry</p>
                        <p className="font-medium text-blue-800">{eventsScreen.selectedClient.industry}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contract & Rates */}
                  <div className="mb-8">
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      💼 Contract & Rates
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600">Contract Status</p>
                        <Badge 
                          color={eventsScreen.selectedClient.contractStatus === 'active' ? 'success' : 
                                 eventsScreen.selectedClient.contractStatus === 'expired' ? 'warning' : 
                                 eventsScreen.selectedClient.contractStatus === 'pending' ? 'primary' : 'default'}
                          variant="flat"
                        >
                          {eventsScreen.selectedClient.contractStatus}
                        </Badge>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600">Contract Period</p>
                        <p className="font-medium text-green-800">
                          {eventsScreen.selectedClient.contractStart} to {eventsScreen.selectedClient.contractEnd}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-600">Accommodation Rate</p>
                        <p className="font-medium text-purple-800">₵{eventsScreen.selectedClient.rates.accommodation}/night</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-600">Conference Rate</p>
                        <p className="font-medium text-purple-800">₵{eventsScreen.selectedClient.rates.conference}/head</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-600">Catering Rate</p>
                        <p className="font-medium text-purple-800">₵{eventsScreen.selectedClient.rates.catering}/head</p>
                      </div>
                    </div>
                  </div>

                  {/* Special Terms */}
                  {eventsScreen.selectedClient.specialTerms && (
                    <div className="mb-8">
                      <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        ⭐ Special Terms & Conditions
                      </h4>
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-yellow-800">{eventsScreen.selectedClient.specialTerms}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="primary" variant="flat" onPress={() => eventsScreen.setIsClientViewModalOpen(false)}>
                Close
              </Button>
              <Button 
                color="success" 
                onPress={() => {
                  eventsScreen.setIsClientViewModalOpen(false);
                  eventsScreen.setIsContractModalOpen(true);
                }}
              >
                📄 Generate Contract
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Client Edit Modal */}
        <Modal 
          isOpen={eventsScreen.isContractModalOpen} 
          onClose={() => { eventsScreen.setIsContractModalOpen(false); eventsScreen.setSelectedContractEventInfo(null); }} 
          size="2xl"
          scrollBehavior="inside"
          classNames={{
            base: "max-w-[70vw] max-h-[90vh]",
            body: "p-6"
          }}
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📄</span>
                <div>
                  <h3 className="text-lg font-semibold">
                    Generate Contract
                  </h3>
                  <p className="text-sm text-gray-600">Professional contract with negotiated rates and terms</p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="bg-neutral-100">
              {eventsScreen.selectedClient && (
                <ContractPreview
                  templateKey={contractTemplateKey}
                  templates={contractTemplates}
                  onTemplateKey={setContractTemplateKey}
                />
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="flat" onPress={() => { eventsScreen.setIsContractModalOpen(false); eventsScreen.setSelectedContractEventInfo(null); }}>
                Cancel
              </Button>
              <Button color="secondary" variant="flat" onPress={() => eventsScreen.handleContractDocx(contractTemplateKey)}>
                Download DOCX
              </Button>
              <Button color="primary" onPress={() => eventsScreen.handleContractPrint(contractTemplateKey)}>
                Print Contract
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}

function ContractPreview({
  templateKey,
  templates,
  onTemplateKey,
}: {
  templateKey: string;
  templates: Array<{ key: string; name: string }>;
  onTemplateKey: (key: string) => void;
}) {
  const eventsScreen = useEventsScreen();
  const settings = useSettingsStore();
  const hotel = buildOrgProfile(settings as any);
  const data = buildContractPrintData(eventsScreen.selectedClient, eventsScreen.selectedContractEventInfo, hotel);
  const html = renderPrint('event-contract', templateKey, data).replace(/<script>\s*window\.print\(\)\s*<\/script>/gi, '');
  return (
    <div className="space-y-3">
      <Select
        size="sm"
        label="Contract template"
        selectedKeys={templateKey ? new Set([templateKey]) : new Set()}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as string;
          if (key) onTemplateKey(key);
        }}
      >
        {templates.map((template) => (
          <SelectItem key={template.key}>{template.name}</SelectItem>
        ))}
      </Select>
      <iframe title="Contract preview" className="h-[520px] w-full rounded-md border border-neutral-300 bg-white" srcDoc={html} />
    </div>
  );
}

