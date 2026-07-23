export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  INSPECTOR = 'INSPECTOR',
  VIEWER = 'VIEWER',
}

export type AuthEnterprise = {
  id: number;
  name: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  enterpriseIds: number[];
  enterprises: AuthEnterprise[];
};

export const isAdmin = (user: AuthUser) => user.role === UserRole.ADMIN;
