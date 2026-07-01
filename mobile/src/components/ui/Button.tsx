import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: { container: 'bg-primary-600 active:bg-primary-700', text: 'text-white' },
  secondary: {
    container: 'bg-slate-100 active:bg-slate-200 dark:bg-slate-800',
    text: 'text-slate-900 dark:text-white',
  },
  danger: { container: 'bg-red-600 active:bg-red-700', text: 'text-white' },
  dangerOutline: {
    container: 'border border-red-300 bg-transparent active:bg-red-50 dark:border-red-800 dark:active:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
  },
  ghost: { container: 'bg-transparent', text: 'text-primary-600' },
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const styles = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl px-4 py-3 ${styles.container} ${
        isDisabled ? 'opacity-50' : ''
      } ${className}`}
      {...pressableProps}
    >
      {loading && <ActivityIndicator size="small" className="mr-2" />}
      <Text className={`text-base font-semibold ${styles.text}`}>{label}</Text>
    </Pressable>
  );
}
