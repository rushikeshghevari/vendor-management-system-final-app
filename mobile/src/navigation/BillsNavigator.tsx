import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BillDetailsScreen } from '@/features/bills/screens/BillDetailsScreen';
import { BillListScreen } from '@/features/bills/screens/BillListScreen';
import { CreateBillScreen } from '@/features/bills/screens/CreateBillScreen';
import { EditBillScreen } from '@/features/bills/screens/EditBillScreen';
import type { BillsStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<BillsStackParamList>();

export function BillsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BillList" component={BillListScreen} />
      <Stack.Screen name="BillDetails" component={BillDetailsScreen} />
      <Stack.Screen name="CreateBill" component={CreateBillScreen} />
      <Stack.Screen name="EditBill" component={EditBillScreen} />
    </Stack.Navigator>
  );
}
