import { Injectable, UnauthorizedException } from '@nestjs/common';
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
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user,
    };
  }
}
