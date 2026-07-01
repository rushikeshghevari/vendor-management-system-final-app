import * as DocumentPicker from 'expo-document-picker';
import { Alert, ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BillForm } from '@/components/bills/BillForm';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/components/ui/Screen';
import {
  useGetBillsQuery,
  useResubmitBillMutation,
  useSubmitBillMutation,
  useUpdateBillMutation,
  useUploadBillInvoiceMutation,
  useUploadBillSupportingDocumentMutation,
} from '@/features/bills/api/billsApi';
import type { BillFormValues } from '@/features/bills/billSchema';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { BillsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<BillsStackParamList, 'EditBill'>;

export function EditBillScreen({ navigation, route }: Props) {
  const { billId } = route.params;
  const { data: bills, isLoading } = useGetBillsQuery();
  const [updateBill, { isLoading: isSaving }] = useUpdateBillMutation();
  const [submitBill, { isLoading: isSubmitting }] = useSubmitBillMutation();
  const [resubmitBill, { isLoading: isResubmitting }] = useResubmitBillMutation();
  const [uploadInvoice, { isLoading: isUploadingInvoice }] = useUploadBillInvoiceMutation();
  const [uploadSupportingDocument, { isLoading: isUploadingSupporting }] = useUploadBillSupportingDocumentMutation();

  const bill = bills?.find((item) => item.id === billId);

  if (isLoading) {
    return (
      <Screen padded={false}>
        <AppHeader title="Edit Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Loader fullscreen />
      </Screen>
    );
  }

  if (!bill) {
    return (
      <Screen padded={false}>
        <AppHeader title="Edit Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Text className="p-6 text-center text-sm text-ink-muted dark:text-slate-400">Bill not found.</Text>
      </Screen>
    );
  }

  const buildPayload = (values: BillFormValues) => ({
    invoiceNumber: values.invoiceNumber,
    invoiceDate: values.invoiceDate,
    invoiceAmount: values.invoiceAmount,
    taxableAmount: values.taxableAmount,
    gstAmount: values.gstAmount,
    paymentTerms: values.paymentTerms,
    dueDate: values.dueDate,
    remarks: values.remarks || undefined,
  });

  const handleSave = async (values: BillFormValues) => {
    try {
      await updateBill({ id: bill.id, body: buildPayload(values) }).unwrap();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could Not Save Bill', getErrorMessage(error));
    }
  };

  const handleSubmitOrResubmit = async (values: BillFormValues) => {
    try {
      await updateBill({ id: bill.id, body: buildPayload(values) }).unwrap();
      if (bill.status === 'correction_requested') {
        await resubmitBill(bill.id).unwrap();
      } else {
        await submitBill(bill.id).unwrap();
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could Not Submit Bill', getErrorMessage(error));
    }
  };

  const handleUploadInvoice = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' } as unknown as Blob);

    try {
      await uploadInvoice({ id: bill.id, formData }).unwrap();
      Alert.alert('Invoice Uploaded', `${asset.name} has been attached as a new version.`);
    } catch (error) {
      Alert.alert('Could Not Upload Invoice', getErrorMessage(error));
    }
  };

  const handleUploadSupportingDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' } as unknown as Blob);

    try {
      await uploadSupportingDocument({ id: bill.id, formData }).unwrap();
      Alert.alert('Document Uploaded', `${asset.name} has been attached.`);
    } catch (error) {
      Alert.alert('Could Not Upload Document', getErrorMessage(error));
    }
  };

  const isCorrectionRequested = bill.status === 'correction_requested';

  return (
    <Screen padded={false}>
      <AppHeader title="Edit Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView
        className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {isCorrectionRequested && bill.accountsRemarks ? (
          <DashboardCard className="mb-4 border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">Accounts Remarks</Text>
            <Text className="mt-1 text-sm text-amber-900 dark:text-amber-200">{bill.accountsRemarks}</Text>
          </DashboardCard>
        ) : null}

        <DashboardCard className="mb-4">
          <Text className="text-sm font-semibold text-ink dark:text-slate-200">Invoice PDF</Text>
          <Text className="mt-1 text-xs text-ink-muted dark:text-slate-400">
            {bill.invoiceFiles.length > 0
              ? `${bill.invoiceFiles.length} version(s) uploaded — latest: ${bill.invoiceFiles[bill.invoiceFiles.length - 1]?.fileName}`
              : 'No invoice PDF uploaded yet.'}
          </Text>
          <Button
            label={bill.invoiceFiles.length > 0 ? 'Upload Revised Invoice PDF' : 'Upload Invoice PDF'}
            variant="secondary"
            loading={isUploadingInvoice}
            onPress={handleUploadInvoice}
            className="mt-3"
          />
        </DashboardCard>

        <DashboardCard className="mb-4">
          <Text className="text-sm font-semibold text-ink dark:text-slate-200">Supporting Documents (Optional)</Text>
          <Text className="mt-1 text-xs text-ink-muted dark:text-slate-400">
            {bill.supportingDocuments.length > 0 ? `${bill.supportingDocuments.length} document(s) uploaded.` : 'No supporting documents uploaded.'}
          </Text>
          <Button
            label="Upload Supporting Document"
            variant="secondary"
            loading={isUploadingSupporting}
            onPress={handleUploadSupportingDocument}
            className="mt-3"
          />
        </DashboardCard>

        <BillForm
          billCode={bill.billCode}
          quotationCode={bill.quotationCode}
          vendorName={`${bill.vendorName} (${bill.vendorCode})`}
          departmentName={bill.departmentName}
          defaultValues={{
            invoiceNumber: bill.invoiceNumber,
            invoiceDate: bill.invoiceDate.slice(0, 10),
            invoiceAmount: String(bill.invoiceAmount) as unknown as number,
            taxableAmount: String(bill.taxableAmount) as unknown as number,
            gstAmount: String(bill.gstAmount) as unknown as number,
            paymentTerms: bill.paymentTerms,
            dueDate: bill.dueDate.slice(0, 10),
            remarks: bill.remarks ?? '',
          }}
          primaryLabel="Save Changes"
          secondaryLabel={isCorrectionRequested ? 'Resubmit' : 'Submit to Accounts'}
          isPrimarySubmitting={isSaving}
          isSecondarySubmitting={isSubmitting || isResubmitting}
          onPrimarySubmit={handleSave}
          onSecondarySubmit={handleSubmitOrResubmit}
          onCancel={() => navigation.goBack()}
        />
      </ScrollView>
    </Screen>
  );
}
