import { create } from 'zustand';
import { useRoomStore } from './roomStore';
import { useMaintenanceStore } from './maintenanceStore';
import { useSupplyStore } from './supplyStore';
import { HousekeepingReport, LaborReport, QualityMetrics } from './models';

interface HousekeepingReportingStore {
  // Report Generation
  generateDailyReport: (date: Date) => HousekeepingReport;
  generateWeeklyReport: (startDate: Date, endDate: Date) => HousekeepingReport;
  generateMonthlyReport: (year: number, month: number) => HousekeepingReport;
  generateLaborReport: (period: 'daily' | 'weekly' | 'monthly', startDate: Date, endDate: Date) => LaborReport;
  generateQualityMetrics: (period: 'daily' | 'weekly' | 'monthly', date: Date) => QualityMetrics;
  
  // Operational Reports
  generateRoomStatusReport: () => { status: string; count: number; percentage: number }[];
  generateCleaningEfficiencyReport: () => { metric: string; value: number; target: number; status: 'good' | 'warning' | 'critical' }[];
  generateMaintenanceCostReport: (period: 'daily' | 'weekly' | 'monthly') => { category: string; cost: number; count: number; percentage: number }[];
  generateSupplyInventoryReport: () => { category: string; totalItems: number; totalValue: number; lowStockCount: number; expiringCount: number }[];
  generateStaffPerformanceReport: () => { staffId: string; name: string; position: string; tasksCompleted: number; qualityScore: number; efficiency: number }[];
  
  // Financial Reports
  generateCostAnalysis: (period: 'daily' | 'weekly' | 'monthly') => { category: string; laborCost: number; materialCost: number; totalCost: number; percentage: number }[];
  generateBudgetVariance: (period: 'daily' | 'weekly' | 'monthly') => { category: string; budgeted: number; actual: number; variance: number; percentage: number }[];
  
  // Export Functions
  exportReport: (report: any, format: 'csv' | 'pdf' | 'excel') => void;
  
  // Utility Functions
  calculateEfficiencyScore: (tasks: any[]) => number;
  calculateQualityScore: (inspections: any[]) => number;
  calculateCostPerRoom: (totalCost: number, roomCount: number) => number;
}

export const useHousekeepingReportingStore = create<HousekeepingReportingStore>((set, get) => ({
  // Report Generation
  generateDailyReport: (date) => {
    const roomStore = useRoomStore.getState();
    const maintenanceStore = useMaintenanceStore.getState();
    const supplyStore = useSupplyStore.getState();
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const rooms = roomStore.rooms;
    const cleaningTasks = roomStore.cleaningTasks.filter(task => 
      task.createdAt >= startOfDay && task.createdAt <= endOfDay
    );
    const maintenanceRequests = maintenanceStore.maintenanceRequests.filter(request => 
      request.reportedAt >= startOfDay && request.reportedAt <= endOfDay
    );
    
    const totalRooms = rooms.length;
    const roomsCleaned = cleaningTasks.filter(task => task.status === 'completed').length;
    const roomsMaintained = maintenanceRequests.filter(request => request.status === 'completed').length;
    const pendingTasks = cleaningTasks.filter(task => task.status === 'pending').length;
    const completedTasks = cleaningTasks.filter(task => task.status === 'completed').length;
    
    const averageCleaningTime = roomStore.getCleaningEfficiency().averageTime;
    const qualityScore = maintenanceStore.getInspectionQuality().averageScore;
    const maintenanceRequestsCount = maintenanceRequests.length;
    const resolvedMaintenance = maintenanceRequests.filter(request => request.status === 'completed').length;
    
    const roomStatusBreakdown: Record<string, number> = {};
    rooms.forEach(room => {
      roomStatusBreakdown[room.status] = (roomStatusBreakdown[room.status] || 0) + 1;
    });
    
    const taskCompletionRates: Record<string, number> = {};
    const taskTypes = ['daily', 'deep-clean', 'turnover', 'maintenance', 'inspection'];
    taskTypes.forEach(type => {
      const typeTasks = cleaningTasks.filter(task => task.type === type);
      const completed = typeTasks.filter(task => task.status === 'completed').length;
      taskCompletionRates[type] = typeTasks.length > 0 ? (completed / typeTasks.length) * 100 : 0;
    });
    
    const staffPerformance: Record<string, any> = {};
    const staff = maintenanceStore.staff;
    staff.forEach(staffMember => {
      const staffTasks = cleaningTasks.filter(task => task.assignedToId === staffMember.id);
      const completed = staffTasks.filter(task => task.status === 'completed').length;
      staffPerformance[staffMember.name] = {
        tasksCompleted: completed,
        averageQualityScore: staffMember.performance.averageQualityScore,
        efficiency: staffTasks.length > 0 ? (completed / staffTasks.length) * 100 : 0
      };
    });
    
    const maintenanceCosts: Record<string, number> = {};
    maintenanceRequests.forEach(request => {
      const cost = request.actualCost || request.totalCost;
      maintenanceCosts[request.category] = (maintenanceCosts[request.category] || 0) + cost;
    });
    
    const supplyUsage: Record<string, number> = {};
    const lowStockSupplies = supplyStore.getLowStockSupplies();
    lowStockSupplies.forEach(supply => {
      supplyUsage[supply.category] = (supplyUsage[supply.category] || 0) + 1;
    });
    
    const recommendations = [];
    if (pendingTasks > 5) recommendations.push('High number of pending tasks - consider additional staff allocation');
    if (qualityScore < 8) recommendations.push('Quality score below target - review cleaning procedures and training');
    if (lowStockSupplies.length > 3) recommendations.push('Multiple supplies running low - review inventory management');
    
    const report: HousekeepingReport = {
      id: Date.now().toString(),
      type: 'daily',
      startDate: startOfDay,
      endDate: endOfDay,
      generatedBy: 'System',
      generatedAt: new Date(),
      summary: {
        totalRooms,
        roomsCleaned,
        roomsMaintained,
        pendingTasks,
        completedTasks,
        averageCleaningTime,
        qualityScore,
        maintenanceRequests: maintenanceRequestsCount,
        resolvedMaintenance
      },
      details: {
        roomStatusBreakdown,
        taskCompletionRates,
        staffPerformance,
        maintenanceCosts,
        supplyUsage
      },
      recommendations
    };
    
    return report;
  },

  generateWeeklyReport: (startDate, endDate) => {
    const roomStore = useRoomStore.getState();
    const maintenanceStore = useMaintenanceStore.getState();
    const supplyStore = useSupplyStore.getState();
    
    const rooms = roomStore.rooms;
    const cleaningTasks = roomStore.cleaningTasks.filter(task => 
      task.createdAt >= startDate && task.createdAt <= endDate
    );
    const maintenanceRequests = maintenanceStore.maintenanceRequests.filter(request => 
      request.reportedAt >= startDate && request.reportedAt <= endDate
    );
    
    const totalRooms = rooms.length;
    const roomsCleaned = cleaningTasks.filter(task => task.status === 'completed').length;
    const roomsMaintained = maintenanceRequests.filter(request => request.status === 'completed').length;
    const pendingTasks = cleaningTasks.filter(task => task.status === 'pending').length;
    const completedTasks = cleaningTasks.filter(task => task.status === 'completed').length;
    
    const averageCleaningTime = roomStore.getCleaningEfficiency().averageTime;
    const qualityScore = maintenanceStore.getInspectionQuality().averageScore;
    const maintenanceRequestsCount = maintenanceRequests.length;
    const resolvedMaintenance = maintenanceRequests.filter(request => request.status === 'completed').length;
    
    const roomStatusBreakdown: Record<string, number> = {};
    rooms.forEach(room => {
      roomStatusBreakdown[room.status] = (roomStatusBreakdown[room.status] || 0) + 1;
    });
    
    const taskCompletionRates: Record<string, number> = {};
    const taskTypes = ['daily', 'deep-clean', 'turnover', 'maintenance', 'inspection'];
    taskTypes.forEach(type => {
      const typeTasks = cleaningTasks.filter(task => task.type === type);
      const completed = typeTasks.filter(task => task.status === 'completed').length;
      taskCompletionRates[type] = typeTasks.length > 0 ? (completed / typeTasks.length) * 100 : 0;
    });
    
    const staffPerformance: Record<string, any> = {};
    const staff = maintenanceStore.staff;
    staff.forEach(staffMember => {
      const staffTasks = cleaningTasks.filter(task => task.assignedToId === staffMember.id);
      const completed = staffTasks.filter(task => task.status === 'completed').length;
      staffPerformance[staffMember.name] = {
        tasksCompleted: completed,
        averageQualityScore: staffMember.performance.averageQualityScore,
        efficiency: staffTasks.length > 0 ? (completed / staffTasks.length) * 100 : 0
      };
    });
    
    const maintenanceCosts: Record<string, number> = {};
    maintenanceRequests.forEach(request => {
      const cost = request.actualCost || request.totalCost;
      maintenanceCosts[request.category] = (maintenanceCosts[request.category] || 0) + cost;
    });
    
    const supplyUsage: Record<string, number> = {};
    const lowStockSupplies = supplyStore.getLowStockSupplies();
    lowStockSupplies.forEach(supply => {
      supplyUsage[supply.category] = (supplyUsage[supply.category] || 0) + 1;
    });
    
    const recommendations = [];
    if (pendingTasks > 20) recommendations.push('High weekly pending tasks - review staffing levels');
    if (qualityScore < 8.5) recommendations.push('Weekly quality below target - implement quality improvement plan');
    if (lowStockSupplies.length > 5) recommendations.push('Multiple supply shortages - optimize inventory management');
    
    const report: HousekeepingReport = {
      id: Date.now().toString(),
      type: 'weekly',
      startDate,
      endDate,
      generatedBy: 'System',
      generatedAt: new Date(),
      summary: {
        totalRooms,
        roomsCleaned,
        roomsMaintained,
        pendingTasks,
        completedTasks,
        averageCleaningTime,
        qualityScore,
        maintenanceRequests: maintenanceRequestsCount,
        resolvedMaintenance
      },
      details: {
        roomStatusBreakdown,
        taskCompletionRates,
        staffPerformance,
        maintenanceCosts,
        supplyUsage
      },
      recommendations
    };
    
    return report;
  },

  generateMonthlyReport: (year, month) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    return get().generateWeeklyReport(startDate, endDate);
  },

  generateLaborReport: (period, startDate, endDate) => {
    const roomStore = useRoomStore.getState();
    const maintenanceStore = useMaintenanceStore.getState();
    
    const cleaningTasks = roomStore.cleaningTasks.filter(task => 
      task.createdAt >= startDate && task.createdAt <= endDate
    );
    const workOrders = maintenanceStore.workOrders.filter(order => 
      order.createdAt >= startDate && order.createdAt <= endDate
    );
    
    const staff = maintenanceStore.staff;
    const staffBreakdown = staff.map(staffMember => {
      const staffTasks = cleaningTasks.filter(task => task.assignedToId === staffMember.id);
      const staffWorkOrders = workOrders.filter(order => order.assignedToId === staffMember.id);
      
      const completedTasks = staffTasks.filter(task => task.status === 'completed').length;
      const completedWorkOrders = staffWorkOrders.filter(order => order.status === 'completed').length;
      
      const totalHours = (completedTasks * 0.5) + (completedWorkOrders * 2); // Estimate hours
      const cost = totalHours * staffMember.hourlyRate;
      
      const qualityScore = staffMember.performance.averageQualityScore;
      
      return {
        employeeId: staffMember.employeeId,
        name: staffMember.name,
        hours: totalHours,
        cost,
        tasksCompleted: completedTasks + completedWorkOrders,
        qualityScore
      };
    });
    
    const totalHours = staffBreakdown.reduce((sum, staff) => sum + staff.hours, 0);
    const totalCost = staffBreakdown.reduce((sum, staff) => sum + staff.cost, 0);
    
    const departmentBreakdown = [
      { department: 'Housekeeping', hours: totalHours * 0.6, cost: totalCost * 0.6, tasksCompleted: cleaningTasks.length },
      { department: 'Maintenance', hours: totalHours * 0.4, cost: totalCost * 0.4, tasksCompleted: workOrders.length }
    ];
    
    const efficiency = {
      averageTaskTime: roomStore.getCleaningEfficiency().averageTime,
      tasksPerHour: totalHours > 0 ? (cleaningTasks.length + workOrders.length) / totalHours : 0,
      costPerTask: (cleaningTasks.length + workOrders.length) > 0 ? totalCost / (cleaningTasks.length + workOrders.length) : 0,
      qualityTrend: maintenanceStore.getInspectionQuality().averageScore
    };
    
    const report: LaborReport = {
      id: Date.now().toString(),
      period,
      startDate,
      endDate,
      totalHours,
      totalCost,
      staffBreakdown,
      departmentBreakdown,
      efficiency
    };
    
    return report;
  },

  generateQualityMetrics: (period, date) => {
    const maintenanceStore = useMaintenanceStore.getState();
    const roomStore = useRoomStore.getState();
    
    const inspections = maintenanceStore.inspectionReports;
    const cleaningTasks = roomStore.cleaningTasks;
    
    const overallScore = maintenanceStore.getInspectionQuality().averageScore;
    const cleanlinessScore = cleaningTasks.length > 0 ? 
      cleaningTasks.reduce((sum, task) => sum + (task.qualityScore || 0), 0) / cleaningTasks.length : 0;
    const maintenanceScore = maintenanceStore.getInspectionQuality().averageScore;
    const inspectionScore = inspections.length > 0 ? 
      inspections.reduce((sum, inspection) => sum + inspection.score, 0) / inspections.length : 0;
    
    const guestSatisfaction = 8.5; // Placeholder - would come from guest feedback system
    const supervisorRating = 8.8; // Placeholder - would come from supervisor evaluations
    
    const areas = [
      { category: 'Cleaning', score: cleanlinessScore, issues: 0, improvements: 0 },
      { category: 'Maintenance', score: maintenanceScore, issues: 0, improvements: 0 },
      { category: 'Inspection', score: inspectionScore, issues: 0, improvements: 0 }
    ];
    
    const trends = [
      { period: 'Previous', score: overallScore - 0.2, change: -0.2 },
      { period: 'Current', score: overallScore, change: 0 },
      { period: 'Target', score: 9.0, change: 9.0 - overallScore }
    ];
    
    const metrics: QualityMetrics = {
      id: Date.now().toString(),
      period,
      date,
      overallScore,
      cleanlinessScore,
      maintenanceScore,
      inspectionScore,
      guestSatisfaction,
      supervisorRating,
      areas,
      trends
    };
    
    return metrics;
  },

  // Operational Reports
  generateRoomStatusReport: () => {
    const roomStore = useRoomStore.getState();
    const rooms = roomStore.rooms;
    const totalRooms = rooms.length;
    
    const statusCounts: Record<string, number> = {};
    rooms.forEach(room => {
      statusCounts[room.status] = (statusCounts[room.status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: (count / totalRooms) * 100
    }));
  },

  generateCleaningEfficiencyReport: () => {
    const roomStore = useRoomStore.getState();
    const maintenanceStore = useMaintenanceStore.getState();
    
    const efficiency = roomStore.getCleaningEfficiency();
    const quality = maintenanceStore.getInspectionQuality();
    
    return [
      {
        metric: 'Task Completion Rate',
        value: efficiency.completionRate,
        target: 95,
        status: efficiency.completionRate >= 95 ? 'good' : efficiency.completionRate >= 85 ? 'warning' : 'critical'
      },
      {
        metric: 'Average Cleaning Time (minutes)',
        value: efficiency.averageTime,
        target: 30,
        status: efficiency.averageTime <= 30 ? 'good' : efficiency.averageTime <= 45 ? 'warning' : 'critical'
      },
      {
        metric: 'Quality Score',
        value: quality.averageScore,
        target: 9.0,
        status: quality.averageScore >= 9.0 ? 'good' : quality.averageScore >= 8.0 ? 'warning' : 'critical'
      },
      {
        metric: 'Inspection Pass Rate',
        value: quality.passRate,
        target: 95,
        status: quality.passRate >= 95 ? 'good' : quality.passRate >= 85 ? 'warning' : 'critical'
      }
    ];
  },

  generateMaintenanceCostReport: (period) => {
    const maintenanceStore = useMaintenanceStore.getState();
    const costs = maintenanceStore.getMaintenanceCosts(period);
    
    const total = costs.total;
    
    return Object.entries(costs.byCategory).map(([category, cost]) => ({
      category,
      cost,
      count: 0, // Would need to count actual requests
      percentage: total > 0 ? (cost / total) * 100 : 0
    }));
  },

  generateSupplyInventoryReport: () => {
    const supplyStore = useSupplyStore.getState();
    const supplies = supplyStore.supplies;
    
    const categoryBreakdown: Record<string, { totalItems: number; totalValue: number; lowStockCount: number; expiringCount: number }> = {};
    
    supplies.forEach(supply => {
      if (!categoryBreakdown[supply.category]) {
        categoryBreakdown[supply.category] = { totalItems: 0, totalValue: 0, lowStockCount: 0, expiringCount: 0 };
      }
      
      categoryBreakdown[supply.category].totalItems += supply.currentStock;
      categoryBreakdown[supply.category].totalValue += supply.currentStock * supply.unitCost;
      
      if (supply.currentStock <= supply.minimumStock) {
        categoryBreakdown[supply.category].lowStockCount += 1;
      }
      
      if (supply.expiryDate && supply.expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
        categoryBreakdown[supply.category].expiringCount += 1;
      }
    });
    
    return Object.entries(categoryBreakdown).map(([category, data]) => ({
      category,
      totalItems: data.totalItems,
      totalValue: data.totalValue,
      lowStockCount: data.lowStockCount,
      expiringCount: data.expiringCount
    }));
  },

  generateStaffPerformanceReport: () => {
    const maintenanceStore = useMaintenanceStore.getState();
    const roomStore = useRoomStore.getState();
    
    const staff = maintenanceStore.staff;
    
    return staff.map(staffMember => {
      const staffTasks = roomStore.cleaningTasks.filter(task => task.assignedToId === staffMember.id);
      const completedTasks = staffTasks.filter(task => task.status === 'completed').length;
      const qualityScore = staffMember.performance.averageQualityScore;
      const efficiency = staffTasks.length > 0 ? (completedTasks / staffTasks.length) * 100 : 0;
      
      return {
        staffId: staffMember.employeeId,
        name: staffMember.name,
        position: staffMember.position,
        tasksCompleted: completedTasks,
        qualityScore,
        efficiency
      };
    });
  },

  // Financial Reports
  generateCostAnalysis: (period) => {
    const maintenanceStore = useMaintenanceStore.getState();
    const roomStore = useRoomStore.getState();
    
    const maintenanceCosts = maintenanceStore.getMaintenanceCosts(period);
    const laborEfficiency = roomStore.getCleaningEfficiency();
    
    const totalLaborCost = laborEfficiency.averageTime * 25; // Assuming $25/hour average rate
    const totalMaterialCost = maintenanceCosts.total;
    const totalCost = totalLaborCost + totalMaterialCost;
    
    return [
      {
        category: 'Labor',
        laborCost: totalLaborCost,
        materialCost: 0,
        totalCost: totalLaborCost,
        percentage: totalCost > 0 ? (totalLaborCost / totalCost) * 100 : 0
      },
      {
        category: 'Materials',
        laborCost: 0,
        materialCost: totalMaterialCost,
        totalCost: totalMaterialCost,
        percentage: totalCost > 0 ? (totalMaterialCost / totalCost) * 100 : 0
      }
    ];
  },

  generateBudgetVariance: (period) => {
    // Placeholder - would compare actual costs against budgeted amounts
    const actualCosts = get().generateCostAnalysis(period);
    const budgetedAmounts = { Labor: 1000, Materials: 500 }; // Placeholder budget
    
    return actualCosts.map(cost => {
      const budgeted = budgetedAmounts[cost.category as keyof typeof budgetedAmounts] || 0;
      const variance = cost.totalCost - budgeted;
      const percentage = budgeted > 0 ? (variance / budgeted) * 100 : 0;
      
      return {
        category: cost.category,
        budgeted,
        actual: cost.totalCost,
        variance,
        percentage
      };
    });
  },

  // Export Functions
  exportReport: (report, format) => {
    // Placeholder export functionality
    console.log(`Exporting ${format} report:`, report);
    
    if (format === 'csv') {
      // Convert report to CSV format
      const csvContent = convertToCSV(report);
      downloadFile(csvContent, `housekeeping-report-${Date.now()}.csv`, 'text/csv');
    } else if (format === 'pdf') {
      // Convert report to PDF format
      console.log('PDF export not implemented yet');
    } else if (format === 'excel') {
      // Convert report to Excel format
      console.log('Excel export not implemented yet');
    }
  },

  // Utility Functions
  calculateEfficiencyScore: (tasks) => {
    if (tasks.length === 0) return 0;
    
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const onTimeTasks = completedTasks.filter(task => {
      if (!task.startTime || !task.completedTime) return false;
      const duration = (task.completedTime.getTime() - task.startTime.getTime()) / (1000 * 60);
      return duration <= (task.duration || 30);
    });
    
    return (onTimeTasks.length / completedTasks.length) * 100;
  },

  calculateQualityScore: (inspections) => {
    if (inspections.length === 0) return 0;
    
    const totalScore = inspections.reduce((sum, inspection) => sum + inspection.score, 0);
    return totalScore / inspections.length;
  },

  calculateCostPerRoom: (totalCost, roomCount) => {
    return roomCount > 0 ? totalCost / roomCount : 0;
  }
}));

// Helper functions for export
function convertToCSV(data: any): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }
  
  // Handle single object
  const headers = Object.keys(data);
  const values = headers.map(header => {
    const value = data[header];
    return typeof value === 'string' ? `"${value}"` : value;
  });
  
  return [headers.join(','), values.join(',')].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
