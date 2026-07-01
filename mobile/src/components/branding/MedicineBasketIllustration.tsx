import { View, type ImageStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MedicineBasketIllustrationProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Splash screen illustration slot. No final artwork yet — renders an icon-based
 * placeholder until the real PNG is dropped in.
 *
 * To swap in the final asset once provided:
 *   1. Save it at mobile/assets/images/medicine-basket.png
 *   2. Replace this component's body with:
 *        <Image source={require('../../../assets/images/medicine-basket.png')}
 *               resizeMode="contain" style={[{ width: size, height: size }, style]} />
 */
export function MedicineBasketIllustration({ size = 180, style }: MedicineBasketIllustrationProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Medicine basket illustration placeholder"
      style={[
        {
          width: size,
          height: size,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#99c7f5',
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#e8f1fc',
        },
        style,
      ]}
    >
      <Ionicons name="basket-outline" size={size * 0.45} color="#1e88e5" />
    </View>
  );
}
