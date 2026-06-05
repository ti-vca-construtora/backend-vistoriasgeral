import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async create(dto: CreateUserDto) {
    const { email, password, name, role, enterpriseIds } = dto;

    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const user = data.user;

    const { error: insertError } = await this.admin.from('tb_users').insert({
      id: user.id,
      email,
      name,
      role: role ?? UserRole.USER,
    });

    if (insertError) {
      const { error: rollbackError } = await this.admin.auth.admin.deleteUser(
        user.id,
      );

      if (rollbackError) {
        throw new BadRequestException(
          `Falha ao inserir em tb_users (${insertError.message}) e falha no rollback do auth (${rollbackError.message})`,
        );
      }

      throw new BadRequestException(
        `Falha ao inserir em tb_users (${insertError.message}). O usuario no auth foi revertido automaticamente.`,
      );
    }

    await this.replaceEnterpriseLinks(user.id, enterpriseIds ?? []);

    return this.findById(user.id);
  }

  async findAll() {
    const { data, error } = await this.admin
      .from('tb_users')
      .select(
        `
        *,
        tb_user_enterprises (
          identerprise,
          tb_enterprises (
            id,
            name
          )
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data ?? []).map((user) => this.mapUser(user));
  }

  async findById(id: string) {
    const { data, error } = await this.admin
      .from('tb_users')
      .select(
        `
        *,
        tb_user_enterprises (
          identerprise,
          tb_enterprises (
            id,
            name
          )
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return this.mapUser(data);
  }

  async findByEmail(email: string) {
    const { data, error } = await this.admin
      .from('tb_users')
      .select(
        `
        *,
        tb_user_enterprises (
          identerprise,
          tb_enterprises (
            id,
            name
          )
        )
      `,
      )
      .eq('email', email)
      .single();

    if (error || !data) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return this.mapUser(data);
  }

  async update(id: string, dto: UpdateUserDto) {
    const { email, password, name, role, enterpriseIds } = dto;

    if (email || password) {
      const { error } = await this.admin.auth.admin.updateUserById(id, {
        email,
        password,
      });

      if (error) {
        throw new BadRequestException(error.message);
      }
    }

    const payload: Record<string, unknown> = {};
    if (email !== undefined) payload.email = email;
    if (name !== undefined) payload.name = name;
    if (role !== undefined) payload.role = role;

    if (Object.keys(payload).length > 0) {
      const { error: updateError } = await this.admin
        .from('tb_users')
        .update(payload)
        .eq('id', id);

      if (updateError) {
        throw new BadRequestException(updateError.message);
      }
    }

    if (enterpriseIds !== undefined) {
      await this.replaceEnterpriseLinks(id, enterpriseIds);
    }

    return this.findById(id);
  }

  async remove(id: string) {
    const { error } = await this.admin.auth.admin.deleteUser(id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { success: true };
  }

  private async replaceEnterpriseLinks(iduser: string, enterpriseIds: number[]) {
    const uniqueEnterpriseIds = [...new Set(enterpriseIds)];

    const { error: deleteError } = await this.admin
      .from('tb_user_enterprises')
      .delete()
      .eq('iduser', iduser);

    if (deleteError) {
      throw new BadRequestException(deleteError.message);
    }

    if (uniqueEnterpriseIds.length === 0) {
      return;
    }

    const { error: insertError } = await this.admin
      .from('tb_user_enterprises')
      .insert(
        uniqueEnterpriseIds.map((identerprise) => ({
          iduser,
          identerprise,
        })),
      );

    if (insertError) {
      throw new BadRequestException(insertError.message);
    }
  }

  private mapUser(user: any) {
    const links = user.tb_user_enterprises ?? [];

    return {
      ...user,
      role: user.role ?? UserRole.USER,
      enterprises: links.map((link: any) => {
        const enterprise = Array.isArray(link.tb_enterprises)
          ? link.tb_enterprises[0]
          : link.tb_enterprises;

        return {
          id: Number(link.identerprise),
          name: enterprise?.name ?? null,
        };
      }),
      tb_user_enterprises: undefined,
    };
  }
}
