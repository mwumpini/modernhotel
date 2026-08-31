'use client';

import React from 'react';
import {
  Accordion,
  AccordionItem,
  Card,
  CardBody,
  Chip,
  Link,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { getHospitalityReference, getCountryDisplayName } from '@/app/lib/compliance/config';

type Props = {
  countryCode: string;
};

function formatBand(band: { upTo?: number; above?: number }): string {
  if (band.above != null) return `Above GHS ${band.above.toLocaleString()}`;
  if (band.upTo != null) return `Up to GHS ${band.upTo.toLocaleString()}`;
  return '—';
}

export default function ComplianceHospitalityReference({ countryCode }: Props) {
  const ref = getHospitalityReference(countryCode);

  if (!ref) {
    return (
      <Card className="border-0 shadow-lg">
        <CardBody className="p-6 text-center text-gray-600">
          No hospitality tax reference is configured for {getCountryDisplayName(countryCode)} yet.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ghana-black">{ref.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{ref.summary}</p>
            </div>
            <Chip size="sm" variant="flat" color="primary">
              Effective {ref.effectiveFrom}
            </Chip>
          </div>
        </CardBody>
      </Card>

      <Accordion variant="splitted" selectionMode="multiple" defaultExpandedKeys={['vat', 'paye']}>
        <AccordionItem key="cit" title="Corporate income tax (hotels)">
          <div className="space-y-2 text-sm">
            <p>
              Hotel rate: <strong>{ref.corporateIncomeTax.hotelRate}%</strong> (general companies{' '}
              {ref.corporateIncomeTax.generalRate}%)
            </p>
            <p className="text-gray-600">{ref.corporateIncomeTax.description}</p>
            <p>
              Annual return due:{' '}
              <strong>{ref.corporateIncomeTax.annualReturnMonthsAfterYearEnd} months</strong> after accounting year end
            </p>
          </div>
        </AccordionItem>

        <AccordionItem key="vat" title="VAT stack (Act 1151)">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{ref.vatStack.legalReference}</p>
            <Table aria-label="VAT components" removeWrapper>
              <TableHeader>
                <TableColumn>Component</TableColumn>
                <TableColumn>Rate</TableColumn>
                <TableColumn>Note</TableColumn>
              </TableHeader>
              <TableBody>
                {ref.vatStack.components.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.rate}%</TableCell>
                    <TableCell className="text-sm text-gray-600">{c.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm">
              Typical bill impact: <strong>{ref.vatStack.grandTotalHint}</strong>
            </p>
            {ref.vatStack.abolished?.length ? (
              <p className="text-xs text-gray-500">Abolished: {ref.vatStack.abolished.join('; ')}</p>
            ) : null}
          </div>
        </AccordionItem>

        <AccordionItem key="paye" title="Income Taxes (2026 bands)">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{ref.paye.description}</p>
            <p className="text-sm">
              Monthly return & payment: <strong>{ref.paye.returnDueDay}th</strong> of following month
            </p>
            <Table aria-label="PAYE bands" removeWrapper>
              <TableHeader>
                <TableColumn>Annual income band</TableColumn>
                <TableColumn>Rate</TableColumn>
              </TableHeader>
              <TableBody>
                {ref.paye.bandsAnnual.map((band, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatBand(band)}</TableCell>
                    <TableCell>{band.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AccordionItem>

        <AccordionItem key="wht" title="Withholding tax">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{ref.withholdingTax.description}</p>
            <p className="text-sm">
              Return due: <strong>{ref.withholdingTax.returnDueDay}th</strong> of following month
            </p>
            <Table aria-label="WHT rates" removeWrapper>
              <TableHeader>
                <TableColumn>Payment type</TableColumn>
                <TableColumn>Rate</TableColumn>
                <TableColumn>Final tax?</TableColumn>
              </TableHeader>
              <TableBody>
                {ref.withholdingTax.rates.map((r) => (
                  <TableRow key={r.paymentType}>
                    <TableCell>{r.paymentType}</TableCell>
                    <TableCell>{r.rate}%</TableCell>
                    <TableCell>{r.finalTax ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </AccordionItem>

        <AccordionItem key="ssnit" title="SSNIT">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p>
              Employer: <strong>{ref.ssnit.employerRate}%</strong>
            </p>
            <p>
              Employee: <strong>{ref.ssnit.employeeRate}%</strong>
            </p>
            <p>
              Total: <strong>{ref.ssnit.totalRate}%</strong>
            </p>
            <p>
              Monthly cap: <strong>GHS {ref.ssnit.monthlyCap.toLocaleString()}</strong>
            </p>
            <p>
              Minimum contribution: <strong>GHS {ref.ssnit.monthlyMinimum}</strong>
            </p>
            <p>
              Effective year: <strong>{ref.ssnit.effectiveYear}</strong>
            </p>
          </div>
        </AccordionItem>

        <AccordionItem key="gsl" title="Growth & Sustainability Levy">
          <div className="space-y-2 text-sm">
            <p>
              Category <strong>{ref.growthAndSustainabilityLevy.category}</strong> —{' '}
              {ref.growthAndSustainabilityLevy.categoryDescription}
            </p>
            <p>
              Rate: <strong>{ref.growthAndSustainabilityLevy.rateOnProfitBeforeTax}%</strong> of profit before tax
            </p>
            <p>Assessment years: {ref.growthAndSustainabilityLevy.assessmentYears}</p>
            <p>
              Quarterly due dates:{' '}
              {ref.growthAndSustainabilityLevy.quarterlyDueDates.join(', ')}
            </p>
          </div>
        </AccordionItem>

        <AccordionItem key="capital" title="Capital allowances">
          <Table aria-label="Capital allowances" removeWrapper>
            <TableHeader>
              <TableColumn>Class</TableColumn>
              <TableColumn>Assets</TableColumn>
              <TableColumn>Method</TableColumn>
            </TableHeader>
            <TableBody>
              {ref.capitalAllowances.map((row) => (
                <TableRow key={row.class}>
                  <TableCell>{row.class}</TableCell>
                  <TableCell>{row.assets}</TableCell>
                  <TableCell>{row.method}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionItem>

        <AccordionItem key="bonus" title="Bonus & overtime">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p>
              Bonus flat rate: <strong>{ref.bonusAndOvertime.bonusFlatRate}%</strong>
            </p>
            <p>
              Bonus cap: <strong>{ref.bonusAndOvertime.bonusCapPercentOfBasic}%</strong> of basic salary
            </p>
            <p>
              QJE annual cap: <strong>GHS {ref.bonusAndOvertime.qjeAnnualCap.toLocaleString()}</strong>
            </p>
            <p>
              QJE overtime (within cap): <strong>{ref.bonusAndOvertime.qjeOvertimeFlatRate}%</strong>
            </p>
            <p>
              QJE overtime (excess): <strong>{ref.bonusAndOvertime.qjeOvertimeExcessRate}%</strong>
            </p>
          </div>
        </AccordionItem>

        <AccordionItem key="refs" title="Official references">
          <ul className="space-y-2">
            {ref.references.map((link) => (
              <li key={link.url}>
                <Link href={link.url} isExternal showAnchorIcon size="sm">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
