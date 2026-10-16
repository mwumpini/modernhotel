import { describe, expect, it } from 'vitest';
import { pickOperationalPolicy, shouldMarkRoomDirtyOnCheckout } from '@/app/lib/frontoffice/operationalPolicies';

describe('Room after checkout', () => {
  it('marks the room dirty unless the facility turned the switch off', () => {
    expect(shouldMarkRoomDirtyOnCheckout(undefined)).toBe(true);
    expect(shouldMarkRoomDirtyOnCheckout({})).toBe(true);
    expect(shouldMarkRoomDirtyOnCheckout({ markRoomDirtyOnCheckout: true })).toBe(true);
    expect(shouldMarkRoomDirtyOnCheckout({ markRoomDirtyOnCheckout: false })).toBe(false);
  });

  it('saves the switch with the other operational policies', () => {
    expect(pickOperationalPolicy({ markRoomDirtyOnCheckout: false }).markRoomDirtyOnCheckout).toBe(false);
    expect(pickOperationalPolicy({ markRoomDirtyOnCheckout: true }).markRoomDirtyOnCheckout).toBe(true);
  });
});
