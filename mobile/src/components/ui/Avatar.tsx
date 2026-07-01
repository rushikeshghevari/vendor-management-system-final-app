import { Text, View } from 'react-native';

interface AvatarProps {
  initials: string;
  size?: number;
  online?: boolean;
}

/** Circular initials avatar, optionally showing a green online-status dot. */
export function Avatar({ initials, size = 36, online = false }: AvatarProps) {
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center rounded-full bg-primary-600">
      <Text className="text-sm font-bold text-white">{initials}</Text>
      {online ? (
        <View
          className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-success-500"
          style={{ width: size * 0.32, height: size * 0.32 }}
        />
      ) : null}
    </View>
  );
}
