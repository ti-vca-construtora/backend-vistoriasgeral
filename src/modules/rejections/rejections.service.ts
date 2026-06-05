import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { UpdateRejectionDto } from './dto/update-rejection.dto';

type FindQuery = {
  id?: number;
  idinspection?: number;
  idclient?: number;
  status?: string;
  construction_status?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class RejectionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async findAll(qry: FindQuery, user: AuthUser) {
    if (qry.from && qry.to && qry.to < qry.from) {
      throw new BadRequestException('A data final (to) deve ser maior ou igual a data inicial (from)');
    }

    let q = this.admin.from('tb_rejections').select(`
        *,
        tb_inspections!inner (
          id,
          idclient,
          tb_clients!inner (
            identerprise,
            tb_enterprises (
              name
            )
          )
        )
      `);

    if (qry.id) q = q.eq('id', qry.id);
    if (qry.idinspection) q = q.eq('idinspection', qry.idinspection);
    if (qry.status) q = q.eq('status', qry.status);
    if (qry.construction_status) {
      q = q.eq('construction_status', qry.construction_status);
    }

    if (qry.idclient) {
      await this.assertClientAccess(qry.idclient, user);
      q = q.eq('tb_inspections.idclient', qry.idclient);
    } else if (!isAdmin(user)) {
      if (user.enterpriseIds.length === 0) return [];
      q = q.in('tb_inspections.tb_clients.identerprise', user.enterpriseIds);
    }

    if (qry.from || qry.to) {
      const BRAZIL_OFFSET = 3 * 60 * 60 * 1000;

      if (qry.from) {
        const [ano, mes, dia] = qry.from.split('-').map(Number);
        const dataInicio = new Date(ano, mes - 1, dia);
        const dataInicioUtc = new Date(dataInicio.getTime() - BRAZIL_OFFSET);
        q = q.gte('created_at', dataInicioUtc.toISOString());
      }

      if (qry.to) {
        const [ano, mes, dia] = qry.to.split('-').map(Number);
        const dataFim = new Date(ano, mes - 1, dia + 1);
        const dataFimUtc = new Date(dataFim.getTime() - BRAZIL_OFFSET);
        q = q.lt('created_at', dataFimUtc.toISOString());
      }
    }

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((rejection) => {
      const inspection = rejection.tb_inspections as any;
      const client = inspection?.tb_clients;
      const enterpriseName = client?.tb_enterprises?.name ?? null;

      return {
        ...rejection,
        idclient: inspection?.idclient ?? null,
        identerprise: client?.identerprise ?? null,
        nameenterprise: enterpriseName,
        tb_inspections: undefined,
      };
    });
  }

  async update(id: number, dto: UpdateRejectionDto, user: AuthUser) {
    const current = await this.findWithEnterprise(id);
    this.assertEnterpriseAccess(current.identerprise, user);

    const { data, error } = await this.admin
      .from('tb_rejections')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: number, user: AuthUser) {
    const rejection = await this.findWithEnterprise(id);
    this.assertEnterpriseAccess(rejection.identerprise, user);

    const { data: linked } = await this.admin
      .from('tb_inspections')
      .select('id')
      .eq('idprerejection', id)
      .limit(1);

    if (linked && linked.length > 0) {
      throw new BadRequestException(
        'Nao e possivel deletar recusa que ja possui nova vistoria vinculada',
      );
    }

    const { error } = await this.admin
      .from('tb_rejections')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    await this.admin
      .from('tb_inspections')
      .update({ status: 'AGUARDANDO' })
      .eq('id', rejection.idinspection);

    return { success: true };
  }

  private async findWithEnterprise(id: number) {
    const { data, error } = await this.admin
      .from('tb_rejections')
      .select(
        `
        id,
        idinspection,
        tb_inspections!inner (
          idclient,
          tb_clients!inner (
            identerprise
          )
        )
      `,
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Recusa nao encontrada');

    const inspection = (data as any).tb_inspections;
    const client = inspection?.tb_clients;

    return {
      id: data.id,
      idinspection: data.idinspection,
      idclient: inspection?.idclient,
      identerprise: client?.identerprise,
    };
  }

  private async assertClientAccess(idclient: number, user: AuthUser) {
    const { data, error } = await this.admin
      .from('tb_clients')
      .select('identerprise')
      .eq('id', idclient)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Cliente informado nao existe');
    this.assertEnterpriseAccess(data.identerprise, user);
  }

  private assertEnterpriseAccess(identerprise: number, user: AuthUser) {
    if (isAdmin(user)) return;

    if (!user.enterpriseIds.includes(Number(identerprise))) {
      throw new ForbiddenException('Usuario sem acesso ao empreendimento');
    }
  }
}
