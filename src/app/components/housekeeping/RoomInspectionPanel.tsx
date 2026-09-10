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
  Chip, 
  Badge, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Avatar,
  Tooltip,
  Slider
} from "@heroui/react";
import { housekeepingStore } from '../../lib/housekeeping/store';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { 
  RoomInspection, 
  HousekeepingStaff 
} from '../../lib/housekeeping/types';

export default function RoomInspectionPanel() {
  const [inspections, setInspections] = useState<RoomInspection[]>([]);
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<RoomInspection | null>(null);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [isCreatingInspection, setIsCreatingInspection] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectorFilter, setInspectorFilter] = useState<string>('all');

  // Form state
  const [inspectionForm, setInspectionForm] = useState({
    roomNumber: '',
    inspectorId: '',
    inspectorName: '',
    categories: {
      cleanliness: 85,
      amenities: 90,
      maintenance: 95,
      safety: 100
    },
    notes: ''
  });

  useEffect(() => {
    loadData();
    const unsubscribe = housekeepingStore.subscribe(loadData);
    return unsubscribe;
  }, []);

  const loadData = () => {
    setInspections(housekeepingStore.getAllInspections());
    setStaff(housekeepingStore.getAllStaff());
    setRooms(housekeepingStore.getAllRooms());
  };

  const handleCreateInspection = () => {
    setIsCreatingInspection(true);
    setInspectionForm({
      roomNumber: '',
      inspectorId: '',
      inspectorName: '',
      categories: {
        cleanliness: 85,
        amenities: 90,
        maintenance: 95,
        safety: 100
      },
      notes: ''
    });
    setInspectionModalOpen(true);
  };

  const handleEditInspection = (inspection: RoomInspection) => {
    setIsCreatingInspection(false);
    setSelectedInspection(inspection);
    setInspectionForm({
      roomNumber: inspection.roomNumber,
      inspectorId: inspection.inspectorId,
      inspectorName: inspection.inspectorName,
      categories: inspection.categories,
      notes: inspection.notes
    });
    setInspectionModalOpen(true);
  };

  const handleSaveInspection = () => {
    if (!inspectionForm.roomNumber || !inspectionForm.inspectorId) return;

    if (isCreatingInspection) {
      housekeepingStore.createInspection({
        roomNumber: inspectionForm.roomNumber,
        inspectorId: inspectionForm.inspectorId,
        inspectorName: inspectionForm.inspectorName,
        categories: inspectionForm.categories,
        notes: inspectionForm.notes
      });

      trackEvent('HK.Inspection.Created', {
        roomNumber: inspectionForm.roomNumber,
        inspectorId: inspectionForm.inspectorId
      });
    } else if (selectedInspection) {
      // This would typically update the inspection in the store
      console.log('Updating inspection:', selectedInspection.id, inspectionForm);
      trackEvent('HK.Inspection.Updated', {
        inspectionId: selectedInspection.id,
        roomNumber: inspectionForm.roomNumber
      });
    }

    setInspectionModalOpen(false);
    loadData();
  };

  const handleInspectorChange = (inspectorId: string) => {
    const inspector = staff.find(s => s.id === inspectorId);
    setInspectionForm({
      ...inspectionForm,
      inspectorId,
      inspectorName: inspector?.name || ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'success';
      case 'partial': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return '✅';
      case 'partial': return '⚠️';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'danger';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cleanliness': return 'primary';
      case 'amenities': return 'secondary';
      case 'maintenance': return 'success';
      case 'safety': return 'warning';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cleanliness': return '🧹';
      case 'amenities': return '🛁';
      case 'maintenance': return '🔧';
      case 'safety': return '🛡️';
      default: return '📋';
    }
  };

  const filteredInspections = inspections.filter(inspection => {
    if (searchTerm && !inspection.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && inspection.status !== statusFilter) return false;
    if (inspectorFilter !== 'all' && inspection.inspectorId !== inspectorFilter) return false;
    return true;
  });

  const getInspectorName = (inspectorId: string) => {
    return staff.find(s => s.id === inspectorId)?.name || 'Unknown';
  };

  const getCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const calculateTotalScore = (categories: any) => {
    const total = Object.values(categories).reduce((sum: number, score: any) => sum + score, 0);
    return Math.round(total / 4);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ghana-black">🔍 Room Inspections</h2>
          <p className="text-gray-600">Conduct quality control inspections and track room standards</p>
        </div>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={handleCreateInspection}
        >
          + New Inspection
        </Button>
      </div>

      {/* Inspection Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Inspections</p>
                <p className="text-2xl font-bold text-ghana-black">{inspections.length}</p>
              </div>
              <span className="text-2xl">🔍</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Passed</p>
                <p className="text-2xl font-bold text-green-600">
                  {inspections.filter(i => i.status === 'passed').length}
                </p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Partial</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {inspections.filter(i => i.status === 'partial').length}
                </p>
              </div>
              <span className="text-2xl">⚠️</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {inspections.filter(i => i.status === 'failed').length}
                </p>
              </div>
              <span className="text-2xl">❌</span>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Score</p>
                <p className="text-2xl font-bold text-purple-600">
                  {inspections.length > 0 ? Math.round(inspections.reduce((sum, i) => sum + i.score, 0) / inspections.length) : 0}%
                </p>
              </div>
              <span className="text-2xl">📊</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search room numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="passed">✅ Passed</SelectItem>
              <SelectItem key="partial">⚠️ Partial</SelectItem>
              <SelectItem key="failed">❌ Failed</SelectItem>
            </Select>
            <Select
              placeholder="Filter by inspector"
              value={inspectorFilter}
              onChange={(e) => setInspectorFilter(e.target.value)}
            >
              {[{ id: 'all', name: 'All Inspectors' }, ...staff.filter(s => s.role === 'inspector')].map((inspector) => (
                <SelectItem key={inspector.id}>
                  {inspector.name}
                </SelectItem>
              ))}
            </Select>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Filtered:</span>
              <Badge color="primary" variant="flat">{filteredInspections.length}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Inspections Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">Room Inspections</h3>
        </CardHeader>
        <CardBody className="p-0">
          <div className="max-h-[560px] overflow-y-auto">
          <Table aria-label="Inspections table">
            <TableHeader>
              <TableColumn>Inspection ID</TableColumn>
              <TableColumn>Room</TableColumn>
              <TableColumn>Inspector</TableColumn>
              <TableColumn>Score</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Categories</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Follow-up</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredInspections.map((inspection) => (
                <TableRow key={inspection.id} className="hover:bg-gray-50">
                  <TableCell>
                    <span className="font-semibold text-ghana-black">{inspection.id}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="secondary">
                      {inspection.roomNumber}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" name={inspection.inspectorName} />
                      <span className="text-sm">{inspection.inspectorName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-full">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{inspection.score}%</span>
                      </div>
                      <Progress 
                        value={inspection.score} 
                        color={getScoreColor(inspection.score) as any}
                        size="sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={getStatusColor(inspection.status) as any}
                      variant="flat"
                      size="sm"
                    >
                      <span className="mr-1">{getStatusIcon(inspection.status)}</span>
                      {inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {Object.entries(inspection.categories).map(([category, score]) => (
                        <div key={category} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <span>{getCategoryIcon(category)}</span>
                            <span className="text-gray-600">{getCategoryName(category)}</span>
                          </span>
                          <Badge 
                            color={getScoreColor(score) as any}
                            variant="flat"
                            size="sm"
                          >
                            {score}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {new Date(inspection.inspectionDate).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {inspection.followUpRequired ? (
                      <Badge color="warning" variant="flat" size="sm">
                        Required
                      </Badge>
                    ) : (
                      <Badge color="success" variant="flat" size="sm">
                        None
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Tooltip content="View details">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isIconOnly
                          onClick={() => handleEditInspection(inspection)}
                        >
                          👁️
                        </Button>
                      </Tooltip>
                      
                      {inspection.followUpRequired && (
                        <Tooltip content="Follow-up required">
                          <Button
                            size="sm"
                            color="warning"
                            variant="flat"
                            isIconOnly
                          >
                            ⚠️
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardBody>
      </Card>

      {/* Inspection Modal */}
      <Modal isOpen={inspectionModalOpen} onClose={() => setInspectionModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isCreatingInspection ? 'Conduct New Inspection' : 'Inspection Details'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Room and Inspector Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Number *</label>
                  <Select
                    value={inspectionForm.roomNumber}
                    onChange={(e) => setInspectionForm({...inspectionForm, roomNumber: e.target.value})}
                    placeholder="Select room"
                    isRequired
                  >
                    {rooms.filter(r => r.status === 'clean' || r.status === 'inspected').map((room) => (
                      <SelectItem key={room.roomNumber}>
                        Room {room.roomNumber}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Inspector *</label>
                  <Select
                    value={inspectionForm.inspectorId}
                    onChange={(e) => handleInspectorChange(e.target.value)}
                    placeholder="Select inspector"
                    isRequired
                  >
                    {staff.filter(s => s.active && s.role === 'inspector').map((inspector) => (
                      <SelectItem key={inspector.id}>
                        {inspector.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Category Scores */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Category Scores</label>
                <div className="space-y-4">
                  {Object.entries(inspectionForm.categories).map(([category, score]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <span>{getCategoryIcon(category)}</span>
                          {getCategoryName(category)}
                        </span>
                        <span className="text-sm font-medium text-gray-600">{score}%</span>
                      </div>
                      <Slider
                        value={score}
                        onChange={(value) => setInspectionForm({
                          ...inspectionForm,
                          categories: {
                            ...inspectionForm.categories,
                            [category]: value as number
                          }
                        })}
                        minValue={0}
                        maxValue={100}
                        step={5}
                        color={getScoreColor(score) as any}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Poor (0%)</span>
                        <span>Good (50%)</span>
                        <span>Excellent (100%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Score Display */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total Score</span>
                  <Badge 
                    color={getScoreColor(calculateTotalScore(inspectionForm.categories)) as any}
                    variant="flat"
                    size="lg"
                  >
                    {calculateTotalScore(inspectionForm.categories)}%
                  </Badge>
                </div>
                <Progress 
                  value={calculateTotalScore(inspectionForm.categories)} 
                  color={getScoreColor(calculateTotalScore(inspectionForm.categories)) as any}
                  size="sm"
                  className="mt-2"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Inspection Notes</label>
                <Textarea
                  value={inspectionForm.notes}
                  onChange={(e) => setInspectionForm({...inspectionForm, notes: e.target.value})}
                  placeholder="Additional notes about the inspection..."
                  rows={4}
                />
              </div>

              {/* Current Status Display (for editing) */}
              {!isCreatingInspection && selectedInspection && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
                  <div className="flex items-center gap-2">
                    <Badge color={getStatusColor(selectedInspection.status) as any} variant="flat">
                      {getStatusIcon(selectedInspection.status)} {selectedInspection.status.charAt(0).toUpperCase() + selectedInspection.status.slice(1)}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Inspected: {new Date(selectedInspection.inspectionDate).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => setInspectionModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onClick={handleSaveInspection}
              isDisabled={!inspectionForm.roomNumber || !inspectionForm.inspectorId}
            >
              {isCreatingInspection ? 'Complete Inspection' : 'Update Inspection'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
