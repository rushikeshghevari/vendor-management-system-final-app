import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteConfirmationSheet } from '@/components/departments/DeleteConfirmationSheet';
import { DepartmentBadge } from '@/components/departments/DepartmentBadge';
import { DepartmentSummaryCard } from '@/components/departments/DepartmentSummaryCard';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/components/ui/Screen';
import {
  useDeleteDepartmentMutation,
  useGetDepartmentsQuery,
  useSetDepartmentStatusMutation,
} from '@/features/departments/api/departmentsApi';
import { useGetUsersQuery } from '@/features/users/api/usersApi';
import { useGetVendorsQuery } from '@/features/vendors/api/vendorsApi';
import { getErrorMessage } from '@/utils/getErrorMessage';
import type { DepartmentsStackParamList, MainTabParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<DepartmentsStackParamList, 'DepartmentDetails'>;

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DepartmentDetailsScreen({ navigation, route }: Props) {
  const { departmentId } = route.params;
  const [isDeleteSheetVisible, setIsDeleteSheetVisible] = useState(false);

  const { data: departments, isLoading: isDepartmentLoading } = useGetDepartmentsQuery();
  const { data: users } = useGetUsersQuery();
  const { data: vendors } = useGetVendorsQuery();
  const [setDepartmentStatus] = useSetDepartmentStatusMutation();
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();

  const department = departments?.find((item) => item.id === departmentId);
  const totalUsers = (users ?? []).filter((item) => item.departmentId === departmentId && item.isActive).length;
  const totalVendors = (vendors ?? []).filter((item) => item.departmentId === departmentId && item.status === 'active').length;

  if (isDepartmentLoading) {
    return (
      <Screen padded={false}>
        <AppHeader title="Department Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Loader fullscreen />
      </Screen>
    );
  }

  if (!department) {
    return (
      <Screen padded={false}>
        <AppHeader title="Department Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <Text className="p-6 text-center text-sm text-ink-muted dark:text-slate-400">Department not found.</Text>
      </Screen>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteDepartment(department.id).unwrap();
      setIsDeleteSheetVisible(false);
      navigation.goBack();
    } catch (error) {
      setIsDeleteSheetVisible(false);
      Alert.alert('Could Not Delete Department', getErrorMessage(error));
    }
  };

  const goToUsers = () => navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('Users');

  const handleDeletePress = () => {
    if (totalUsers > 0) {
      Alert.alert(
        'Cannot Delete Department',
        'This department contains active users.\nPlease move or remove all users before deleting this department.',
        [{ text: 'OK', style: 'cancel' }, { text: 'View Users', onPress: goToUsers }],
      );
      return;
    }

    if (totalVendors > 0) {
      Alert.alert(
        'Cannot Delete Department',
        'This department contains active vendors.\nPlease move or remove all vendors before deleting this department.',
        [{ text: 'OK', style: 'cancel' }],
      );
      return;
    }

    setIsDeleteSheetVisible(true);
  };

  const handleToggleStatus = async () => {
    try {
      await setDepartmentStatus({ id: department.id, isActive: !department.isActive }).unwrap();
    } catch (error) {
      Alert.alert('Could Not Update Status', getErrorMessage(error));
    }
  };

  return (
    <Screen padded={false}>
      <AppHeader title="Department Details" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />

      <ScrollView className="flex-1 bg-surface-muted px-4 pt-4 dark:bg-surface-dark" contentContainerStyle={{ paddingBottom: 32 }}>
        <DashboardCard>
          <View className="flex-row items-start justify-between">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
              <Ionicons name="business" size={26} color="#1e88e5" />
            </View>
            <DepartmentBadge isActive={department.isActive} />
          </View>

          <Text className="mt-3 text-xl font-bold text-ink dark:text-white">{department.name}</Text>
          <Text className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">{department.code}</Text>

          <Text className="mt-3 text-sm text-ink-muted dark:text-slate-300">{department.description}</Text>

          {department.departmentHead ? (
            <View className="mt-3 flex-row items-center gap-1.5">
              <Ionicons name="person-outline" size={14} color="#5f5f5f" />
              <Text className="text-xs text-ink-muted dark:text-slate-400">Head: {department.departmentHead}</Text>
            </View>
          ) : null}

          <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="calendar-outline" size={13} color="#5f5f5f" />
              <Text className="text-xs text-ink-muted dark:text-slate-500">Created {formatDate(department.createdAt)}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={13} color="#5f5f5f" />
              <Text className="text-xs text-ink-muted dark:text-slate-500">Updated {formatDate(department.updatedAt)}</Text>
            </View>
          </View>
        </DashboardCard>

        <View className="mt-4 flex-row gap-3">
          <DepartmentSummaryCard
            icon={<Ionicons name="people-outline" size={20} color="#43a047" />}
            value={totalUsers}
            label="Total Users"
          />
          <DepartmentSummaryCard
            icon={<Ionicons name="storefront-outline" size={20} color="#7c3aed" />}
            value={totalVendors}
            label="Total Vendors"
          />
        </View>

        <Button
          label="Edit Department"
          onPress={() => navigation.navigate('EditDepartment', { departmentId: department.id })}
          className="mt-5"
        />
        <Button
          label={department.isActive ? 'Deactivate' : 'Activate'}
          variant="secondary"
          onPress={handleToggleStatus}
          className="mt-3"
        />
        <Button
          label="Delete Department"
          variant="dangerOutline"
          loading={isDeleting}
          onPress={handleDeletePress}
          className="mt-3"
        />
      </ScrollView>

      <DeleteConfirmationSheet
        visible={isDeleteSheetVisible}
        departmentName={department.name}
        onCancel={() => setIsDeleteSheetVisible(false)}
        onConfirm={handleDelete}
      />
    </Screen>
  );
}
