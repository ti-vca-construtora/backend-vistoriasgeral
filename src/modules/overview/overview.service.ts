import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateOverviewDto } from './dto/create-overview.dto';
import { UpdateOverviewDto } from './dto/update-overview.dto';
import { StatusGeneral } from './overview.enums';

type FindOverviewQuery = {
  id?: number;
  idclient?: number;
  status?: string;
  situation?: string;
};

@Injectable()
export class OverviewService {

  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async findAll(query: FindOverviewQuery) {
    // 1) Busca overviews (LEFT: pode não existir)
    let q = this.admin
      .from('tb_general')
      .select(`
        id,
        idclient,
        data_register,
        data_contact,
        status,
        status_quality,
        status_construction,
        status_delivery,
        obs,
        situation,
        created_at,
        updated_at
      `);

    if (query.id) q = q.eq('id', query.id);
    if (query.idclient) q = q.eq('idclient', query.idclient);
    if (query.status) q = q.eq('status', query.status);
    if (query.situation) q = q.eq('situation', query.situation);

    const { data: generals, error } = await q;
    if (error) throw new BadRequestException(error.message);

    // Coleção de idclients para buscar vistorias
    const idclients = (generals ?? []).map(g => g.idclient);

    // 2) Busca vistorias + recusas
    const { data: inspections, error: inspErr } = await this.admin
      .from('tb_inspections')
      .select(`
        id,
        datetime,
        inspector,
        mobuss,
        status,
        created_at,
        updated_at,
        idclient,
        tb_rejections (
          id,
          status,
          prevision_date,
          created_at,
          updated_at
        )
      `)
      .in('idclient', idclients.length ? idclients : [0]);

    if (inspErr) throw new BadRequestException(inspErr.message);

    // 3) Agrupa vistorias por idclient
    const inspByClient = new Map<number, any[]>();
    (inspections ?? []).forEach(i => {
      const list = inspByClient.get(i.idclient) ?? [];
      list.push({
        id: i.id,
        datetime: i.datetime,
        inspector: i.inspector,
        mobuss: i.mobuss,
        status: i.status,
        created_at: i.created_at,
        updated_at: i.updated_at,
        rejections: i.tb_rejections ?? [],
      });
      inspByClient.set(i.idclient, list);
    });

    // 4) Monta resposta (inclui fallback virtual)
    const rows = (generals ?? []).map(g => {
      const inspectionsList = inspByClient.get(g.idclient) ?? [];

      // status_recente (prioridade)
      let status_recente = 'PENDENTE';
      const hasRecusa = inspectionsList.some(i => i.status === 'RECUSA');
      const hasAguard = inspectionsList.some(i => i.status === 'AGUARDANDO');
      const hasAceite = inspectionsList.some(i => i.status === 'ACEITE');

      if (hasRecusa) status_recente = 'RECUSA';
      else if (hasAguard) status_recente = 'AGUARDANDO';
      else if (hasAceite) status_recente = 'ACEITE';

      return {
        id: g.id,
        idclient: g.idclient,
        status: g.status ?? 'PENDENTE',
        status_quality: g.status_quality ?? 'PENDENTE',
        status_construction: g.status_construction ?? 'PENDENTE',
        status_delivery: g.status_delivery ?? 'PENDENTE',
        data_register: g.data_register ?? null,
        data_contact: g.data_contact ?? null,
        obs: g.obs ?? null,
        situation: g.situation,
        status_recente,
        inspections: inspectionsList,
      };
    });

    return rows;
  }

  async create(dto: CreateOverviewDto) {
    // 1) Verifica se já existe overview para o idclient
    const { data: exists, error: findError } = await this.admin
      .from('tb_general')
      .select('id')
      .eq('idclient', dto.idclient)
      .maybeSingle();

    if (findError) {
      throw new BadRequestException(findError.message);
    }

    if (exists) {
      throw new BadRequestException(
        'Já existe um overview cadastrado para este cliente',
      );
    }

    // 2) Monta payload com defaults
    const payload = {
      idclient: dto.idclient,
      status: dto.status ?? 'PENDENTE',
      status_quality: dto.status_quality ?? 'PENDENTE',
      status_construction: dto.status_construction ?? 'PENDENTE',
      status_delivery: dto.status_delivery ?? 'PENDENTE',
      obs: dto.obs ?? null,
      situation: dto.situation ?? 'ATIVO',
    };

    // 3) Insere
    const { data, error } = await this.admin
      .from('tb_general')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async update(id: number, dto: UpdateOverviewDto) {
    // 1️⃣ Verifica se overview existe
    const { data: current, error: findError } = await this.admin
      .from('tb_general')
      .select('id, idclient, status')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      throw new BadRequestException(findError.message);
    }

    if (!current) {
      throw new NotFoundException('Overview não encontrado');
    }

    // 2️⃣ Não permitir voltar de LIBERADA para PENDENTE quando já houver vistoria/recusa
    if (
      dto.status === StatusGeneral.PENDENTE
      && current.status === StatusGeneral.LIBERADA
    ) {
      const [{ data: inspections, error: inspectionError }, { data: rejections, error: rejectionError }] = await Promise.all([
        this.admin
          .from('tb_inspections')
          .select('id')
          .eq('idclient', current.idclient)
          .limit(1),
        this.admin
          .from('tb_rejections')
          .select('id, tb_inspections!inner(idclient)')
          .eq('tb_inspections.idclient', current.idclient)
          .limit(1),
      ]);

      if (inspectionError) {
        throw new BadRequestException(inspectionError.message);
      }

      if (rejectionError) {
        throw new BadRequestException(rejectionError.message);
      }

      if ((inspections?.length ?? 0) > 0 || (rejections?.length ?? 0) > 0) {
        throw new BadRequestException(
          'Não é possível alterar o status para PENDENTE após a liberação quando já existe vistoria e/ou recusa vinculada. Exclua a vistoria e/ou recusa para continuar.',
        );
      }
    }

    // 3️⃣ Atualiza apenas o que veio no DTO
    const { data, error } = await this.admin
      .from('tb_general')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async remove(id: number) {
  // 1️⃣ Verifica se overview existe
    const { data: overview, error: findError } = await this.admin
      .from('tb_general')
      .select('id, idclient')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      throw new BadRequestException(findError.message);
    }

    if (!overview) {
      throw new NotFoundException('Overview não encontrado');
    }

    // 2️⃣ Verifica se existem vistorias
    const { data: inspections, error: inspError } = await this.admin
      .from('tb_inspections')
      .select('id')
      .eq('idclient', overview.idclient)
      .limit(1);

    if (inspError) {
      throw new BadRequestException(inspError.message);
    }

    if (inspections && inspections.length > 0) {
      throw new BadRequestException(
        'Não é possível deletar o overview pois existem vistorias vinculadas',
      );
    }

    // 3️⃣ Deleta overview
    const { error: deleteError } = await this.admin
      .from('tb_general')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new BadRequestException(deleteError.message);
    }

    return { success: true };
  }
}
