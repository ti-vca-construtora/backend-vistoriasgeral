import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser, UserRole } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async login(dto: LoginDto) {
    const { email, password } = dto;

    const { data, error } = await this.supabaseService
      .getAnon()
      .auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session) {
      throw new UnauthorizedException('Email ou senha invalidos');
    }

    const profile = await this.loadAuthUser(data.user.id);

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        ...data.user,
        profile,
      },
    };
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
