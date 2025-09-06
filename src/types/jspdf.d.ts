declare module 'jspdf' {
  export default class jsPDF {
    constructor(options?: any);
    autoTable(options: any): void;
    save(filename: string): void;
  }
}

declare module 'jspdf-autotable' {
  // This module extends jsPDF with autoTable functionality
}
