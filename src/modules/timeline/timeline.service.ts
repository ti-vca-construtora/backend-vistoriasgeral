import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { TimelineResponseDto } from './dto/timeline-response.dto';
import { TimelineEventDto, TimelineEventType } from './dto/timeline-event.dto';

@Injectable()
export class TimelineService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getClientTimeline(clientId: number): Promise<TimelineResponseDto> {
    const supabase = this.supabaseService.getAdmin();

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('tb_clients')
      .select('id, name, unit, created_at')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new NotFoundException(`Cliente com ID ${clientId} não encontrado`);
    }

    const events: TimelineEventDto[] = [];

    // 1. Data de criação do cliente
    events.push({
      type: TimelineEventType.CLIENT_CREATED,
      date: client.created_at,
      description: 'Cliente cadastrado no sistema',
      metadata: {
        clientId: client.id,
        name: client.name,
        unit: client.unit,
      },
    });

    // 2. Data de liberação da unidade (status liberada no overview)
    const { data: overview } = await supabase
      .from('tb_general')
      .select('status, data_register, updated_at')
      .eq('idclient', clientId)
      .single();

    if (overview) {
      // Se tem data_register, usar ela como data de liberação
      if (overview.data_register) {
        events.push({
          type: TimelineEventType.UNIT_RELEASED,
          date: overview.data_register,
          description: 'Unidade liberada para vistoria',
          metadata: {
            status: overview.status,
          },
        });
      }
    }

    // 3. Buscar vistorias e suas recusas
    const { data: inspections } = await supabase
      .from('tb_inspections')
      .select(
        `
        id,
        datetime,
        inspector,
        status,
        created_at,
        updated_at,
        obs,
        tb_rejections (
          id,
          prevision_date,
          status,
          construction_status,
          created_at,
          updated_at,
          obs
        )
      `,
      )
      .eq('idclient', clientId)
      .order('datetime', { ascending: true });

    if (inspections && inspections.length > 0) {
      const inspectionIds = inspections.map((inspection) => inspection.id);
      const { data: auditEvents } = await supabase
        .from('tb_inspection_events')
        .select('*')
        .in('idinspection', inspectionIds)
        .order('created_at', { ascending: true });
      const auditedStatuses = new Set(
        (auditEvents ?? [])
          .filter((event: any) => event.event_type === 'STATUS_CHANGED')
          .map((event: any) => `${event.idinspection}:${event.new_status}`),
      );

      for (const inspection of inspections) {
        // Evento de agendamento da vistoria
        events.push({
          type: TimelineEventType.INSPECTION_SCHEDULED,
          date: inspection.created_at,
          description: `Vistoria agendada${inspection.inspector ? ` com ${inspection.inspector}` : ''}`,
          metadata: {
            inspectionId: inspection.id,
            datetime: inspection.datetime,
            inspector: inspection.inspector,
            status: inspection.status,
          },
        });

        const rejections = (inspection as any).tb_rejections ?? [];

        // Se vistoria foi recusada → evento único INSPECTION_REJECTED
        if (
          ['RECUSA', 'RECUSA_EM_ABERTO'].includes(inspection.status) &&
          rejections.length > 0 &&
          !auditedStatuses.has(`${inspection.id}:${inspection.status}`)
        ) {
          const rejection = rejections[0]; // recusa principal
          events.push({
            type: TimelineEventType.INSPECTION_REJECTED,
            date: inspection.updated_at ?? rejection.created_at,
            description: `Vistoria recusada${rejection.prevision_date ? ` — previsão de correção: ${rejection.prevision_date}` : ''}`,
            metadata: {
              inspectionId: inspection.id,
              inspector: inspection.inspector,
              inspectionObs: inspection.obs,
              rejectionId: rejection.id,
              previsionDate: rejection.prevision_date,
              constructionStatus: rejection.construction_status,
              rejectionStatus: rejection.status,
              rejectionObs: rejection.obs,
            },
          });

          // Se a recusa já foi concluída → REJECTION_RESOLVED
          if (
            rejection.status === 'CONCLUÍDO' &&
            rejection.updated_at &&
            rejection.updated_at !== rejection.created_at
          ) {
            events.push({
              type: TimelineEventType.REJECTION_RESOLVED,
              date: rejection.updated_at,
              description: 'Recusa resolvida',
              metadata: {
                rejectionId: rejection.id,
                inspectionId: inspection.id,
                obs: rejection.obs,
              },
            });
          }
        }
        // Se vistoria foi aprovada → INSPECTION_APPROVED
        else if (
          inspection.status === 'ACEITE' ||
          inspection.status === 'APROVADA'
        ) {
          if (!auditedStatuses.has(`${inspection.id}:${inspection.status}`)) {
            events.push({
              type: TimelineEventType.INSPECTION_APPROVED,
              date: inspection.updated_at ?? inspection.datetime,
              description: 'Vistoria aceita',
              metadata: {
                inspectionId: inspection.id,
                datetime: inspection.datetime,
                status: inspection.status,
                inspector: inspection.inspector,
                obs: inspection.obs,
              },
            });
          }
        } else if (
          inspection.status === 'CANCELADA' &&
          !auditedStatuses.has(`${inspection.id}:CANCELADA`)
        ) {
          events.push({
            type: TimelineEventType.INSPECTION_CANCELLED,
            date: inspection.updated_at ?? inspection.datetime,
            description: 'Vistoria cancelada',
            metadata: {
              inspectionId: inspection.id,
              datetime: inspection.datetime,
              inspector: inspection.inspector,
              obs: inspection.obs,
            },
          });
        }
      }

      for (const event of auditEvents ?? []) {
        if (event.event_type === 'SCHEDULED') continue;

        const mapped = this.mapInspectionAuditEvent(event);
        if (mapped) events.push(mapped);
      }
    }

    // Ordenar eventos por data
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      clientId: client.id,
      clientName: client.name,
      unit: client.unit,
      events,
    };
  }

  private mapInspectionAuditEvent(event: any): TimelineEventDto | null {
    const metadata = {
      inspectionId: event.idinspection,
      previousStatus: event.previous_status,
      status: event.new_status,
      previousDatetime: event.previous_datetime,
      datetime: event.new_datetime,
      inspector: event.inspector,
      obs: event.obs,
      countsAsRejection: event.counts_as_rejection,
      ...(event.metadata ?? {}),
    };

    if (event.event_type === 'RESCHEDULED') {
      return {
        type: TimelineEventType.INSPECTION_RESCHEDULED,
        date: event.created_at,
        description: 'Vistoria reagendada',
        metadata,
      };
    }

    if (event.event_type === 'UPDATED') {
      return {
        type: TimelineEventType.INSPECTION_UPDATED,
        date: event.created_at,
        description: 'Dados da vistoria atualizados',
        metadata,
      };
    }

    if (event.event_type !== 'STATUS_CHANGED') return null;
    if (event.new_status === 'ACEITE' || event.new_status === 'APROVADA') {
      return {
        type: TimelineEventType.INSPECTION_APPROVED,
        date: event.created_at,
        description: 'Vistoria aceita',
        metadata,
      };
    }
    if (['RECUSA', 'RECUSA_EM_ABERTO'].includes(event.new_status)) {
      return {
        type: TimelineEventType.INSPECTION_REJECTED,
        date: event.created_at,
        description:
          event.new_status === 'RECUSA_EM_ABERTO'
            ? 'Vistoria com recusa em aberto'
            : 'Vistoria recusada',
        metadata,
      };
    }
    if (event.new_status === 'CANCELADA') {
      return {
        type: TimelineEventType.INSPECTION_CANCELLED,
        date: event.created_at,
        description: event.counts_as_rejection
          ? 'Vistoria cancelada e contabilizada como recusa'
          : 'Vistoria cancelada',
        metadata,
      };
    }

    return {
      type: TimelineEventType.INSPECTION_STATUS_CHANGED,
      date: event.created_at,
      description: `Status da vistoria alterado para ${event.new_status}`,
      metadata,
    };
  }
}
