declare module "@paystack/inline-js" {
  export interface PaystackTransactionResult {
    reference: string;
    status?: string;
    transaction?: string;
    message?: string;
  }
  export interface PaystackTransactionOptions {
    key: string;
    email: string;
    amount: number; // in kobo
    currency?: string;
    reference?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
    onSuccess?: (tx: PaystackTransactionResult) => void;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }
  export default class PaystackPop {
    newTransaction(options: PaystackTransactionOptions): void;
  }
}
