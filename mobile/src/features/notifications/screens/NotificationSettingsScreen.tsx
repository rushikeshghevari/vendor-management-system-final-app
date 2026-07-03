import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/ui/Screen';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  useGetMyDevicesQuery,
  useRemoveDeviceMutation,
  useGetNotificationAnalyticsQuery,
  useBroadcastNotificationMutation,
  useDeleteAllNotificationsMutation,
} from '@/features/notifications/api/notificationsApi';
import type { NotificationsStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { ROLES } from '@/constants/roles';

type Props = NativeStackScreenProps<NotificationsStackParamList, 'NotificationSettings'>;

export function NotificationSettingsScreen({ navigation }: Props) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(ROLES.SUPER_ADMIN);

  const [pushEnabled,      setPushEnabled]      = useState(true);
  const [soundEnabled,     setSoundEnabled]      = useState(true);
  const [vibrationEnabled, setVibrationEnabled]  = useState(true);
  const [broadcastTitle,   setBroadcastTitle]    = useState('');
  const [broadcastMessage, setBroadcastMessage]  = useState('');

  const { data: devices = [] }    = useGetMyDevicesQuery();
  const { data: analytics }       = useGetNotificationAnalyticsQuery(undefined, { skip: !isSuperAdmin });
  const [removeDevice]            = useRemoveDeviceMutation();
  const [broadcast, { isLoading: isBroadcasting }] = useBroadcastNotificationMutation();
  const [deleteAll]               = useDeleteAllNotificationsMutation();

  const handleRemoveDevice = (deviceId: string, deviceName: string) => {
    Alert.alert('Remove Device', `Remove notifications for "${deviceName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeDevice({ deviceId }).catch(() => null),
      },
    ]);
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }
    try {
      const result = await broadcast({ title: broadcastTitle.trim(), message: broadcastMessage.trim() }).unwrap();
      Alert.alert('Broadcast Sent', `Sent to ${result.sent} users`);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch {
      Alert.alert('Error', 'Failed to send broadcast');
    }
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Notifications', 'Delete all your notifications?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => deleteAll().catch(() => null) },
    ]);
  };

  return (
    <Screen padded={false}>
      <AppHeader title="Notification Settings" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingRow
            label="Push Notifications"
            description="Receive push alerts on this device"
            icon="notifications-outline"
            value={pushEnabled}
            onToggle={setPushEnabled}
          />
          <SettingRow
            label="Sound"
            description="Play sound for notifications"
            icon="volume-medium-outline"
            value={soundEnabled}
            onToggle={setSoundEnabled}
          />
          <SettingRow
            label="Vibration"
            description="Vibrate on notification"
            icon="phone-portrait-outline"
            value={vibrationEnabled}
            onToggle={setVibrationEnabled}
          />
        </View>

        {/* Registered Devices */}
        <SectionHeader title={`Registered Devices (${devices.length})`} />
        <View style={styles.card}>
          {devices.length === 0 ? (
            <Text style={styles.emptyText}>No devices registered</Text>
          ) : (
            devices.map((device, idx) => (
              <View key={idx} style={styles.deviceRow}>
                <Ionicons
                  name={device.platform === 'ios' ? 'logo-apple' : device.platform === 'android' ? 'logo-android' : 'globe-outline'}
                  size={20}
                  color="#6B7280"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>{device.deviceName ?? device.deviceId}</Text>
                  <Text style={styles.deviceMeta}>
                    {device.platform.toUpperCase()} · Last used {new Date(device.lastUsed).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveDevice(device.deviceId, device.deviceName ?? device.deviceId)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Super Admin: Analytics */}
        {isSuperAdmin && analytics && (
          <>
            <SectionHeader title="Analytics" />
            <View style={styles.card}>
              <AnalyticRow label="Total Sent"      value={analytics.total.toString()} />
              <AnalyticRow label="Delivered"        value={analytics.delivered.toString()} />
              <AnalyticRow label="Read"             value={analytics.read.toString()} />
              <AnalyticRow label="Unread"           value={analytics.unread.toString()} />
              <AnalyticRow label="Read Rate"        value={`${analytics.readPercentage}%`} />
            </View>
          </>
        )}

        {/* Super Admin: Broadcast */}
        {isSuperAdmin && (
          <>
            <SectionHeader title="Broadcast to All Users" />
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Title</Text>
              <View style={styles.inputBox}>
                <Text
                  style={{ fontSize: 14, color: broadcastTitle ? '#111827' : '#9CA3AF' }}
                  onPress={() => null}
                >
                  {broadcastTitle || 'Announcement title...'}
                </Text>
              </View>
              <Text style={styles.inputLabel}>Message</Text>
              <View style={[styles.inputBox, { minHeight: 70 }]}>
                <Text style={{ fontSize: 14, color: broadcastMessage ? '#111827' : '#9CA3AF' }}>
                  {broadcastMessage || 'Write your announcement...'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.broadcastBtn, isBroadcasting && { opacity: 0.6 }]}
                onPress={handleBroadcast}
                disabled={isBroadcasting}
              >
                <Ionicons name="radio-outline" size={18} color="#fff" />
                <Text style={styles.broadcastBtnText}>
                  {isBroadcasting ? 'Sending...' : 'Send Broadcast'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Danger zone */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <Text style={styles.dangerBtnText}>Clear All Notifications</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </Screen>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingRow({
  label, description, icon, value, onToggle,
}: {
  label: string; description: string; icon: keyof typeof Ionicons.glyphMap;
  value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color="#2563EB" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: '#2563EB' }} />
    </View>
  );
}

function AnalyticRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.analyticRow}>
      <Text style={styles.analyticLabel}>{label}</Text>
      <Text style={styles.analyticValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:          { paddingBottom: 40 },
  sectionHeader:   { fontSize: 12, fontWeight: '700', color: '#6B7280', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  card:            { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  settingRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  settingIcon:     { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  settingLabel:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  settingDesc:     { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  deviceRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  deviceName:      { fontSize: 14, fontWeight: '600', color: '#111827' },
  deviceMeta:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  emptyText:       { fontSize: 13, color: '#9CA3AF', padding: 16, textAlign: 'center' },
  analyticRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  analyticLabel:   { fontSize: 13, color: '#6B7280' },
  analyticValue:   { fontSize: 13, fontWeight: '700', color: '#111827' },
  inputLabel:      { fontSize: 12, fontWeight: '600', color: '#374151', marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  inputBox:        { backgroundColor: '#F9FAFB', marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 10 },
  broadcastBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', margin: 16, borderRadius: 8, paddingVertical: 12 },
  broadcastBtnText:{ color: '#fff', fontSize: 14, fontWeight: '700' },
  dangerBtn:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  dangerBtnText:   { fontSize: 14, fontWeight: '600', color: '#DC2626' },
});
