import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { BillApproval, BillApprovalStatus } from '@/features/bills/types';

interface BillApprovalHistoryProps {
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

const DECISION_ICON: Record<BillApprovalStatus, keyof typeof Ionicons.glyphMap> = {
  pending: 'hourglass-outline',
  approved: 'checkmark-circle',
  negotiation: 'swap-horizontal',
  rejected: 'close-circle',
};

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoDate: string | null): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Timeline/card view — every approver's decision is independent, never a single shared
 *  verdict. Newest decided entry first; approvers who haven't acted yet sort to the bottom
 *  as "Pending". Mirrors components/quotations/DirectorApprovalHistory.tsx exactly. */
export function BillApprovalHistory({ approvals }: BillApprovalHistoryProps) {
  if (approvals.length === 0) {
    return <Text className="text-sm text-ink-muted dark:text-slate-400">No approvers are configured yet.</Text>;
  }

  return (
    <View>
      {approvals.map((approval, index) => (
        <View
          key={approval.approverId}
          className={`flex-row gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 ${index === 0 ? 'border-t-0 pt-0' : 'mt-3'}`}
        >
          <Avatar initials={approval.approverName.charAt(0).toUpperCase() || 'A'} size={36} />
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-ink dark:text-white">{approval.approverName}</Text>
              <Badge label={DECISION_LABEL[approval.decision]} variant={DECISION_VARIANT[approval.decision]} />
            </View>

            <View className="mt-1 flex-row items-center gap-1.5">
              <Ionicons
                name={DECISION_ICON[approval.decision]}
                size={13}
                color={approval.decision === 'pending' ? '#94a3b8' : '#5f5f5f'}
              />
              {approval.approvedAt ? (
                <Text className="text-xs text-ink-muted dark:text-slate-500">
                  {formatDate(approval.approvedAt)} · {formatTime(approval.approvedAt)}
                </Text>
              ) : (
                <Text className="text-xs text-ink-muted dark:text-slate-500">Awaiting action</Text>
              )}
            </View>

            {approval.remarks ? <Text className="mt-1 text-sm text-ink dark:text-slate-200">{approval.remarks}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
