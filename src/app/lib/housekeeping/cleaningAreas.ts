/** Tenant-configured places housekeeping cleans besides guest rooms. */

export interface CleaningArea {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  /** Floor status for public-space cards: clean | dirty | in-progress | inspected | maintenance */
  status: string;
  notes?: string | null;
  updatedAt?: string;
}

/** Seeded once when a tenant has no areas yet — editable afterward. */
export const DEFAULT_CLEANING_AREAS: string[] = [
  'Lobby',
  'Front entrance / porte-cochère',
  'Corridors',
  'Elevators / landings',
  'Public restrooms',
  'Restaurant',
  'Bar',
  'Breakfast area',
  'Pool / pool deck',
  'Gym / fitness',
  'Spa',
  'Meeting / conference rooms',
  'Business centre',
  'Staff offices',
  'Staff restrooms',
  'Laundry',
  'Parking / driveway',
];

export const AREA_ROOM_TYPE_ID = 'area';
