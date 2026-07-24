import 'reflect-metadata';
import { UserRole } from '../../infra/auth/auth-user';
import { ROLES_KEY } from '../../infra/auth/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController permissions', () => {
  it('allows an inspector to load their own profile', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype.me,
    ) as UserRole[];

    expect(roles).toContain(UserRole.INSPECTOR);
  });
});
