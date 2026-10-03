/** Browser-safe operator identity (no database imports), shared by sign-in, the API guard and the home page. */
export const PLATFORM_SUBDOMAIN = 'platform';
export const OPERATOR_ROLE = 'operator';

/**
 * The operator can open, suspend and delete every hotel, so the role name alone is never enough:
 * a hotel admin can give their own staff any role text. It must also belong to the platform tenant.
 */
export function isPlatformOperator(
  user: { role?: string | null } | null | undefined,
  tenant: { subdomain?: string | null } | null | undefined,
): boolean {
  return user?.role === OPERATOR_ROLE && tenant?.subdomain === PLATFORM_SUBDOMAIN;
}
