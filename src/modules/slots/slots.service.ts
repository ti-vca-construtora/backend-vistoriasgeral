import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateSlotBlockDto } from './dto/create-slot-block.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { QuerySlotDto } from './dto/query-slot.dto';
import { SlotStatus, UpdateSlotDto } from './dto/update-slot.dto';

@Injectable()
export class SlotsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async findAll(query: QuerySlotDto, user: AuthUser) {
    if (query.from && query.to && query.to < query.from) {
      throw new BadRequestException('A data final deve ser maior ou igual a inicial');
    }

    let q = this.admin
      .from('tb_inspection_slots')
      .select(
        `
        *,
        tb_enterprises (
          id,
          name
        ),
        tb_slot_blocks (
          id,
          time,
          reason,
          created_at,
          updated_at
        )
      `,
      )
      .order('date', { ascending: true });

    if (query.identerprise) {
      await this.assertEnterpriseAccess(query.identerprise, user);
      q = q.eq('identerprise', query.identerprise);
    } else if (!isAdmin(user)) {
      if (user.enterpriseIds.length === 0) return [];
      q = q.in('identerprise', user.enterpriseIds);
    }

    if (query.from) q = q.gte('date', query.from);
    if (query.to) q = q.lte('date', query.to);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(dto: CreateSlotDto) {
    this.assertNotPastDate(dto.date);

    const { data: enterprise } = await this.admin
      .from('tb_enterprises')
      .select('id')
      .eq('id', dto.identerprise)
      .maybeSingle();

    if (!enterprise) {
      throw new BadRequestException('Empreendimento informado nao existe');
    }

    const { data: existing } = await this.admin
      .from('tb_inspection_slots')
      .select('id')
      .eq('identerprise', dto.identerprise)
      .eq('date', dto.date)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('Ja existe slot para este empreendimento nesta data');
    }

    const { data, error } = await this.admin
      .from('tb_inspection_slots')
      .insert({
        identerprise: dto.identerprise,
        date: dto.date,
        status: SlotStatus.ACTIVE,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: number, dto: UpdateSlotDto) {
    await this.findById(id);

    const { data, error } = await this.admin
      .from('tb_inspection_slots')
      .update({ status: dto.status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createBlocks(id: number, dto: CreateSlotBlockDto) {
    await this.findById(id);

    const times = [...new Set(dto.times)];
    times.forEach((time) => this.assertValidTime(time));

    const { data: existingBlocks, error: blocksError } = await this.admin
      .from('tb_slot_blocks')
      .select('time')
      .eq('idslot', id)
      .in('time', times);

    if (blocksError) throw new BadRequestException(blocksError.message);

    if ((existingBlocks?.length ?? 0) > 0) {
      throw new BadRequestException('Um ou mais horarios ja estao bloqueados');
    }

    const { data: inspections, error: inspectionsError } = await this.admin
      .from('tb_inspections')
      .select('id, datetime')
      .eq('idslot', id);

    if (inspectionsError) throw new BadRequestException(inspectionsError.message);

    const occupied = (inspections ?? []).some((inspection) =>
      times.includes(this.extractBrazilTime(inspection.datetime)),
    );

    if (occupied) {
      throw new BadRequestException('Nao e possivel bloquear horario ja agendado');
    }

    const { data, error } = await this.admin
      .from('tb_slot_blocks')
      .insert(
        times.map((time) => ({
          idslot: id,
          time,
          reason: dto.reason ?? null,
        })),
      )
      .select();

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async removeBlock(slotId: number, blockId: number) {
    await this.findById(slotId);

    const { data: block } = await this.admin
      .from('tb_slot_blocks')
      .select('id')
      .eq('id', blockId)
      .eq('idslot', slotId)
      .maybeSingle();

    if (!block) {
      throw new NotFoundException('Bloqueio nao encontrado neste slot');
    }

    const { error } = await this.admin
      .from('tb_slot_blocks')
      .delete()
      .eq('id', blockId)
      .eq('idslot', slotId);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  private async findById(id: number) {
    const { data, error } = await this.admin
      .from('tb_inspection_slots')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Slot nao encontrado');
    return data;
  }

  private async assertEnterpriseAccess(identerprise: number, user: AuthUser) {
    if (isAdmin(user)) return;

    if (!user.enterpriseIds.includes(Number(identerprise))) {
      throw new ForbiddenException('Usuario sem acesso ao empreendimento');
    }
  }

  private assertNotPastDate(date: string) {
    if (date < this.todayInBrazil()) {
      throw new BadRequestException('Nao e permitido criar slot em data passada');
    }
  }

  private assertValidTime(time: string) {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new BadRequestException('Horario deve estar no formato HH:mm');
    }

    const [hour, minute] = time.split(':').map(Number);
    if (hour > 23 || minute > 59) {
      throw new BadRequestException('Horario invalido');
    }
  }

  private todayInBrazil() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private extractBrazilTime(datetime: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(datetime));
  }
}

