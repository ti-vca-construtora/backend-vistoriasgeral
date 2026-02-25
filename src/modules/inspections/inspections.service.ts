import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';

type FindQuery = {
  id?: number;
  idclient?: number;
  inspector?: string;
  mobuss?: boolean;
  status?: string;
  idprerejection?: number;
  from?: string;
  to?: string;
};

@Injectable()
export class InspectionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  // GET
  async findAll(qry: FindQuery) {
    // Validar que 'to' >= 'from'
    if (qry.from && qry.to) {
      if (qry.to < qry.from) {
        throw new BadRequestException('A data final (to) deve ser maior ou igual à data inicial (from)');
      }
    }

    let q = this.admin.from('tb_inspections').select('*');

    if (qry.id) q = q.eq('id', qry.id);
    if (qry.idclient) q = q.eq('idclient', qry.idclient);
    if (qry.inspector) q = q.ilike('inspector', `%${qry.inspector}%`);
    if (typeof qry.mobuss === 'boolean') q = q.eq('mobuss', qry.mobuss);
    if (qry.status) q = q.eq('status', qry.status);
    if (qry.idprerejection) q = q.eq('idprerejection', qry.idprerejection);

    // Filtro de data com timezone Brasil (UTC-3)
    if (qry.from || qry.to) {
      const BRAZIL_OFFSET = 3 * 60 * 60 * 1000; // 3 horas em ms

      if (qry.from) {
        const [ano, mes, dia] = qry.from.split('-').map(Number);
        const dataInicio = new Date(ano, mes - 1, dia);
        const dataInicioUtc = new Date(dataInicio.getTime() - BRAZIL_OFFSET);
        q = q.gte('datetime', dataInicioUtc.toISOString());
      }

      if (qry.to) {
        const [ano, mes, dia] = qry.to.split('-').map(Number);
        const dataFim = new Date(ano, mes - 1, dia + 1); // Próximo dia
        const dataFimUtc = new Date(dataFim.getTime() - BRAZIL_OFFSET);
        q = q.lt('datetime', dataFimUtc.toISOString());
      }
    }

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // POST
  async create(dto: CreateInspectionDto) {
    // 1) Overview precisa estar LIBERADA
    const { data: overview } = await this.admin
      .from('tb_general')
      .select('status')
      .eq('idclient', dto.idclient)
      .maybeSingle();

    if (!overview || overview.status !== 'LIBERADA') {
      throw new BadRequestException('Unidade não está liberada para vistoria');
    }

    // 2) Não permitir vistoria paralela
    const { data: active } = await this.admin
      .from('tb_inspections')
      .select('id')
      .eq('idclient', dto.idclient)
      .in('status', ['AGUARDANDO', 'ACEITE'])
      .limit(1);

    if (active && active.length > 0) {
      throw new BadRequestException('Já existe uma vistoria ativa para este cliente');
    }

    // 3) Se vier idprerejection, fechar recusa aguardando
    if (dto.idprerejection) {
      const { data: rejection } = await this.admin
        .from('tb_rejections')
        .select('id, status')
        .eq('id', dto.idprerejection)
        .maybeSingle();

      if (rejection && rejection.status === 'AGUARDANDO') {
        await this.admin
          .from('tb_rejections')
          .update({ status: 'CONCLUÍDO' })
          .eq('id', dto.idprerejection);
      }
    }

    // 4) Criar vistoria
    const { data, error } = await this.admin
      .from('tb_inspections')
      .insert({
        idclient: dto.idclient,
        datetime: dto.datetime,
        inspector: dto.inspector ?? null,
        mobuss: dto.mobuss ?? false,
        idprerejection: dto.idprerejection ?? null,
        obs: dto.obs ?? null,
        status: 'AGUARDANDO',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // PUT
  async update(id: number, dto: UpdateInspectionDto) {
    const { data: current } = await this.admin
      .from('tb_inspections')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!current) throw new NotFoundException('Vistoria não encontrada');

    // 1) Não permitir mudar status se estiver com RECUSA
    if (dto.status && current.status === 'RECUSA') {
      throw new BadRequestException('Não é possível mudar o status de uma vistoria marcada como RECUSA. Exclua a recusa primeiro.');
    }

    // 2) Não permitir ACEITE se existir recusa
    if (dto.status === 'ACEITE') {
      const { data: rej } = await this.admin
        .from('tb_rejections')
        .select('id')
        .eq('idinspection', id)
        .limit(1);

      if (rej && rej.length > 0) {
        throw new BadRequestException('Não é possível aceitar vistoria com recusa existente');
      }
    }

    // 3) Se status = RECUSA → cria recusa automaticamente
    if (dto.status === 'RECUSA') {
      const { data: exists } = await this.admin
        .from('tb_rejections')
        .select('id')
        .eq('idinspection', id)
        .limit(1);

      if (!exists || exists.length === 0) {
        await this.admin.from('tb_rejections').insert({
          idinspection: id,
          status: 'AGUARDANDO',
          construction_status: 'PENDENTE',
        });
      }
    }

    const { data, error } = await this.admin
      .from('tb_inspections')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // DELETE
  async remove(id: number) {
    const { data: hasRej } = await this.admin
      .from('tb_rejections')
      .select('id')
      .eq('idinspection', id)
      .limit(1);

    if (hasRej && hasRej.length > 0) {
      throw new BadRequestException('Não é possível deletar vistoria com recusa vinculada');
    }

    const { error } = await this.admin.from('tb_inspections').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }
}
