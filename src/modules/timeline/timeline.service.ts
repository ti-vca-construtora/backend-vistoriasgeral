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
        if (inspection.status === 'RECUSA' && rejections.length > 0) {
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
}
