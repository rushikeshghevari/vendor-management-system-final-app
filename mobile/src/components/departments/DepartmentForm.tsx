import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ChipSelect } from '@/components/departments/ChipSelect';
import { Button } from '@/components/ui/Button';
import { FormTextField } from '@/components/ui/FormTextField';
import { generateDepartmentCode } from '@/features/departments/generateDepartmentCode';
import { departmentSchema, type DepartmentFormValues } from '@/features/departments/departmentSchema';

const STATUS_OPTIONS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'inactive' as const, label: 'Inactive' },
];

interface DepartmentFormProps {
  mode: 'add' | 'edit';
  defaultValues?: Partial<DepartmentFormValues>;
  /** Codes of all other existing departments, used to keep the auto-generated code unique. */
  existingCodes: string[];
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: DepartmentFormValues) => void;
  onCancel: () => void;
}

export function DepartmentForm({
  mode,
  defaultValues,
  existingCodes,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: DepartmentFormProps) {
  const { control, handleSubmit, watch, setValue } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      departmentHead: '',
      status: 'active',
      ...defaultValues,
    },
  });

  const nameValue = watch('name');

  // Add mode: the code is always derived from the name as the user types, and stays read-only.
  useEffect(() => {
    if (mode !== 'add') return;
    setValue('code', nameValue ? generateDepartmentCode(nameValue, existingCodes) : '');
  }, [mode, nameValue, existingCodes, setValue]);

  // Edit mode: the existing code is left untouched unless the user explicitly regenerates it.
  const handleRegenerate = () => setValue('code', generateDepartmentCode(nameValue ?? '', existingCodes));

  return (
    <View>
      <FormTextField control={control} name="name" label="Department Name" placeholder="e.g. Quality Department" autoCapitalize="words" />

      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-ink dark:text-slate-200">Department Code</Text>
        {mode === 'add' ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="sync-circle" size={16} color="#1e88e5" />
            <Text className="text-xs font-semibold text-primary-600">Auto-generated</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regenerate department code"
            onPress={handleRegenerate}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="refresh-outline" size={16} color="#1e88e5" />
            <Text className="text-xs font-semibold text-primary-600">Regenerate</Text>
          </Pressable>
        )}
      </View>
      <FormTextField
        control={control}
        name="code"
        label=""
        placeholder="e.g. QUA006"
        autoCapitalize="characters"
        editable={false}
        className="bg-slate-100 dark:bg-slate-800"
      />

      <FormTextField
        control={control}
        name="description"
        label="Description"
        placeholder="What does this department do?"
        multiline
        numberOfLines={3}
        className="h-20"
      />

      <FormTextField
        control={control}
        name="departmentHead"
        label="Department Head (optional)"
        placeholder="e.g. Rohit Bansal"
        autoCapitalize="words"
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
