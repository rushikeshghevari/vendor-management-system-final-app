import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BillApprovalHistory } from '@/components/bills/BillApprovalHistory';
import { BillApprovalSummary } from '@/components/bills/BillApprovalSummary';
import { BillDecisionSheet } from '@/components/bills/BillDecisionSheet';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { AppHeader } from '@/components/layout/AppHeader';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/components/ui/Screen';
import { ROLES } from '@/constants/roles';
import { env } from '@/config/env';
import {
  useDecideBillApprovalMutation,
  useDeleteBillMutation,
  useGetBillsQuery,
  useResubmitBillMutation,
  useSubmitBillMutation,
} from '@/features/bills/api/billsApi';
import type { BillApprovalDecision, BillStatus } from '@/features/bills/types';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { BillsStackParamList } from '@/navigation/types';

// Mirrors quotation.service.ts's DECIDABLE_STATUSES (via bill.service.ts's
// APPROVAL_DECIDABLE_STATUSES) — a Director/CEO can weigh in any time before the bill is
// verified/rejected/paid, even after another approver has already acted.
const DECIDABLE_STATUSES: BillStatus[] = ['submitted', 'negotiation', 'resubmitted', 'approved', 'approval_rejected'];

type Props = NativeStackScreenProps<BillsStackParamList, 'BillDetails'>;

const STATUS_LABEL: Record<BillStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  negotiation: 'Negotiation',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  approval_rejected: 'Rejected',
  correction_requested: 'Correction Requested',
  verified: 'Verified',
  rejected: 'Rejected',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  completed: 'Completed',
};

const STATUS_VARIANT: Record<BillStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  submitted: 'primary',
  negotiation: 'danger',
  resubmitted: 'primary',
  approved: 'success',
  approval_rejected: 'danger',
  correction_requested: 'danger',
  verified: 'success',
  rejected: 'danger',
  payment_pending: 'primary',
  paid: 'success',
  completed: 'success',
};

function formatDate(isoDate?: string): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View className="mt-2.5 flex-row items-start gap-2">
      <Ionicons name={icon} size={14} color="#5f5f5f" style={{ marginTop: 1 }} />
      <View className="flex-1">
        <Text className="text-[11px] text-ink-muted dark:text-slate-500">{label}</Text>
        <Text className="text-sm text-ink dark:text-slate-200">{value}</Text>
      </View>
    </View>
  );
}

export function BillDetailsScreen({ navigation, route }: Props) {
  const { billId } = route.params;
  const { user, hasRole } = useAuth();
  // Only a Department User may ever edit/submit/delete a bill — the backend already
  // enforces this (authorize(DEPARTMENT_USER) on every mutation route), this just keeps
  // those actions from dangling in front of a Director/CEO/Accounts.
  const isDepartmentUser = hasRole(ROLES.DEPARTMENT_USER);
  const isDirector = hasRole(ROLES.DIRECTOR);
  const isCeo = hasRole(ROLES.CEO);
  const isSuperAdmin = hasRole(ROLES.SUPER_ADMIN);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<BillApprovalDecision | null>(null);

  const { data: bills, isLoading } = useGetBillsQuery();
  const [submitBill, { isLoading: isSubmitting }] = useSubmitBillMutation();
  const [resubmitBill, { isLoading: isResubmitting }] = useResubmitBillMutation();
  const [deleteBill] = useDeleteBillMutation();
  const [decideBillApproval, { isLoading: isDeciding }] = useDecideBillApprovalMutation();

  const bill = bills?.find((item) => item.id === billId);

  if (isLoading) {
    return (
      <Screen padded={false}>
        <AppHeader title="Bill Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Loader fullscreen />
      </Screen>
    );
  }

  if (!bill) {
    return (
      <Screen padded={false}>
        <AppHeader title="Bill Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Text className="p-6 text-center text-sm text-ink-muted dark:text-slate-400">Bill not found.</Text>
      </Screen>
    );
  }

  const handleSubmit = async () => {
    try {
      await submitBill(bill.id).unwrap();
    } catch (error) {
      Alert.alert('Could Not Submit Bill', getErrorMessage(error));
    }
  };

  const handleResubmit = async () => {
    try {
      await resubmitBill(bill.id).unwrap();
    } catch (error) {
      Alert.alert('Could Not Resubmit Bill', getErrorMessage(error));
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Bill', `"${bill.billCode}" will be permanently removed from your drafts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await deleteBill(bill.id).unwrap();
            navigation.goBack();
          } catch (error) {
            Alert.alert('Could Not Delete Bill', getErrorMessage(error));
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const openFile = (url: string) => Linking.openURL(`${env.apiUrl.replace('/api/v1', '')}${url}`);
  const latestInvoice = bill.invoiceFiles[bill.invoiceFiles.length - 1];

  // Defensive default: a bill object fetched under an older app version (e.g. a Fast-Refresh-
  // preserved RTK Query cache entry) may not carry this field yet.
  const billApprovals = bill.billApprovals ?? [];
  const myApproval = billApprovals.find((entry) => entry.approverId === user?.id);
  const hasAlreadyDecided = Boolean(myApproval && myApproval.decision !== 'pending');
  // Which role can actually decide depends on the live amount-vs-CEO-Approval-Limit route
  // (see billService.resolveApprovalRoute) — a Director is never authorized on a CEO-routed
  // bill and vice versa, mirrored here so the buttons never dangle.
  const isCeoRoute = bill.approvalRoute === 'ceo';
  const canDecide = (isDirector && !isCeoRoute) || (isCeo && isCeoRoute);
  const canApprovalDecide = canDecide && DECIDABLE_STATUSES.includes(bill.status);

  const handleConfirmDecision = async (remarks?: string) => {
    if (!pendingDecision) return;
    try {
      await decideBillApproval({ id: bill.id, decision: pendingDecision, remarks }).unwrap();
      setPendingDecision(null);
    } catch (error) {
      Alert.alert('Could Not Record Decision', getErrorMessage(error));
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader title="Bill Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />

      <ScrollView className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark" contentContainerStyle={{ paddingBottom: 32 }}>
        <DashboardCard>
          <Text className="text-xs font-medium text-ink-muted dark:text-slate-500">Approval Route</Text>
          <Text className="mt-0.5 text-sm font-semibold text-ink dark:text-white">
            {isCeoRoute ? 'CEO Approval Required' : 'Directors Approval Required'}
          </Text>
        </DashboardCard>

        {isDirector || isCeo || isSuperAdmin ? (
          <DashboardCard className="mt-4">
            <Text className="text-sm font-semibold text-ink dark:text-slate-200">Bill Approval Summary</Text>
            <View className="mt-3">
              <BillApprovalSummary approvals={billApprovals} />
            </View>
          </DashboardCard>
        ) : null}

        <DashboardCard className="mt-4">
          <View className="flex-row items-start justify-between">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
              <Ionicons name="receipt" size={26} color="#1e88e5" />
            </View>
            <Badge label={STATUS_LABEL[bill.status]} variant={STATUS_VARIANT[bill.status]} />
          </View>

          <Text className="mt-3 text-xl font-bold text-ink dark:text-white">{bill.billCode}</Text>
          <Text className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">
            {bill.vendorName} ({bill.vendorCode})
          </Text>

          <View className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <InfoRow icon="document-text-outline" label="Quotation" value={bill.quotationCode} />
            <InfoRow icon="business-outline" label="Department" value={bill.departmentName} />
            <InfoRow icon="pricetag-outline" label="Invoice Number" value={bill.invoiceNumber} />
            <InfoRow icon="calendar-outline" label="Invoice Date" value={formatDate(bill.invoiceDate)} />
            <InfoRow icon="cash-outline" label="Invoice Amount" value={bill.invoiceAmount.toLocaleString()} />
            <InfoRow icon="calculator-outline" label="Taxable Amount" value={bill.taxableAmount.toLocaleString()} />
            <InfoRow icon="calculator-outline" label="GST Amount" value={bill.gstAmount.toLocaleString()} />
            <InfoRow icon="card-outline" label="Payment Terms" value={bill.paymentTerms} />
            <InfoRow icon="time-outline" label="Due Date" value={formatDate(bill.dueDate)} />
            {bill.remarks ? <InfoRow icon="chatbox-outline" label="Remarks" value={bill.remarks} /> : null}
          </View>

          {bill.accountsRemarks ? (
            <View className="mt-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">Accounts Remarks</Text>
              <Text className="mt-1 text-sm text-amber-900 dark:text-amber-200">{bill.accountsRemarks}</Text>
            </View>
          ) : null}

          <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="person-circle-outline" size={13} color="#5f5f5f" />
              <Text className="text-xs text-ink-muted dark:text-slate-500">By {bill.createdByName || '—'}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="calendar-outline" size={13} color="#5f5f5f" />
              <Text className="text-xs text-ink-muted dark:text-slate-500">Created {formatDate(bill.createdAt)}</Text>
            </View>
          </View>
        </DashboardCard>

        <DashboardCard className="mt-4">
          <Text className="text-sm font-semibold text-ink dark:text-slate-200">Invoice PDF</Text>
          {bill.invoiceFiles.length === 0 ? (
            <Text className="mt-2 text-sm text-ink-muted dark:text-slate-400">No invoice PDF uploaded yet.</Text>
          ) : (
            <>
              <Text className="mt-2 text-xs text-ink-muted dark:text-slate-500">
                {bill.invoiceFiles.length} version(s) — version history is kept, never overwritten.
              </Text>
              {bill.invoiceFiles.map((pdf) => (
                <Text key={pdf.version} onPress={() => openFile(pdf.url)} className="mt-2 text-sm text-primary-600 underline">
                  v{pdf.version} — {pdf.fileName} ({formatDate(pdf.uploadedAt)})
                  {pdf.version === latestInvoice?.version ? '  (current)' : ''}
                </Text>
              ))}
            </>
          )}
        </DashboardCard>

        <DashboardCard className="mt-4">
          <Text className="text-sm font-semibold text-ink dark:text-slate-200">Supporting Documents</Text>
          {bill.supportingDocuments.length === 0 ? (
            <Text className="mt-2 text-sm text-ink-muted dark:text-slate-400">No supporting documents uploaded.</Text>
          ) : (
            bill.supportingDocuments.map((pdf) => (
              <Text key={pdf.version} onPress={() => openFile(pdf.url)} className="mt-2 text-sm text-primary-600 underline">
                v{pdf.version} — {pdf.fileName} ({formatDate(pdf.uploadedAt)})
              </Text>
            ))
          )}
        </DashboardCard>

        {isDirector || isCeo || isSuperAdmin ? (
          <DashboardCard className="mt-4">
            <Text className="text-sm font-semibold text-ink dark:text-slate-200">Bill Approval History</Text>
            <View className="mt-3">
              <BillApprovalHistory approvals={billApprovals} />
            </View>
          </DashboardCard>
        ) : null}

        {/* Read-only for the Department User who owns this bill — they can see who reviewed
            it and what was said, but never act on it (no buttons render here). */}
        {isDepartmentUser ? (
          <DashboardCard className="mt-4">
            <Text className="text-sm font-semibold text-ink dark:text-slate-200">Approval Review</Text>
            <View className="mt-3">
              {billApprovals.some((entry) => entry.decision !== 'pending') ? (
                <BillApprovalHistory approvals={billApprovals} />
              ) : (
                <Text className="text-sm text-ink-muted dark:text-slate-400">No approval review available yet.</Text>
              )}
            </View>
          </DashboardCard>
        ) : null}

        <DashboardCard className="mt-4">
          <View className="flex-row items-center gap-2">
            <Text style={{ fontSize: 20 }}>🤖</Text>
            <Text className="flex-1 text-sm font-semibold text-ink dark:text-slate-200">AI Insights</Text>
            <View className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
              <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Coming Soon</Text>
            </View>
          </View>
          <Text className="mt-2 text-xs text-ink-muted dark:text-slate-400">
            AI-powered invoice verification, anomaly detection, and payment risk insights will appear here.
          </Text>
        </DashboardCard>

        {canDecide && hasAlreadyDecided ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Ionicons name="checkmark-done-outline" size={20} color="#5f5f5f" />
            <Text className="mt-1.5 text-center text-sm text-ink-muted dark:text-slate-400">
              You have already taken action on this bill. You may still update your decision below.
            </Text>
          </View>
        ) : null}

        {canApprovalDecide ? (
          <>
            <Button label={hasAlreadyDecided ? 'Update to Approved' : 'Approve'} onPress={() => setPendingDecision('approved')} className="mt-3" />
            <Button
              label={hasAlreadyDecided ? 'Update to Negotiation' : 'Negotiation'}
              variant="secondary"
              onPress={() => setPendingDecision('negotiation')}
              className="mt-3"
            />
            <Button
              label={hasAlreadyDecided ? 'Update to Rejected' : 'Reject'}
              variant="dangerOutline"
              onPress={() => setPendingDecision('rejected')}
              className="mt-3"
            />
          </>
        ) : null}

        {isDepartmentUser && bill.status === 'draft' ? (
          <>
            <Button label="Edit Bill" onPress={() => navigation.navigate('EditBill', { billId: bill.id })} className="mt-5" />
            <Button label="Submit for Approval" variant="secondary" loading={isSubmitting} onPress={handleSubmit} className="mt-3" />
            <Button label="Delete Bill" variant="dangerOutline" loading={isDeleting} onPress={handleDelete} className="mt-3" />
          </>
        ) : null}

        {isDepartmentUser && bill.status === 'negotiation' ? (
          <>
            <Button label="Edit Bill" onPress={() => navigation.navigate('EditBill', { billId: bill.id })} className="mt-5" />
            <Button label="Resubmit for Approval" variant="secondary" loading={isResubmitting} onPress={handleResubmit} className="mt-3" />
          </>
        ) : null}

        {isDepartmentUser && bill.status === 'correction_requested' ? (
          <>
            <Button label="Edit Bill" onPress={() => navigation.navigate('EditBill', { billId: bill.id })} className="mt-5" />
            <Button label="Resubmit to Accounts" variant="secondary" loading={isResubmitting} onPress={handleResubmit} className="mt-3" />
          </>
        ) : null}

        {!isDepartmentUser && !isDirector && !isCeo && bill.status === 'negotiation' ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Ionicons name="hourglass-outline" size={20} color="#5f5f5f" />
            <Text className="mt-1.5 text-sm text-ink-muted dark:text-slate-400">
              Sent back for changes — awaiting the Department User's resubmission.
            </Text>
          </View>
        ) : null}

        {/* The decider role gets the precise Approve/Negotiation/Reject buttons (or the
            "already acted" message) above instead of this generic line — see `canDecide`. */}
        {!canDecide && (bill.status === 'submitted' || bill.status === 'resubmitted') ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Ionicons name="hourglass-outline" size={20} color="#5f5f5f" />
            <Text className="mt-1.5 text-sm text-ink-muted dark:text-slate-400">
              {isDepartmentUser
                ? `Awaiting ${isCeoRoute ? 'CEO' : 'Director'} review.`
                : `Awaiting a ${isCeoRoute ? 'CEO' : 'Director'} decision.`}
            </Text>
          </View>
        ) : null}

        {bill.status === 'approved' ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Ionicons name="checkmark-done-outline" size={20} color="#5f5f5f" />
            <Text className="mt-1.5 text-sm text-ink-muted dark:text-slate-400">Sent to Accounts, awaiting verification.</Text>
          </View>
        ) : null}

        {bill.status === 'verified' ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Ionicons name="checkmark-circle-outline" size={20} color="#5f5f5f" />
            <Text className="mt-1.5 text-sm text-ink-muted dark:text-slate-400">Verified — ready for Payment processing.</Text>
          </View>
        ) : null}

        {bill.status === 'payment_pending' || bill.status === 'paid' || bill.status === 'completed' ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Ionicons name="cash-outline" size={20} color="#5f5f5f" />
            <Text className="mt-1.5 text-sm text-ink-muted dark:text-slate-400">{STATUS_LABEL[bill.status]}</Text>
          </View>
        ) : null}

        {bill.status === 'approval_rejected' ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Text className="text-sm text-ink-muted dark:text-slate-400">
              This bill was rejected during approval{bill.approvalRemarks ? `: ${bill.approvalRemarks}` : '.'}
            </Text>
          </View>
        ) : null}

        {bill.status === 'rejected' ? (
          <View className="mt-5 items-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
            <Text className="text-sm text-ink-muted dark:text-slate-400">This bill was rejected by Accounts.</Text>
          </View>
        ) : null}
      </ScrollView>

      <BillDecisionSheet
        decision={pendingDecision}
        isSubmitting={isDeciding}
        onConfirm={handleConfirmDecision}
        onClose={() => setPendingDecision(null)}
      />
    </Screen>
  );
}
