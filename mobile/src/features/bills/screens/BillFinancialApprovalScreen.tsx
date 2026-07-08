import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppHeader } from '@/components/layout/AppHeader';
import { Loader } from '@/components/ui/Loader';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Screen } from '@/components/ui/Screen';
import { useGetBillsQuery, useDecideFinancialApprovalMutation } from '@/features/bills/api/billsApi';
import { useGetPurchaseOrderByQuotationQuery } from '@/features/purchaseOrders/api/purchaseOrdersApi';
import { useGetQuotationsQuery } from '@/features/quotations/api/quotationsApi';
import type { DirectorFinancialDecision } from '@/features/bills/types';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BillFinancialApproval'>;

const RISK_COLOR = { LOW: '#059669', MEDIUM: '#D97706', HIGH: '#DC2626' } as const;
const RISK_BG = { LOW: '#ECFDF5', MEDIUM: '#FFFBEB', HIGH: '#FEF2F2' } as const;
const RISK_ICON: Record<string, 'shield-checkmark' | 'warning' | 'alert-circle'> = {
  LOW: 'shield-checkmark',
  MEDIUM: 'warning',
  HIGH: 'alert-circle',
};

const REC_COLOR = { APPROVE: '#059669', MANUAL_REVIEW: '#D97706', REJECT: '#DC2626' } as const;
const REC_LABEL = { APPROVE: 'Approve', MANUAL_REVIEW: 'Manual Review', REJECT: 'Reject' } as const;
const SEV_COLOR = { HIGH: '#DC2626', MEDIUM: '#D97706', LOW: '#059669' } as const;

function formatINR(amount: number): string {
  return `₹ ${amount.toLocaleString('en-IN')}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ScoreColumn({ value, label }: { value?: number; label: string }) {
  if (value == null) return null;
  const color = value >= 85 ? '#059669' : value >= 65 ? '#D97706' : '#DC2626';
  return (
    <View style={styles.scoreCol}>
      <Text style={[styles.scoreValue, { color }]}>{value}%</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

function AmountColumn({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.amountCol}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

interface RemarksModalProps {
  visible: boolean;
  decision: DirectorFinancialDecision | null;
  onConfirm: (remarks: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RemarksModal({ visible, decision, onConfirm, onCancel, isLoading }: RemarksModalProps) {
  const [text, setText] = useState('');

  const decisionLabel =
    decision === 'rejected' ? 'Reject' : decision === 'correction_required' ? 'Request Correction' : '';
  const decisionColor = decision === 'rejected' ? '#DC2626' : '#D97706';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={[styles.modalTitle, { color: decisionColor }]}>{decisionLabel} — Remarks Required</Text>
          <Text style={styles.modalSubtitle}>
            Please provide a clear reason so the Department User can take corrective action.
          </Text>
          <TextInput
            style={styles.remarksInput}
            multiline
            placeholder="Enter remarks (mandatory)..."
            value={text}
            onChangeText={setText}
            maxLength={2000}
            autoFocus
          />
          <Text style={styles.charCount}>{text.length}/2000</Text>
          <View style={styles.modalButtons}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: decisionColor }, (!text.trim() || isLoading) && styles.btnDisabled]}
              onPress={() => { if (text.trim()) onConfirm(text.trim()); }}
              disabled={!text.trim() || isLoading}
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={styles.confirmBtnText}>Confirm {decisionLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function BillFinancialApprovalScreen({ navigation, route }: Props) {
  const { billId } = route.params;
  const [pendingDecision, setPendingDecision] = useState<DirectorFinancialDecision | null>(null);
  const [remarksModalVisible, setRemarksModalVisible] = useState(false);

  const { data: bills, isLoading: billsLoading } = useGetBillsQuery();
  const bill = bills?.find((b) => b.id === billId);

  const { data: quotations } = useGetQuotationsQuery(undefined, { skip: !bill?.quotationId });
  const quotation = quotations?.find((q) => q.id === bill?.quotationId);

  const { data: po } = useGetPurchaseOrderByQuotationQuery(bill?.quotationId ?? '', {
    skip: !bill?.quotationId,
  });

  const [decideFinancialApproval, { isLoading: isDeciding }] = useDecideFinancialApprovalMutation();

  const ai = po?.aiVerification;
  const alreadyDecided = Boolean(bill?.directorFinancialDecision && bill.directorFinancialDecision !== undefined);

  const handleApprove = async () => {
    if (!bill) return;
    try {
      await decideFinancialApproval({ id: bill.id, decision: 'approved' }).unwrap();
      setTimeout(() => navigation.goBack(), 400);
    } catch (err) {
      Alert.alert('Could Not Approve', getErrorMessage(err));
    }
  };

  const handleNonApproveConfirm = async (remarks: string) => {
    if (!bill || !pendingDecision) return;
    try {
      await decideFinancialApproval({ id: bill.id, decision: pendingDecision, remarks }).unwrap();
      setRemarksModalVisible(false);
      setPendingDecision(null);
      setTimeout(() => navigation.goBack(), 400);
    } catch (err) {
      setRemarksModalVisible(false);
      Alert.alert('Could Not Record Decision', getErrorMessage(err));
    }
  };

  const openRemarksFor = (decision: DirectorFinancialDecision) => {
    setPendingDecision(decision);
    setRemarksModalVisible(true);
  };

  if (billsLoading) {
    return (
      <Screen padded={false}>
        <AppHeader
          title="Financial Approval"
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
          rightSlot={<NotificationBell />}
        />
        <Loader fullscreen />
      </Screen>
    );
  }

  if (!bill) {
    return (
      <Screen padded={false}>
        <AppHeader
          title="Financial Approval"
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
        />
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Bill not found</Text>
          <Text style={styles.emptySubtitle}>It may have been deleted or the link is invalid.</Text>
        </View>
      </Screen>
    );
  }

  const risk = (ai?.risk ?? 'MEDIUM') as keyof typeof RISK_COLOR;
  const rec = (ai?.recommendation ?? 'MANUAL_REVIEW') as keyof typeof REC_COLOR;
  const canDecide = bill.status === 'ai_verified';

  return (
    <Screen padded={false}>
      <AppHeader
        title="Financial Approval"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightSlot={<NotificationBell />}
      />

      {/* ── Fixed header card ── */}
      <View style={styles.headerCard}>
        {/* Three amounts */}
        <View style={styles.amountsRow}>
          <AmountColumn label="Bill Amount" value={formatINR(bill.invoiceAmount)} color="#1E40AF" />
          <View style={styles.amountDivider} />
          <AmountColumn label="PO Amount" value={po ? formatINR(po.grandTotal) : '—'} />
          <View style={styles.amountDivider} />
          <AmountColumn
            label="Quotation Amount"
            value={quotation ? formatINR(Math.round(quotation.amount * (1 + quotation.gst / 100))) : '—'}
          />
        </View>

        {/* AI summary row */}
        {ai ? (
          <View style={styles.aiSummaryRow}>
            <View style={styles.overallScore}>
              <Text style={styles.overallScoreValue}>{ai.matchPercentage}%</Text>
              <Text style={styles.overallScoreLabel}>Overall Match</Text>
            </View>
            <View style={styles.aiSummaryRight}>
              <View style={[styles.riskBadge, { backgroundColor: RISK_BG[risk] }]}>
                <Ionicons name={RISK_ICON[risk]} size={12} color={RISK_COLOR[risk]} />
                <Text style={[styles.riskBadgeText, { color: RISK_COLOR[risk] }]}>Risk: {risk}</Text>
              </View>
              <Text style={styles.confidence}>Confidence: {ai.confidence}%</Text>
              <View style={[styles.recBadge, { backgroundColor: REC_COLOR[rec] + '20' }]}>
                <Ionicons name="bulb-outline" size={11} color={REC_COLOR[rec]} />
                <Text style={[styles.recBadgeText, { color: REC_COLOR[rec] }]}>AI: {REC_LABEL[rec]}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.aiPending}>
            <Ionicons name="hourglass-outline" size={14} color="#D97706" />
            <Text style={styles.aiPendingText}>AI analysis not yet available</Text>
          </View>
        )}

        {/* Action buttons */}
        {canDecide ? (
          <View style={styles.buttonsSection}>
            <Pressable
              style={styles.approveBtn}
              onPress={handleApprove}
              disabled={isDeciding}
              accessibilityRole="button"
              accessibilityLabel="Financially approve this bill"
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.approveBtnText}>{alreadyDecided ? 'Re-Approve' : 'Approve'}</Text>
            </Pressable>

            <View style={styles.twoButtonRow}>
              <Pressable
                style={styles.correctionBtn}
                onPress={() => openRemarksFor('correction_required')}
                disabled={isDeciding}
                accessibilityRole="button"
              >
                <Ionicons name="pencil" size={16} color="#D97706" />
                <Text style={styles.correctionBtnText}>Correction Required</Text>
              </Pressable>

              <Pressable
                style={styles.rejectBtn}
                onPress={() => openRemarksFor('rejected')}
                disabled={isDeciding}
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={16} color="#DC2626" />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </Pressable>
            </View>

            {alreadyDecided ? (
              <View style={styles.alreadyDecidedBanner}>
                <Ionicons name="refresh-outline" size={12} color="#D97706" />
                <Text style={styles.alreadyDecidedText}>
                  You have already acted. Buttons above will update your decision.
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.noActionBanner}>
            <Ionicons
              name={bill.directorFinancialDecision === 'approved' ? 'checkmark-circle' : 'information-circle-outline'}
              size={18}
              color={bill.directorFinancialDecision === 'approved' ? '#059669' : '#94a3b8'}
            />
            <Text style={styles.noActionText}>
              {bill.directorFinancialDecision === 'approved'
                ? 'You approved this bill. Forwarded to Accounts.'
                : bill.directorFinancialDecision === 'rejected'
                  ? 'This bill was rejected.'
                  : bill.directorFinancialDecision === 'correction_required'
                    ? 'Correction requested. Awaiting resubmission.'
                    : `No action available — current status is "${bill.status}".`}
            </Text>
          </View>
        )}
      </View>

      {/* ── Scrollable detail section ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 3-Way Match Scores */}
        {ai && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="analytics-outline" size={16} color="#7C3AED" />
              <Text style={styles.cardTitle}>3-Way Match Analysis</Text>
              <View style={styles.geminiPill}>
                <Text style={styles.geminiPillText}>
                  {ai.aiProvider === 'gemini' ? 'Gemini' : 'Rule Engine'}
                </Text>
              </View>
            </View>
            <View style={styles.scoreRow}>
              <ScoreColumn value={ai.quotationMatch} label="vs Quotation" />
              {ai.quotationMatch != null && ai.purchaseOrderMatch != null && <View style={styles.scoreDivider} />}
              <ScoreColumn value={ai.purchaseOrderMatch} label="vs PO" />
              {ai.purchaseOrderMatch != null && <View style={styles.scoreDivider} />}
              <ScoreColumn value={ai.matchPercentage} label="Overall" />
            </View>
            <View style={styles.engineRow}>
              <Text style={styles.engineLabel}>Rule Engine Score</Text>
              <Text style={styles.engineValue}>{ai.ruleEngineScore ?? '—'}%</Text>
            </View>
          </View>
        )}

        {/* AI Summary */}
        {ai?.summary ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={14} color="#7C3AED" />
              <Text style={styles.cardTitle}>AI Summary</Text>
            </View>
            <Text style={styles.summaryText}>{ai.summary}</Text>
          </View>
        ) : null}

        {/* Differences */}
        {ai && ai.differences.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
              <Text style={styles.cardTitle}>Differences ({ai.differences.length})</Text>
            </View>
            {ai.differences.map((d, i) => (
              <View key={i} style={styles.diffRow}>
                <View style={[styles.diffDot, { backgroundColor: SEV_COLOR[d.severity ?? 'MEDIUM'] }]} />
                <View style={styles.diffContent}>
                  <Text style={styles.diffField}>{d.field}</Text>
                  <Text style={styles.diffDesc}>{d.difference}</Text>
                  {(d.purchaseOrder != null || d.bill != null) && (
                    <View style={styles.diffValues}>
                      <Text style={styles.diffPo} numberOfLines={1}>PO: {String(d.purchaseOrder ?? '—')}</Text>
                      <Text style={styles.diffBill} numberOfLines={1}>Bill: {String(d.bill ?? '—')}</Text>
                    </View>
                  )}
                </View>
                {d.severity && (
                  <View style={[styles.sevBadge, { backgroundColor: SEV_COLOR[d.severity] + '20' }]}>
                    <Text style={[styles.sevText, { color: SEV_COLOR[d.severity] }]}>{d.severity}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Bill Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bill Code</Text>
            <Text style={styles.detailValue}>{bill.billCode}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Number</Text>
            <Text style={styles.detailValue}>{bill.invoiceNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Date</Text>
            <Text style={styles.detailValue}>{formatDate(bill.invoiceDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vendor</Text>
            <Text style={styles.detailValue}>{bill.vendorName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Department</Text>
            <Text style={styles.detailValue}>{bill.departmentName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Taxable Amount</Text>
            <Text style={styles.detailValue}>{formatINR(bill.taxableAmount)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>GST Amount</Text>
            <Text style={styles.detailValue}>{formatINR(bill.gstAmount)}</Text>
          </View>
          {po && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PO Number</Text>
              <Text style={styles.detailValue}>{po.poNumber}</Text>
            </View>
          )}
        </View>

        {/* Director Remarks (if already decided) */}
        {bill.directorFinancialRemarks ? (
          <View style={[styles.card, styles.remarksCard]}>
            <Text style={styles.cardTitle}>Your Previous Remarks</Text>
            <Text style={styles.remarkText}>{bill.directorFinancialRemarks}</Text>
          </View>
        ) : null}
      </ScrollView>

      <RemarksModal
        visible={remarksModalVisible}
        decision={pendingDecision}
        onConfirm={handleNonApproveConfirm}
        onCancel={() => { setRemarksModalVisible(false); setPendingDecision(null); }}
        isLoading={isDeciding}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  amountsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  amountCol: { flex: 1, alignItems: 'center' },
  amountDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB' },
  amountLabel: { fontSize: 10, color: '#6B7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  amountValue: { fontSize: 14, fontWeight: '700', color: '#111827' },

  aiSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  overallScore: { alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, minWidth: 72 },
  overallScoreValue: { fontSize: 22, fontWeight: '800', color: '#1D4ED8' },
  overallScoreLabel: { fontSize: 10, color: '#6B7280', marginTop: 1 },
  aiSummaryRight: { flex: 1, gap: 4 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, alignSelf: 'flex-start' },
  riskBadgeText: { fontSize: 11, fontWeight: '600' },
  confidence: { fontSize: 11, color: '#6B7280' },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, alignSelf: 'flex-start' },
  recBadgeText: { fontSize: 11, fontWeight: '600' },
  aiPending: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFFBEB', borderRadius: 8, marginBottom: 10 },
  aiPendingText: { fontSize: 12, color: '#D97706' },

  buttonsSection: { gap: 8 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, gap: 8 },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  twoButtonRow: { flexDirection: 'row', gap: 8 },
  correctionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#D97706', borderRadius: 12, paddingVertical: 11, gap: 6, backgroundColor: '#FFFBEB' },
  correctionBtnText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#DC2626', borderRadius: 12, paddingVertical: 11, gap: 6, backgroundColor: '#FEF2F2' },
  rejectBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  btnDisabled: { opacity: 0.5 },
  alreadyDecidedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  alreadyDecidedText: { flex: 1, fontSize: 11, color: '#D97706' },
  noActionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  noActionText: { flex: 1, fontSize: 13, color: '#6B7280' },

  scroll: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#374151', flex: 1 },
  geminiPill: { backgroundColor: '#EDE9FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  geminiPillText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },

  scoreRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, paddingVertical: 12 },
  scoreCol: { flex: 1, alignItems: 'center' },
  scoreDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB' },
  scoreValue: { fontSize: 20, fontWeight: '800' },
  scoreLabel: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  engineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  engineLabel: { fontSize: 12, color: '#6B7280' },
  engineValue: { fontSize: 13, fontWeight: '700', color: '#374151' },

  summaryText: { fontSize: 13, color: '#374151', lineHeight: 20 },

  diffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  diffDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  diffContent: { flex: 1 },
  diffField: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  diffDesc: { fontSize: 11, color: '#6B7280', marginTop: 2, lineHeight: 15 },
  diffValues: { flexDirection: 'row', gap: 8, marginTop: 3 },
  diffPo: { fontSize: 11, color: '#1D4ED8', flex: 1 },
  diffBill: { fontSize: 11, color: '#B45309', flex: 1 },
  sevBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  sevText: { fontSize: 10, fontWeight: '700' },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  detailLabel: { fontSize: 12, color: '#9CA3AF' },
  detailValue: { fontSize: 13, fontWeight: '500', color: '#111827', maxWidth: '58%', textAlign: 'right' },

  remarksCard: { backgroundColor: '#FFFBEB' },
  remarkText: { fontSize: 13, color: '#92400E', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 19 },
  remarksInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top', color: '#111827' },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
