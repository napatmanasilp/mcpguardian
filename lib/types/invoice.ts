export interface Invoice {
  id: string;
  organization_id: string;
  amount_paid: number;
  currency: string;
  status: "paid" | "open" | "void";
  hosted_invoice_url: string | null;
  created_at: string;
}
