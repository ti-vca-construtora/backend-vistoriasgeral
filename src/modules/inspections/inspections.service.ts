import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
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

  async findAll(qry: FindQuery, user: AuthUser) {
    if (qry.from && qry.to && qry.to < qry.from) {
      throw new BadRequestException(
        'A data final (to) deve ser maior ou igual a data inicial (from)',
      );
    }

    let q = this.admin.from('tb_inspections').select(
      `
        *,
        tb_clients!inner (
          identerprise,
          name,
          unit
        )
      `,
    );

    if (qry.id) q = q.eq('id', qry.id);
    if (qry.idclient) {
      await this.assertClientAccess(qry.idclient, user);
      q = q.eq('idclient', qry.idclient);
    } else if (!isAdmin(user)) {
      if (user.enterpriseIds.length === 0) return [];
      q = q.in('tb_clients.identerprise', user.enterpriseIds);
    }
    if (qry.inspector) q = q.ilike('inspector', `%${qry.inspector}%`);
    if (typeof qry.mobuss === 'boolean') q = q.eq('mobuss', qry.mobuss);
    if (qry.status) q = q.eq('status', qry.status);
    if (qry.idprerejection) q = q.eq('idprerejection', qry.idprerejection);

    if (qry.from || qry.to) {
      const BRAZIL_OFFSET = 3 * 60 * 60 * 1000;

      if (qry.from) {
        const [ano, mes, dia] = qry.from.split('-').map(Number);
        const dataInicio = new Date(ano, mes - 1, dia);
        const dataInicioUtc = new Date(dataInicio.getTime() - BRAZIL_OFFSET);
        q = q.gte('datetime', dataInicioUtc.toISOString());
      }

      if (qry.to) {
        const [ano, mes, dia] = qry.to.split('-').map(Number);
        const dataFim = new Date(ano, mes - 1, dia + 1);
        const dataFimUtc = new Date(dataFim.getTime() - BRAZIL_OFFSET);
        q = q.lt('datetime', dataFimUtc.toISOString());
      }
    }

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map(({ tb_clients, ...inspection }) => ({
      ...inspection,
      client_name: (tb_clients as any)?.name ?? null,
      client_unit: (tb_clients as any)?.unit ?? null,
    }));
  }

  async create(dto: CreateInspectionDto, user: AuthUser) {
    const client = await this.findClient(dto.idclient);
    this.assertEnterpriseAccess(client.identerprise, user);

    await this.assertNotBlocked(client.identerprise, dto.datetime);

    const { data: overview } = await this.admin
      .from('tb_general')
      .select('status')
      .eq('idclient', dto.idclient)
      .maybeSingle();

    if (!overview || overview.status !== 'LIBERADA') {
      throw new BadRequestException('Unidade nao esta liberada para vistoria');
    }

    const { data: active } = await this.admin
      .from('tb_inspections')
      .select('id')
      .eq('idclient', dto.idclient)
      .in('status', ['AGUARDANDO', 'ACEITE'])
      .limit(1);

    if (active && active.length > 0) {
      throw new BadRequestException(
        'Ja existe uma vistoria ativa para este cliente',
      );
    }

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

  async update(id: number, dto: UpdateInspectionDto, user: AuthUser) {
    const { data: current } = await this.admin
      .from('tb_inspections')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!current) throw new NotFoundException('Vistoria nao encontrada');

    const currentClient = await this.findClient(current.idclient);
    this.assertEnterpriseAccess(currentClient.identerprise, user);

    const rejectionStatuses = ['RECUSA', 'RECUSA_EM_ABERTO'];
    const nextStatus = dto.status ?? current.status;
    const nextCountsAsRejection =
      dto.counts_as_rejection ?? current.counts_as_rejection ?? false;

    if (nextStatus !== 'CANCELADA' && dto.counts_as_rejection) {
      throw new BadRequestException(
        'A opcao Recusa? so pode ser usada em uma vistoria cancelada',
      );
    }

    if (
      dto.status &&
      !rejectionStatuses.includes(dto.status) &&
      rejectionStatuses.includes(current.status)
    ) {
      throw new BadRequestException(
        'Nao e possivel mudar o status de uma vistoria marcada como RECUSA. Exclua a recusa primeiro.',
      );
    }

    if (
      current.status === 'CANCELADA' &&
      current.counts_as_rejection &&
      (nextStatus !== 'CANCELADA' || !nextCountsAsRejection)
    ) {
      await this.admin
        .from('tb_rejections')
        .delete()
        .eq('idinspection', id)
        .eq('source', 'CANCELLATION');
    }

    if (dto.status === 'ACEITE') {
      const { data: rej } = await this.admin
        .from('tb_rejections')
        .select('id')
        .eq('idinspection', id)
        .limit(1);

      if (rej && rej.length > 0) {
        throw new BadRequestException(
          'Nao e possivel aceitar vistoria com recusa existente',
        );
      }
    }

    if (dto.status && rejectionStatuses.includes(dto.status)) {
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
          source: 'INSPECTION',
        });
      }
    }

    if (nextStatus === 'CANCELADA' && nextCountsAsRejection) {
      const { data: cancellationRejection } = await this.admin
        .from('tb_rejections')
        .select('id')
        .eq('idinspection', id)
        .eq('source', 'CANCELLATION')
        .limit(1);

      if (!cancellationRejection || cancellationRejection.length === 0) {
        await this.admin.from('tb_rejections').insert({
          idinspection: id,
          status: 'AGUARDANDO',
          construction_status: 'PENDENTE',
          source: 'CANCELLATION',
          obs: 'Cancelamento considerado como recusa',
        });
      }
    }

    const payload: Record<string, unknown> = {
      ...dto,
      counts_as_rejection:
        nextStatus === 'CANCELADA' ? nextCountsAsRejection : false,
    };

    if (dto.datetime) {
      await this.assertNotBlocked(currentClient.identerprise, dto.datetime);
    }

    const { data, error } = await this.admin
      .from('tb_inspections')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: number, user: AuthUser) {
    const { data: current } = await this.admin
      .from('tb_inspections')
      .select('idclient')
      .eq('id', id)
      .maybeSingle();

    if (!current) throw new NotFoundException('Vistoria nao encontrada');

    const client = await this.findClient(current.idclient);
    this.assertEnterpriseAccess(client.identerprise, user);

    const { data: hasRej } = await this.admin
      .from('tb_rejections')
      .select('id')
      .eq('idinspection', id)
      .limit(1);

    if (hasRej && hasRej.length > 0) {
      throw new BadRequestException(
        'Nao e possivel deletar vistoria com recusa vinculada',
      );
    }

    const { error } = await this.admin
      .from('tb_inspections')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  private async findClient(idclient: number) {
    const { data, error } = await this.admin
      .from('tb_clients')
      .select('id, identerprise')
      .eq('id', idclient)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Cliente informado nao existe');
    return data;
  }

  private async assertClientAccess(idclient: number, user: AuthUser) {
    const client = await this.findClient(idclient);
    this.assertEnterpriseAccess(client.identerprise, user);
  }

  private assertEnterpriseAccess(identerprise: number, user: AuthUser) {
    if (isAdmin(user)) return;

    if (!user.enterpriseIds.includes(Number(identerprise))) {
      throw new ForbiddenException('Usuario sem acesso ao empreendimento');
    }
  }

  private async assertNotBlocked(identerprise: number, datetime: string) {
    const date = this.extractBrazilDate(datetime);
    const time = this.extractBrazilTime(datetime);

    const { data: blocks, error } = await this.admin
      .from('tb_inspection_blocks')
      .select('id, start_time, end_time')
      .eq('identerprise', identerprise)
      .eq('date', date);

    if (error) throw new BadRequestException(error.message);
    const isBlocked = (blocks ?? []).some((block) =>
      this.timeWithinInterval(
        time,
        this.normalizeDbTime(block.start_time),
        this.normalizeDbTime(block.end_time),
      ),
    );

    if (isBlocked) {
      throw new BadRequestException(
        'Horario bloqueado para este empreendimento',
      );
    }
  }

  private extractBrazilDate(datetime: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(datetime));
  }

  private extractBrazilTime(datetime: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(datetime));
  }

  private normalizeDbTime(time: string) {
    return time.slice(0, 5);
  }

  private timeToMinutes(time: string) {
    const [hour, minute] = this.normalizeDbTime(time).split(':').map(Number);
    return hour * 60 + minute;
  }

  private timeWithinInterval(time: string, start: string, end: string) {
    const minutes = this.timeToMinutes(time);
    return (
      minutes >= this.timeToMinutes(start) && minutes < this.timeToMinutes(end)
    );
  }
}
