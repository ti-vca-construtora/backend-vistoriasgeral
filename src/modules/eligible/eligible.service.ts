import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';

type FindQuery = {
  type?: 'new' | 'again';
};

@Injectable()
export class EligibleService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  /**
   * Busca clientes elegíveis (aptos) para agendar vistoria
   * - Sem type: Retorna TODOS (new + again)
   * - type='new': Apenas clientes com status LIBERADA na tb_general e sem registro em tb_inspections
   * - type='again': Apenas clientes com recusa CONCLUÍDA mas sem nova vistoria agendada
   */
  async findAll(query: FindQuery) {
    const { type } = query;

    // Se não especificar type, retorna AMBOS
    if (!type) {
      const [newClients, againClients] = await Promise.all([
        this.findNewEligible(),
        this.findAgainEligible()
      ]);
      return [...newClients, ...againClients];
    }

    if (type === 'new') {
      return this.findNewEligible();
    } else if (type === 'again') {
      return this.findAgainEligible();
    }

    throw new BadRequestException('Tipo inválido. Use "new" ou "again"');
  }

  /**
   * Clientes aptos para PRIMEIRA vistoria:
   * - Status LIBERADA na tb_general
   * - SEM nenhum registro na tb_inspections
   */
  private async findNewEligible() {
    // 1) Buscar todos os clientes com status LIBERADA
    const { data: generalRecords, error: generalError } = await this.admin
      .from('tb_general')
      .select('idclient, status')
      .eq('status', 'LIBERADA');

    if (generalError) {
      throw new BadRequestException(generalError.message);
    }

    if (!generalRecords || generalRecords.length === 0) {
      return [];
    }

    const clientIds = generalRecords.map(g => g.idclient);

    // 2) Buscar quais desses clientes JÁ TEM vistoria
    const { data: inspections, error: inspError } = await this.admin
      .from('tb_inspections')
      .select('idclient')
      .in('idclient', clientIds);

    if (inspError) {
      throw new BadRequestException(inspError.message);
    }

    const clientsWithInspections = new Set(
      (inspections || []).map(i => i.idclient)
    );

    // 3) Filtrar apenas clientes SEM vistoria
    const eligibleClientIds = clientIds.filter(
      id => !clientsWithInspections.has(id)
    );

    if (eligibleClientIds.length === 0) {
      return [];
    }

    // 4) Buscar dados completos dos clientes elegíveis
    const { data: clients, error: clientsError } = await this.admin
      .from('tb_clients')
      .select(`
        id,
        name,
        unit,
        seller,
        identerprise,
        created_at,
        updated_at,
        nameenterprise:tb_enterprises!inner(name)
      `)
      .in('id', eligibleClientIds);

    if (clientsError) {
      throw new BadRequestException(clientsError.message);
    }

    // 5) Formatar resposta
    return (clients || []).map(client => {
      const enterpriseName = Array.isArray(client.nameenterprise)
        ? client.nameenterprise[0]?.name ?? null
        : (client.nameenterprise as any)?.name ?? null;

      return {
        id: client.id,
        name: client.name,
        unit: client.unit,
        seller: client.seller,
        identerprise: client.identerprise,
        nameenterprise: enterpriseName,
        status: 'LIBERADA',
        type: 'new' as const,
        idrejection: null,
        created_at: client.created_at,
        updated_at: client.updated_at,
      };
    });
  }

  /**
   * Clientes aptos para REAGENDAR vistoria:
   * - Recusa com status CONCLUÍDO
   * - SEM nova vistoria agendada após a recusa
   */
  private async findAgainEligible() {
    // 1) Buscar recusas com status CONCLUÍDO
    const { data: rejections, error: rejectionsError } = await this.admin
      .from('tb_rejections')
      .select(`
        id,
        idinspection,
        status,
        tb_inspections!inner (
          id,
          idclient,
          created_at
        )
      `)
      .eq('status', 'CONCLUÍDO');

    if (rejectionsError) {
      throw new BadRequestException(rejectionsError.message);
    }

    if (!rejections || rejections.length === 0) {
      return [];
    }

    // 2) Para cada recusa, verificar se existe vistoria POSTERIOR
    const eligibleData: Array<{ idclient: number; idrejection: number }> = [];

    for (const rejection of rejections) {
      const inspection = rejection.tb_inspections as any;
      if (!inspection) continue;

      const idclient = inspection.idclient;
      const rejectionDate = inspection.created_at;

      // Buscar se existe vistoria posterior à data da recusa
      const { data: laterInspections, error: laterError } = await this.admin
        .from('tb_inspections')
        .select('id')
        .eq('idclient', idclient)
        .gt('created_at', rejectionDate)
        .limit(1);

      if (laterError) {
        throw new BadRequestException(laterError.message);
      }

      // Se NÃO tem vistoria posterior, é elegível
      if (!laterInspections || laterInspections.length === 0) {
        eligibleData.push({
          idclient,
          idrejection: rejection.id,
        });
      }
    }

    if (eligibleData.length === 0) {
      return [];
    }

    const clientIds = eligibleData.map(e => e.idclient);

    // 3) Buscar dados completos dos clientes
    const { data: clients, error: clientsError } = await this.admin
      .from('tb_clients')
      .select(`
        id,
        name,
        unit,
        seller,
        identerprise,
        created_at,
        updated_at,
        nameenterprise:tb_enterprises!inner(name)
      `)
      .in('id', clientIds);

    if (clientsError) {
      throw new BadRequestException(clientsError.message);
    }

    // 4) Mapear com idrejection
    const clientMap = new Map(
      eligibleData.map(e => [e.idclient, e.idrejection])
    );

    // 5) Formatar resposta
    return (clients || []).map(client => {
      const enterpriseName = Array.isArray(client.nameenterprise)
        ? client.nameenterprise[0]?.name ?? null
        : (client.nameenterprise as any)?.name ?? null;

      return {
        id: client.id,
        name: client.name,
        unit: client.unit,
        seller: client.seller,
        identerprise: client.identerprise,
        nameenterprise: enterpriseName,
        status: 'CONCLUÍDO',
        type: 'again' as const,
        idrejection: clientMap.get(client.id) ?? null,
        created_at: client.created_at,
        updated_at: client.updated_at,
      };
    });
  }
}
