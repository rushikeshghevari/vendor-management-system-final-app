import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BillForm } from '@/components/bills/BillForm';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/components/ui/Screen';
import { useCreateBillMutation, useSubmitBillMutation, useUploadBillInvoiceMutation } from '@/features/bills/api/billsApi';
import type { BillFormValues } from '@/features/bills/billSchema';
import { useGetPurchaseOrderByQuotationQuery } from '@/features/purchaseOrders/api/purchaseOrdersApi';
import { useGetQuotationsQuery } from '@/features/quotations/api/quotationsApi';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { BillsStackParamList, DepartmentUserTabParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<BillsStackParamList, 'CreateBill'>;

type PickedFile = { uri: string; name: string; mimeType?: string | null };

export function CreateBillScreen({ navigation, route }: Props) {
  const { quotationId } = route.params;
  const { data: quotations, isLoading } = useGetQuotationsQuery();
  const [createBill, { isLoading: isSavingDraft }] = useCreateBillMutation();
  const [submitBill, { isLoading: isSubmitting }] = useSubmitBillMutation();
  const [uploadInvoice, { isLoading: isUploading }] = useUploadBillInvoiceMutation();
  // The backend now requires a Purchase Order to exist before a Bill can be created (see
  // billService.create) — checked here too so the user sees why, instead of a raw 400 error
  // after filling out the whole form.
  const { data: linkedPo, isLoading: isLoadingPo } = useGetPurchaseOrderByQuotationQuery(quotationId, {
    skip: !quotationId,
  });

  const [invoiceFile, setInvoiceFile] = useState<PickedFile | null>(null);

  const quotation = quotations?.find((item) => item.id === quotationId);

  if (isLoading || isLoadingPo) {
    return (
      <Screen padded={false}>
        <AppHeader title="Create Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Loader fullscreen />
      </Screen>
    );
  }

  if (!quotation) {
    return (
      <Screen padded={false}>
        <AppHeader title="Create Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Text className="p-6 text-center text-sm text-ink-muted dark:text-slate-400">Quotation not found.</Text>
      </Screen>
    );
  }

  if (quotation.status !== 'approved') {
    return (
      <Screen padded={false}>
        <AppHeader title="Create Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Text className="p-6 text-center text-sm text-ink-muted dark:text-slate-400">
          {quotation.status === 'billed'
            ? 'Bill already created for this quotation.'
            : 'A bill can only be created for an Approved quotation.'}
        </Text>
      </Screen>
    );
  }

  if (!linkedPo) {
    return (
      <Screen padded={false}>
        <AppHeader title="Create Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="alert-circle-outline" size={40} color="#d97706" />
          <Text className="mt-3 text-center text-base font-semibold text-ink dark:text-white">
            Purchase Order required
          </Text>
          <Text className="mt-1.5 text-center text-sm text-ink-muted dark:text-slate-400">
            A Purchase Order must be generated for "{quotation.quotationCode}" before a Bill can be created.
          </Text>
          <Button
            label="Generate Purchase Order"
            onPress={() =>
              navigation
                .getParent<BottomTabNavigationProp<DepartmentUserTabParamList>>()
                ?.navigate('PurchaseOrders', { screen: 'CreatePurchaseOrder', params: { quotationId } })
            }
            className="mt-5"
          />
        </View>
      </Screen>
    );
  }

  const handlePickInvoice = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setInvoiceFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  };

  const buildPayload = (values: BillFormValues) => ({
    quotation: quotationId,
    invoiceNumber: values.invoiceNumber,
    invoiceDate: values.invoiceDate,
    invoiceAmount: values.invoiceAmount,
    taxableAmount: values.taxableAmount,
    gstAmount: values.gstAmount,
    paymentTerms: values.paymentTerms,
    dueDate: values.dueDate,
    remarks: values.remarks || undefined,
  });

  const createWithInvoice = async (values: BillFormValues) => {
    if (!invoiceFile) {
      Alert.alert('Invoice PDF Required', 'Upload the Invoice PDF before saving this bill.');
      return null;
    }

    const bill = await createBill(buildPayload(values)).unwrap();

    const formData = new FormData();
    formData.append('file', { uri: invoiceFile.uri, name: invoiceFile.name, type: invoiceFile.mimeType ?? 'application/pdf' } as unknown as Blob);
    await uploadInvoice({ id: bill.id, formData }).unwrap();

    return bill;
  };

  const handleSaveDraft = async (values: BillFormValues) => {
    try {
      const bill = await createWithInvoice(values);
      if (!bill) return;
      navigation.replace('BillDetails', { billId: bill.id });
    } catch (error) {
      Alert.alert('Could Not Save Bill', getErrorMessage(error));
    }
  };

  const handleSubmitToAccounts = async (values: BillFormValues) => {
    try {
      const bill = await createWithInvoice(values);
      if (!bill) return;
      await submitBill(bill.id).unwrap();
      navigation.replace('BillDetails', { billId: bill.id });
    } catch (error) {
      Alert.alert('Could Not Submit Bill', getErrorMessage(error));
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader title="Create Bill" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView
        className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <DashboardCard className="mb-4">
          <Text className="text-sm font-semibold text-ink dark:text-slate-200">Purchase Order</Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-ink-muted dark:text-slate-400">{linkedPo.poNumber}</Text>
            <Text className="text-sm font-bold text-primary-600">
              ₹ {linkedPo.grandTotal.toLocaleString('en-IN')} available
            </Text>
          </View>
          <Text className="mt-1 text-[11px] text-ink-muted dark:text-slate-500">
            Your invoice amount cannot exceed this balance.
          </Text>
        </DashboardCard>

        <DashboardCard className="mb-4">
          <Text className="text-sm font-semibold text-ink dark:text-slate-200">Invoice PDF</Text>
          <Text className="mt-1 text-xs text-ink-muted dark:text-slate-400">
            {invoiceFile ? invoiceFile.name : 'No PDF selected yet. PDF only, up to 10 MB.'}
          </Text>
          <Button label={invoiceFile ? 'Change Invoice PDF' : 'Select Invoice PDF'} variant="secondary" onPress={handlePickInvoice} className="mt-3" />
        </DashboardCard>

        <BillForm
          quotationCode={quotation.quotationCode}
          vendorName={`${quotation.vendorName} (${quotation.vendorCode})`}
          departmentName={quotation.departmentName}
          primaryLabel="Save as Draft"
          secondaryLabel="Submit to Accounts"
          isPrimarySubmitting={isSavingDraft || isUploading}
          isSecondarySubmitting={isSubmitting || isUploading}
          onPrimarySubmit={handleSaveDraft}
          onSecondarySubmit={handleSubmitToAccounts}
          onCancel={() => navigation.goBack()}
        />
      </ScrollView>
    </Screen>
  );
}
