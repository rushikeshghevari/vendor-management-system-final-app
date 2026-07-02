import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/layout/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useDrawer } from '@/navigation/context/DrawerContext';

interface ComingSoonScreenProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** Placeholder destination for tabs whose module hasn't been built yet. */
export function ComingSoonScreen({ title, icon }: ComingSoonScreenProps) {
  const drawer = useDrawer();
  return (
    <Screen padded={false}>
      <AppHeader
        title={title}
        leftIcon={drawer ? 'menu-outline' : undefined}
        onLeftPress={drawer ? () => drawer.openDrawer() : undefined}
      />
      <Ionicons name={icon} size={48} color="#cbd5e1" style={{ alignSelf: 'center', marginTop: 64 }} />
      <EmptyState title={`${title} coming soon`} description="This module hasn't been built yet." />
    </Screen>
  );
}
