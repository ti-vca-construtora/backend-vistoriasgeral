import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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

  // GET
  async findAll(qry: FindQuery) {
    // Validar que 'to' >= 'from'
    if (qry.from && qry.to) {
      if (qry.to < qry.from) {
        throw new BadRequestException('A data final (to) deve ser maior ou igual à data inicial (from)');
      }
    }

    let q = this.admin
      .from('tb_rejections')
      .select(`
        *,
        tb_inspections (
          id,
          idclient,
          tb_clients (
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
    if (qry.construction_status)
      q = q.eq('construction_status', qry.construction_status);

    if (qry.idclient) {
      q = q.eq('tb_inspections.idclient', qry.idclient);
    }

    // Filtro de data com timezone Brasil (UTC-3)
    if (qry.from || qry.to) {
      const BRAZIL_OFFSET = 3 * 60 * 60 * 1000; // 3 horas em ms

      if (qry.from) {
        const [ano, mes, dia] = qry.from.split('-').map(Number);
        const dataInicio = new Date(ano, mes - 1, dia);
        const dataInicioUtc = new Date(dataInicio.getTime() - BRAZIL_OFFSET);
        q = q.gte('created_at', dataInicioUtc.toISOString());
      }

      if (qry.to) {
        const [ano, mes, dia] = qry.to.split('-').map(Number);
        const dataFim = new Date(ano, mes - 1, dia + 1); // Próximo dia
        const dataFimUtc = new Date(dataFim.getTime() - BRAZIL_OFFSET);
        q = q.lt('created_at', dataFimUtc.toISOString());
      }
    }

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);

    // Flatten opcional (idclient + enterprise)
    return (data ?? []).map(r => {
      const inspection = r.tb_inspections as any;
      const client = inspection?.tb_clients;
      const enterpriseName = client?.tb_enterprises?.name ?? null;

      return {
        ...r,
        idclient: inspection?.idclient ?? null,
        identerprise: client?.identerprise ?? null,
        nameenterprise: enterpriseName,
        tb_inspections: undefined,
      };
    });
  }



  // PUT
  async update(id: number, dto: UpdateRejectionDto) {
    const { data: current } = await this.admin
      .from('tb_rejections')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!current) throw new NotFoundException('Recusa não encontrada');

    const { data, error } = await this.admin
      .from('tb_rejections')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // DELETE
  async remove(id: number) {
    // 1️⃣ Verifica existência
    const { data: rejection } = await this.admin
      .from('tb_rejections')
      .select('id, idinspection')
      .eq('id', id)
      .maybeSingle();

    if (!rejection) {
      throw new NotFoundException('Recusa não encontrada');
    }

    // 2️⃣ Não permitir deletar se já houver nova vistoria vinculada
    const { data: linked } = await this.admin
      .from('tb_inspections')
      .select('id')
      .eq('idprerejection', id)
      .limit(1);

    if (linked && linked.length > 0) {
      throw new BadRequestException(
        'Não é possível deletar recusa que já possui nova vistoria vinculada',
      );
    }

    // 3️⃣ Deleta a recusa
    const { error } = await this.admin
      .from('tb_rejections')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    // 4️⃣ Atualiza status da vistoria para AGUARDANDO
    await this.admin
      .from('tb_inspections')
      .update({ status: 'AGUARDANDO' })
      .eq('id', rejection.idinspection);

    return { success: true };
  }
}
