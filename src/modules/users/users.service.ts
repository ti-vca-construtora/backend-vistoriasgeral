import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    const { email, password, name } = dto;

    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const user = data.user;

    const { error: insertError } = await this.admin
      .from('tb_users')
      .insert({
        id: user.id,
        email,
        name,
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
        `Falha ao inserir em tb_users (${insertError.message}). O usuário no auth foi revertido automaticamente.`,
      );
    }

    return this.findById(user.id);
  }

  async findAll() {
    const { data, error } = await this.admin
      .from('tb_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.admin
      .from('tb_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return data;
  }

  async findByEmail(email: string) {
    const { data, error } = await this.admin
      .from('tb_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return data;
  }

  async update(id: string, dto: UpdateUserDto) {
    const { email, password, name } = dto;

    if (email || password) {
      const { error } = await this.admin.auth.admin.updateUserById(id, {
        email,
        password,
      });

      if (error) {
        throw new BadRequestException(error.message);
      }
    }

    const { error: updateError } = await this.admin
      .from('tb_users')
      .update({ email, name })
      .eq('id', id);

    if (updateError) {
      throw new BadRequestException(updateError.message);
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
}
