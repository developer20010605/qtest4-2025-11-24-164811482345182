import type { Principal } from "@dfinity/principal";

export type UserRole = "admin" | "user" | "guest";

export interface UserProfile {
  name: string;
}

export interface QPayCredentials {
  client_username: string;
  client_password: string;
  client_invoice: string;
}

export interface QPayInvoiceConfig {
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  amount: bigint; // Motoko Nat
}

export interface InvoiceRecord {
  user: Principal;
  invoiceId: string;
  invoiceData: string;
  createdAt: bigint; // Motoko Int (ns)
  isPaid: boolean;
  amount: bigint;
}

export interface PaymentRecord {
  user: Principal;
  amount: bigint;
  status: string;
  timestamp: bigint;
}

export interface InvoiceResponse {
  invoiceData: string;
  isNewInvoice: boolean;
  amount: bigint;
}

export interface InvoiceCheckResult {
  hasValidInvoice: boolean;
  invoiceData: string | null;
  amount: bigint | null;
}
