export const VENDOR_STATUSES = ['active', 'inactive', 'blacklisted'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export interface BankDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;
}

export interface Vendor {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  departmentName: string;
  createdById: string;
  createdByName: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstNumber?: string;
  panNumber?: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
  bankDetails: BankDetails;
  category: string;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}
