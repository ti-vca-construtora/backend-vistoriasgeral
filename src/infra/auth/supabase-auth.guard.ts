import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthUser, UserRole } from './auth-user';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header não informado');
    }

    const token = authHeader.replace('Bearer ', '');

    const { data, error } =
      await this.supabaseService.getAnon().auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Token inválido');
    }

    const authUser = await this.loadAuthUser(data.user.id);

    request.user = data.user;
    request.authUser = authUser;
    return true;
  }

  private async loadAuthUser(id: string): Promise<AuthUser> {
    const admin = this.supabaseService.getAdmin();

    const { data: profile, error } = await admin
      .from('tb_users')
      .select('id, email, name, role')
      .eq('id', id)
      .maybeSingle();

    if (error || !profile) {
      throw new UnauthorizedException('Perfil de usuario nao encontrado');
    }

    const { data: links, error: linksError } = await admin
      .from('tb_user_enterprises')
      .select(
        `
        identerprise,
        tb_enterprises (
          id,
          name
        )
      `,
      )
      .eq('iduser', id);

    if (linksError) {
      throw new UnauthorizedException(linksError.message);
    }

    const enterprises = (links ?? []).map((link: any) => {
      const enterprise = Array.isArray(link.tb_enterprises)
        ? link.tb_enterprises[0]
        : link.tb_enterprises;

      return {
        id: Number(link.identerprise),
        name: enterprise?.name ?? null,
      };
    });

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? null,
      role: (profile.role ?? UserRole.USER) as UserRole,
      enterpriseIds: enterprises.map((enterprise) => enterprise.id),
      enterprises,
    };
  }
}
