import { Pressable, Text, View } from 'react-native';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      className="flex-row items-center py-1"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-md border-2 ${
          checked
            ? 'border-primary-600 bg-primary-600'
            : 'border-slate-300 bg-transparent dark:border-slate-600'
        }`}
      >
        {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
      </View>
      <Text className="ml-2 text-sm text-ink dark:text-slate-200">{label}</Text>
    </Pressable>
  );
}
