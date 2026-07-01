import { ROLES, type Role } from '@/constants/roles';
import { User, type IUser } from '@/modules/user/user.model';

interface CreateTestUserOptions {
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export async function createTestUser(options: CreateTestUserOptions = {}): Promise<IUser> {
  return User.create({
    name: 'Test User',
    email: options.email ?? 'test.user@vms.local',
    password: options.password ?? 'Password123!',
    role: options.role ?? ROLES.SUPER_ADMIN,
    isActive: options.isActive ?? true,
  });
}
