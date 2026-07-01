import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SettingsListItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  /** Renders a toggle switch instead of a chevron (e.g. Biometric Login). */
  toggle?: { value: boolean; onChange: (value: boolean) => void };
}

export function SettingsListItem({ icon, label, onPress, toggle }: SettingsListItemProps) {
  return (
    <Pressable
      accessibilityRole={toggle ? undefined : 'button'}
      accessibilityLabel={label}
      onPress={toggle ? undefined : onPress}
      disabled={!onPress && !toggle}
      className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5 active:bg-slate-50 dark:border-slate-800 dark:active:bg-slate-800"
    >
      <Ionicons name={icon} size={20} color="#1e88e5" />
      <Text className="flex-1 text-sm font-medium text-ink dark:text-slate-200">{label}</Text>

      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          accessibilityLabel={label}
          trackColor={{ true: '#1e88e5', false: '#cbd5e1' }}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      )}
    </Pressable>
  );
}
