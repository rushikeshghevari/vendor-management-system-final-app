import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller } from 'react-hook-form';
import { Text, View } from 'react-native';

import { ChipSelect } from '@/components/users/ChipSelect';
import { Button } from '@/components/ui/Button';
import { FormTextField } from '@/components/ui/FormTextField';
import { TextField } from '@/components/ui/TextField';
import { vendorSchema, type VendorFormValues } from '@/features/vendors/vendorSchema';

const CATEGORY_OPTIONS = [
  { value: 'Pharmaceutical', label: 'Pharmaceutical' },
  { value: 'Packaging', label: 'Packaging' },
  { value: 'Raw Material', label: 'Raw Material' },
  { value: 'Equipment', label: 'Equipment' },
  { value: 'Logistics', label: 'Logistics' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'inactive' as const, label: 'Inactive' },
  { value: 'blacklisted' as const, label: 'Blacklisted' },
];

interface VendorFormProps {
  departmentName: string;
  vendorCode?: string;
  defaultValues?: Partial<VendorFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: VendorFormValues) => void;
  onCancel: () => void;
}

export function VendorForm({
  departmentName,
  vendorCode,
  defaultValues,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: VendorFormProps) {
  const { control, handleSubmit } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      gstNumber: '',
      panNumber: '',
      address: '',
      state: '',
      district: '',
      city: '',
      pincode: '',
      bankName: '',
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      upiId: '',
      category: 'Pharmaceutical',
      status: 'active',
      ...defaultValues,
    },
  });

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-ink dark:text-slate-200">Vendor Code</Text>
      <TextField
        label=""
        value={vendorCode ?? 'Auto-generated after saving'}
        editable={false}
        className="bg-slate-100 text-ink-muted dark:bg-slate-800"
      />

      <TextField label="Department" value={departmentName} editable={false} className="bg-slate-100 text-ink-muted dark:bg-slate-800" />

      <FormTextField control={control} name="name" label="Vendor Name" placeholder="e.g. Medisure Pharma" autoCapitalize="words" />
      <FormTextField control={control} name="contactPerson" label="Contact Person" placeholder="e.g. Ramesh Gupta" autoCapitalize="words" />
      <FormTextField control={control} name="phone" label="Mobile" placeholder="10-digit mobile number" keyboardType="phone-pad" />
      <FormTextField control={control} name="email" label="Email" placeholder="vendor@example.com" keyboardType="email-address" autoCapitalize="none" />
      <FormTextField control={control} name="gstNumber" label="GST Number (optional)" placeholder="e.g. 27AAACM1234A1Z5" autoCapitalize="characters" />
      <FormTextField control={control} name="panNumber" label="PAN Number (optional)" placeholder="e.g. AAACM1234A" autoCapitalize="characters" />

      <FormTextField control={control} name="address" label="Address" placeholder="Street / area" multiline numberOfLines={2} className="h-16" />
      <FormTextField control={control} name="state" label="State" placeholder="e.g. Maharashtra" autoCapitalize="words" />
      <FormTextField control={control} name="district" label="District" placeholder="e.g. Pune" autoCapitalize="words" />
      <FormTextField control={control} name="city" label="City" placeholder="e.g. Pune" autoCapitalize="words" />
      <FormTextField control={control} name="pincode" label="Pincode" placeholder="6-digit pincode" keyboardType="number-pad" />

      <FormTextField control={control} name="bankName" label="Bank Name" placeholder="e.g. HDFC Bank" autoCapitalize="words" />
      <FormTextField control={control} name="accountHolderName" label="Account Holder Name" placeholder="As per bank records" autoCapitalize="words" />
      <FormTextField control={control} name="accountNumber" label="Account Number" placeholder="Bank account number" keyboardType="number-pad" />
      <FormTextField control={control} name="ifscCode" label="IFSC Code" placeholder="e.g. HDFC0001234" autoCapitalize="characters" />
      <FormTextField control={control} name="upiId" label="UPI ID (optional)" placeholder="e.g. vendor@bank" autoCapitalize="none" />

      <Controller
        control={control}
        name="category"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <ChipSelect label="Vendor Category" value={value} options={CATEGORY_OPTIONS} onChange={onChange} errorMessage={error?.message} />
        )}
      />

      <Controller
        control={control}
        name="status"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <ChipSelect label="Status" value={value} options={STATUS_OPTIONS} onChange={onChange} errorMessage={error?.message} />
        )}
      />

      <Button label={submitLabel} loading={isSubmitting} onPress={handleSubmit(onSubmit)} className="mt-2" />
      <Button label="Cancel" variant="secondary" onPress={onCancel} className="mt-3" />
    </View>
  );
}
