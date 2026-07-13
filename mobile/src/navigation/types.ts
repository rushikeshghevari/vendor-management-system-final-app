import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
};

/** Drawer tabs for the `super_admin` role (tab bar hidden — drawer replaces it). */
export type MainTabParamList = {
  Dashboard: undefined;
  Departments: NavigatorScreenParams<DepartmentsStackParamList> | undefined;
  Users: NavigatorScreenParams<UsersStackParamList> | undefined;
  // Added for drawer navigation — Super Admin can view/manage these via the sidebar.
  Vendors: NavigatorScreenParams<VendorsStackParamList> | undefined;
  Quotations: NavigatorScreenParams<QuotationsStackParamList> | undefined;
  Bills: NavigatorScreenParams<BillsStackParamList> | undefined;
  PurchaseOrders: NavigatorScreenParams<PurchaseOrderStackParamList> | undefined;
  Reports: undefined;
  Payments: NavigatorScreenParams<PaymentsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

/** Bottom tabs for `department_user` (and, for now, any other non-admin role). */
export type DepartmentUserTabParamList = {
  Dashboard: undefined;
  // Both accept nested screen params so the Vendor-registration hand-off (Quotations -> Vendors
  // -> back to Quotations) can deep-link directly into a specific screen of the other tab.
  Vendors: NavigatorScreenParams<VendorsStackParamList> | undefined;
  Quotations: NavigatorScreenParams<QuotationsStackParamList> | undefined;
  Bills: NavigatorScreenParams<BillsStackParamList> | undefined;
  PurchaseOrders: NavigatorScreenParams<PurchaseOrderStackParamList> | undefined;
  // Read-only "My Payments" — scoped server-side to Payments tied to Bills this Department
  // User created. No process/edit actions ever render for this role.
  Payments: NavigatorScreenParams<PaymentsStackParamList> | undefined;
  Profile: undefined;
};

export type UsersStackParamList = {
  // `initialRoleFilter` lets a deep link (e.g. the Super Admin Dashboard's "CEO Management"
  // Quick Action) land directly on a pre-filtered role, the same hand-off pattern used by
  // `AccountsBillList`'s `initialStatus`.
  UserList: { initialRoleFilter?: import('@/constants/roles').Role } | undefined;
  CreateUser: { departmentId?: string; departmentName?: string } | undefined;
  UserDetails: { userId: string };
  EditUser: { userId: string };
};

export type DepartmentsStackParamList = {
  DepartmentList: undefined;
  DepartmentDetails: { departmentId: string };
  AddDepartment: undefined;
  EditDepartment: { departmentId: string };
};

/** HOD's own Users stack — hits /hod/users, not /users, so it's a separate stack from
 *  UsersStackParamList (Super Admin's). No role/department params — both are always
 *  implicit for an HOD (see hod.service.ts on the backend). */
export type HodUsersStackParamList = {
  UserList: undefined;
  CreateUser: undefined;
  UserDetails: { userId: string };
  EditUser: { userId: string };
};

/** Bottom tabs for the `hod` role — department-wide access to Users, Vendors, Quotations,
 *  Bills, and Purchase Orders (see HodNavigator.tsx). */
export type HodTabParamList = {
  Dashboard: undefined;
  Users: NavigatorScreenParams<HodUsersStackParamList> | undefined;
  Vendors: NavigatorScreenParams<VendorsStackParamList> | undefined;
  Quotations: NavigatorScreenParams<QuotationsStackParamList> | undefined;
  Bills: NavigatorScreenParams<BillsStackParamList> | undefined;
  PurchaseOrders: NavigatorScreenParams<PurchaseOrderStackParamList> | undefined;
  Profile: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ChangePassword: undefined;
  // Reachable by every role (route registered once, same shared stack), but the entry
  // point (a row on ProfileScreen) only ever renders for Super Admin.
  SystemSettings: undefined;
  AppSettings: undefined;
};

export type VendorsStackParamList = {
  VendorList: undefined;
  VendorDetails: { vendorId: string };
  // `returnTo` is set only when this screen was opened from the "No Active Vendor Found"
  // prompt in Create Quotation — on success we navigate back there instead of just going back.
  AddVendor: { returnTo?: 'quotation' } | undefined;
  EditVendor: { vendorId: string };
};

export type QuotationsStackParamList = {
  QuotationList: undefined;
  QuotationDetails: { quotationId: string };
  CreateQuotation: { autoSelectVendorId?: string } | undefined;
  EditQuotation: { quotationId: string };
};

export type BillsStackParamList = {
  BillList: undefined;
  BillDetails: { billId: string };
  CreateBill: { quotationId: string };
  EditBill: { billId: string };
};

export type PurchaseOrderStackParamList = {
  PurchaseOrderList: undefined;
  PurchaseOrderDetails: { purchaseOrderId: string };
  // `quotationId` pre-selects the quotation when navigated to straight from a just-Approved
  // Quotation's "Generate Purchase Order" CTA (see QuotationDetailsScreen.tsx) — optional so
  // the FAB entry point on PurchaseOrderListScreen keeps working with a blank picker.
  CreatePurchaseOrder: { quotationId?: string } | undefined;
  ComparisonScreen: { purchaseOrderId: string };
};

/** Shared by Payment Department (full actions), Accounts/Super Admin (read-only), and
 *  Department User (read-only "My Payments") — action buttons are gated client-side by role,
 *  and re-enforced server-side regardless (see payment.routes.ts authorize() calls). Never
 *  reachable by CEO/Director — they only get the embedded PaymentSummaryCard in Quotation
 *  Details instead (see QuotationDetailsScreen.tsx). */
export type PaymentsStackParamList = {
  PaymentList: { initialStatus?: import('@/features/payments/types').PaymentStatus } | undefined;
  // Verified Bills with no Payment yet — where a newly-Verified Bill must show up for
  // Payment Department to act on. Read-only (no create action) for Accounts/Super Admin.
  BillsReadyForPayment: undefined;
  PaymentDetails: { paymentId: string };
  // `mode` distinguishes Start Processing / Retry (same mutation) from Mark Paid / Mark Failed —
  // one screen, four entry points, per the plan's "Retry reuses the Start Processing form."
  PaymentForm: { paymentId: string; mode: 'start-processing' | 'retry' | 'mark-paid' | 'mark-failed' };
};

/** Bottom tabs for the `accounts` role — Bill review only, no Vendor/Department/User access. */
export type AccountsTabParamList = {
  Dashboard: undefined;
  Bills: NavigatorScreenParams<AccountsBillsStackParamList> | undefined;
  PurchaseOrders: NavigatorScreenParams<PurchaseOrderStackParamList> | undefined;
  // Read-only — Accounts can search/filter/view but never process a payment.
  Payments: NavigatorScreenParams<PaymentsStackParamList> | undefined;
  Reports: undefined;
  Profile: undefined;
};

export type AccountsBillsStackParamList = {
  // `initialStatus` lets the Accounts Dashboard deep-link a stat card straight into a
  // pre-filtered tab of the Bill List (e.g. tapping "Correction Requested").
  AccountsBillList: { initialStatus?: import('@/features/bills/types').BillStatus } | undefined;
  AccountsBillDetails: { billId: string };
};

/** Bottom tabs for the `director` role — read-only Quotation and Bill review. */
export type DirectorTabParamList = {
  Dashboard: undefined;
  PendingQuotations: NavigatorScreenParams<QuotationsStackParamList> | undefined;
  // Reuses the same BillsStackParamList/BillsNavigator Department Users use — gated by role
  // inside BillListScreen/BillDetailsScreen, the same pattern PendingQuotations already uses.
  PendingBillApprovals: NavigatorScreenParams<BillsStackParamList> | undefined;
  // Read-only for Director — the backend already allows Director to view/download/share/verify
  // POs (see purchase-order routes), this just exposes the existing screens in the mobile nav.
  PurchaseOrders: NavigatorScreenParams<PurchaseOrderStackParamList> | undefined;
  Reports: undefined;
  Profile: undefined;
};

/** Bottom tabs for the `ceo` role. CEO only reviews Quotations (within the CEO Approval Limit).
 *  Director Financial Approval of Bills is Director-only, not CEO. */
export type CeoTabParamList = {
  Dashboard: undefined;
  PendingQuotations: NavigatorScreenParams<QuotationsStackParamList> | undefined;
  Reports: undefined;
  Profile: undefined;
};

/** Bottom tabs for the `payment_department` role — full Payment Module access. */
export type PaymentTabParamList = {
  Dashboard: undefined;
  Payments: NavigatorScreenParams<PaymentsStackParamList> | undefined;
  Reports: undefined;
  Profile: undefined;
};

// Notification details are now shown via NotificationDetailsSheet (a bottom sheet opened
// in-place from NotificationsScreen), not a pushed stack screen — see that component.
export type NotificationsStackParamList = {
  NotificationList:    undefined;
  NotificationSettings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  // Root-level, NOT nested inside any tab's stack — deliberately outside Profile/any tab so
  // it's never persisted as a tab's "current screen". Reachable from anywhere via the bell
  // icon; Back always pops straight back to whatever tab/screen was visible underneath,
  // and selecting the Profile tab is therefore never affected by this screen having been open.
  NotificationCenter: NavigatorScreenParams<NotificationsStackParamList> | undefined;
  // Root-level so it's directly reachable from a push notification tap regardless of which
  // tab/stack the Director/CEO is currently on. Back always returns to wherever they were.
  QuotationApproval: { quotationId: string; notificationId?: string };
  // Root-level so Directors can reach this directly from a `bill_financial_approval_required`
  // notification tap, regardless of which tab they are currently on.
  BillFinancialApproval: { billId: string; notificationId?: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
