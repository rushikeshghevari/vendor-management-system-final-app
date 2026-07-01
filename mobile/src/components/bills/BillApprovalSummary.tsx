import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import type { BillApproval, BillApprovalStatus } from '@/features/bills/types';

interface BillApprovalSummaryProps {
  approvals: BillApproval[];
}

const DECISION_LABEL: Record<BillApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  negotiation: 'Negotiation',
  rejected: 'Rejected',
};

const DECISION_VARIANT: Record<BillApprovalStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  pending: 'neutral',
  approved: 'success',
  negotiation: 'primary',
  rejected: 'danger',
};

const DECISION_EMOJI: Record<BillApprovalStatus, string> = {
  pending: '⏳',
  approved: '✅',
  negotiation: '🟠',
  rejected: '❌',
};

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(isoDate: string | null): string {
  if (!isoDate) return '—';
  const date = formatDate(isoDate);
  const time = new Date(isoDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} ${time}`;
}

/** Derived purely from `billApprovals` — never a separate stored field. Rejected takes
 *  priority (any single approver can block), then Negotiation, then Approved only once
 *  every approver has acted; otherwise the bill is still Pending. Mirrors
 *  components/quotations/DirectorApprovalSummary.tsx exactly. */
function deriveOverallStatus(approvals: BillApproval[]): BillApprovalStatus {
  if (approvals.length === 0) return 'pending';
  if (approvals.some((entry) => entry.decision === 'rejected')) return 'rejected';
  if (approvals.some((entry) => entry.decision === 'negotiation')) return 'negotiation';
  if (approvals.every((entry) => entry.decision === 'approved')) return 'approved';
  return 'pending';
}

function deriveLastUpdated(approvals: BillApproval[]): string | null {
  const decidedDates = approvals.map((entry) => entry.approvedAt).filter((value): value is string => Boolean(value));
  if (decidedDates.length === 0) return null;
  return decidedDates.reduce((latest, current) => (new Date(current).getTime() > new Date(latest).getTime() ? current : latest));
}

/** Quick-glance overview shown above the full Bill Approval History. */
export function BillApprovalSummary({ approvals }: BillApprovalSummaryProps) {
  const overallStatus = deriveOverallStatus(approvals);
  const lastUpdated = deriveLastUpdated(approvals);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-medium text-ink-muted dark:text-slate-500">Overall Status</Text>
        <Badge label={DECISION_LABEL[overallStatus]} variant={DECISION_VARIANT[overallStatus]} />
      </View>

      <View className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {approvals.length === 0 ? (
          <Text className="text-sm text-ink-muted dark:text-slate-400">No approvers are configured yet.</Text>
        ) : (
          approvals.map((approval, index) => (
            <View
              key={approval.approverId}
              className={`flex-row items-center justify-between ${index === 0 ? '' : 'mt-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800'}`}
            >
              <Text className="text-sm font-medium text-ink dark:text-slate-200">{approval.approverName}</Text>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-sm">{DECISION_EMOJI[approval.decision]}</Text>
                <Text className="text-xs text-ink-muted dark:text-slate-500">{DECISION_LABEL[approval.decision]}</Text>
                <Text className="text-xs text-ink-muted dark:text-slate-500">· {formatDate(approval.approvedAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <Text className="text-xs font-medium text-ink-muted dark:text-slate-500">Last Updated</Text>
        <Text className="text-xs text-ink-muted dark:text-slate-500">{formatDateTime(lastUpdated)}</Text>
      </View>
    </View>
  );
}
