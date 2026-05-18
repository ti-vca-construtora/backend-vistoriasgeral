import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './auth-user';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const makeContext = (role: UserRole) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          authUser: { role },
        }),
      }),
    }) as any;

  it('allows users with an accepted role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(UserRole.ADMIN))).toBe(true);
  });

  it('rejects users without an accepted role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(makeContext(UserRole.VIEWER))).toThrow(
      ForbiddenException,
    );
  });
});

