/**
 * Optional organizational defaults for Decision Policy v0.2 authority domains.
 * Used ONLY when explicitly configured — never unconditional automatic defaults.
 *
 * ORG_DEFAULT_RC_SMS_OWNER=DP
 * ORG_DEFAULT_SHIP_FUND_OWNER=Master
 */
export type OrgDefaultRcSmsOwner = "DP";
export type OrgDefaultShipFundOwner = "Master";

export type OrgAuthorityDefaults = {
  rcSmsOwner: OrgDefaultRcSmsOwner | null;
  shipFundOwner: OrgDefaultShipFundOwner | null;
};

export function resolveOrgAuthorityDefaults(
  env: NodeJS.ProcessEnv = process.env,
): OrgAuthorityDefaults {
  const rc = (env.ORG_DEFAULT_RC_SMS_OWNER ?? "").trim().toUpperCase();
  const ship = (env.ORG_DEFAULT_SHIP_FUND_OWNER ?? "").trim().toLowerCase();
  return {
    rcSmsOwner: rc === "DP" ? "DP" : null,
    shipFundOwner: ship === "master" ? "Master" : null,
  };
}
