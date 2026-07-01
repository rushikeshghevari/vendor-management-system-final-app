import { NavigationContainer } from '@react-navigation/native';
import { screen } from '@testing-library/react-native';

import { ROLES } from '@/constants/roles';
import { sessionRestored } from '@/features/auth/authSlice';
import { MainNavigator } from '@/navigation/MainNavigator';
import { createStore } from '@/store';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User } from '@/types/auth';

function renderAsRole(role: User['role']) {
  const store = createStore();
  store.dispatch(
    sessionRestored({ id: '1', name: 'Test User', email: 'user@vms.local', role }),
  );

  return renderWithProviders(
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>,
    store,
  );
}

describe('MainNavigator bottom tabs', () => {
  it('shows all five tabs regardless of role', () => {
    renderAsRole(ROLES.SUPER_ADMIN);

    // Super Admin uses drawer navigation (tab bar is hidden).
    // All labels appear in the always-rendered DrawerContent; some also appear
    // in Dashboard KPI cards, so use getAllByText to allow multiple matches.
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Departments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Users').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
  });

  it('shows the limited tab set for a department user, hiding admin-only tabs', () => {
    // Absence of Departments/Users/Reports is structural here, not just visual: the
    // department-user navigator (`DepartmentUserTabs`) simply never declares those
    // `Tab.Screen` entries, so there's no route to find regardless of what's asserted below.
    renderAsRole(ROLES.DEPARTMENT_USER);

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vendors').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quotations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bills').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
  });

  it('renders the Dashboard screen by default', () => {
    renderAsRole(ROLES.SUPER_ADMIN);

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    // Welcome text is split across two elements: "Welcome back," and "<name> 👋"
    expect(screen.getByText('Test User 👋')).toBeTruthy();
  });
});
