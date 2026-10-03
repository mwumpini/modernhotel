/** True when a saved security record is owned by a hotel other than the caller. */
export function recordBelongsToOtherTenant(existingTenantId: string | null | undefined, callerTenantId: string): boolean {
  return existingTenantId != null && existingTenantId !== callerTenantId
}
