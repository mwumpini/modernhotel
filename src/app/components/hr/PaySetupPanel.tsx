'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Textarea } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePaySetupStore } from '@/app/lib/hr/paySetupStore';
import { banksInUse, DEFAULT_ADVICE_INSTRUCTION, uniqueBankNames } from '@/app/lib/hr/salaryBanks';

/** The banks this hotel pays staff through, and the person who signs the salary letter. */
export default function PaySetupPanel() {
  const setup = usePaySetupStore((s) => s.setup);
  const saved = usePaySetupStore((s) => s.saved);
  const loaded = usePaySetupStore((s) => s.loaded);
  const saveSetup = usePaySetupStore((s) => s.save);
  const employees = useEmployeeStore((s) => s.employees);
  const getPosition = useEmployeeStore((s) => s.getPosition);

  const signers = React.useMemo(() => employees
    .filter((employee) => employee.status !== 'terminated' && employee.status !== 'inactive')
    .map((employee) => ({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      position: getPosition(employee.positionId)?.title || '',
    }))
    .filter((person) => person.name)
    .sort((a, b) => a.name.localeCompare(b.name)), [employees, getPosition]);

  const inUse = React.useMemo(
    () => banksInUse(employees.map((employee) => employee.bankAccount?.bankName)),
    [employees],
  );

  const [banks, setBanks] = React.useState<string[]>([]);
  const [signerName, setSignerName] = React.useState('');
  const [signerPosition, setSignerPosition] = React.useState('');
  const [signature, setSignature] = React.useState('');
  const [instruction, setInstruction] = React.useState(DEFAULT_ADVICE_INSTRUCTION);
  const [draftName, setDraftName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!loaded || seeded.current) return;
    if (!saved && employees.length === 0) return;
    setBanks(saved && setup ? setup.banks : inUse);
    setSignerName(saved && setup ? setup.signerName : '');
    setSignerPosition(saved && setup ? setup.signerPosition : '');
    setSignature(saved && setup ? setup.signature : '');
    setInstruction(saved && setup?.instruction ? setup.instruction : DEFAULT_ADVICE_INSTRUCTION);
    seeded.current = true;
  }, [loaded, saved, setup, inUse, employees.length]);

  const onSignature = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setMessage('Use a PNG or JPG signature.');
      return;
    }
    if (file.size > 280_000) {
      setMessage('That signature image is too large. Use a smaller PNG or JPG.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSignature(String(reader.result || ''));
      setMessage('');
    };
    reader.readAsDataURL(file);
  };

  const addBank = () => {
    const next = uniqueBankNames([...banks, draftName]);
    if (next.length === banks.length) {
      setDraftName('');
      return;
    }
    setBanks(next);
    setDraftName('');
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await saveSetup({ banks, signerName, signerPosition, signature, instruction });
      setMessage('Saved.');
    } catch {
      setMessage('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex-col items-start gap-1 px-3 py-2">
        <div className="text-sm font-semibold text-gray-800">Pay setup</div>
        <p className="text-xs text-gray-500">The banks staff are paid through, and the person who signs the salary payment advice.</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select
            label="Signer name"
            placeholder="Choose who signs the salary letter"
            variant="bordered"
            selectedKeys={signers.some((person) => person.name === signerName) ? [signers.find((person) => person.name === signerName)!.id] : []}
            onSelectionChange={(keys) => {
              const id = String(Array.from(keys)[0] || '');
              const person = signers.find((item) => item.id === id);
              setSignerName(person?.name || '');
              setSignerPosition(person?.position || '');
              setMessage('');
            }}
          >
            {signers.map((person) => (
              <SelectItem key={person.id} textValue={person.name}>{person.name}</SelectItem>
            ))}
          </Select>
          <Input label="Signer position" variant="bordered" value={signerPosition} isReadOnly placeholder="Filled from the person you choose" />
          <div>
            <Input
              type="file"
              label="Signature"
              accept="image/png,image/jpeg"
              variant="bordered"
              onChange={(event) => {
                onSignature(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            {signature ? (
              <div className="mt-2 flex items-center gap-2">
                <img src={signature} alt="Signature" className="h-10 max-w-[160px] object-contain" />
                <Button size="sm" variant="light" color="danger" onPress={() => setSignature('')}>Remove</Button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">PNG or JPG. It prints on the salary payment advice.</p>
            )}
          </div>
        </div>
        <Textarea
          label="Instruction"
          variant="bordered"
          minRows={3}
          value={instruction}
          onValueChange={setInstruction}
          description="This is the wording under SALARY PAYMENT ADVICE. {hotel}, {month}, {amount} and {words} are filled in on each letter."
        />
        <div>
          <div className="text-sm font-medium mb-2">Banks used by staff</div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="w-64"
              label="Bank name"
              variant="bordered"
              size="sm"
              value={draftName}
              onValueChange={setDraftName}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBank(); } }}
              placeholder="GCB Bank"
            />
            <Button size="sm" variant="flat" onPress={addBank}>Add bank</Button>
          </div>
          {!saved && banks.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">Started from the banks already on staff. Add or remove, then save.</p>
          )}
          <div className="mt-3 space-y-2">
            {banks.length === 0 ? (
              <p className="text-sm text-gray-500">No banks yet. Add the ones staff are paid through.</p>
            ) : banks.map((name) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                <span className="text-sm text-ghana-black">{name}</span>
                <Button size="sm" variant="light" color="danger" onPress={() => setBanks(banks.filter((bank) => bank !== name))}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button color="primary" size="sm" isLoading={saving} onPress={save}>Save</Button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
