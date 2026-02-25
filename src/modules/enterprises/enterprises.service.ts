import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';

@Injectable()
export class EnterprisesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  private readonly table = 'tb_enterprises';

  async findAll() {
    const { data, error } = await this.admin
      .from(this.table)
      .select('*')
      .order('name');

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async findById(id: number) {
    const { data, error } = await this.admin
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Enterprise not found');
    }

    return data;
  }

  async create(dto: CreateEnterpriseDto) {
    const { name } = dto;

    // 🔒 não permitir nome duplicado
    const { data: existing } = await this.admin
      .from(this.table)
      .select('id')
      .ilike('name', name)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Enterprise name already exists');
    }

    const { data, error } = await this.admin
      .from(this.table)
      .insert({ name })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async update(id: number, dto: UpdateEnterpriseDto) {
    const { name } = dto;

    const { data: existing } = await this.admin
      .from(this.table)
      .select('id')
      .ilike('name', name)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Enterprise name already exists');
    }

    const { error } = await this.admin
      .from(this.table)
      .update({ name })
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return this.findById(id);
  }

  async remove(id: number) {
    // 1️⃣ Verifica existência
    const { data: exists, error: findError } = await this.admin
      .from(this.table)
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      throw new BadRequestException(findError.message);
    }

    if (!exists) {
      throw new NotFoundException('Empresa não encontrada');
    }

    // 2️⃣ Tenta deletar
    const { error: deleteError } = await this.admin
      .from(this.table)
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new BadRequestException(
        'Empresa não pode ser excluída pois possui registros vinculados',
      );
    }

    return { success: true };
  }
  
}
