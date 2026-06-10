-- Migration 011: Compliance Tables
-- NSA CSI compliance assessments (per U/OO/6030316-26) and exportable
-- compliance reports (OWASP, MITRE ATLAS, NSA CSI, custom bundles).

CREATE TABLE IF NOT EXISTS nsa_compliance_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_reference TEXT NOT NULL DEFAULT 'U/OO/6030316-26',
  parameter_validation_active BOOLEAN NOT NULL DEFAULT false,
  tool_execution_sandboxed BOOLEAN NOT NULL DEFAULT false,
  all_invocations_logged BOOLEAN NOT NULL DEFAULT false,
  injection_filtering_active BOOLEAN NOT NULL DEFAULT false,
  message_signing_configured BOOLEAN NOT NULL DEFAULT false,
  least_privilege_tokens_enforced BOOLEAN NOT NULL DEFAULT false,
  network_scan_for_unauthorized_servers BOOLEAN NOT NULL DEFAULT false,
  chained_output_filtering_active BOOLEAN NOT NULL DEFAULT false,
  overall_score INTEGER,
  pdf_report_url TEXT,
  pdf_generated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS compliance_report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
    -- 'owasp_mcp_top10' | 'mitre_atlas' | 'nsa_csi' | 'bundle' | 'custom'
  generated_by UUID REFERENCES auth.users(id),
  storage_path TEXT NOT NULL,
  download_url TEXT,
  is_paid_addon BOOLEAN NOT NULL DEFAULT false,
  addon_purchase_id UUID REFERENCES addon_purchases(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE nsa_compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_report_exports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_nsa_org ON nsa_compliance_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_exports_org ON compliance_report_exports(organization_id, report_type);
