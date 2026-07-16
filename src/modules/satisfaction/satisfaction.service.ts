import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { QuerySatisfactionDto } from './dto/query-satisfaction.dto';
import { SubmitSatisfactionResponseDto } from './dto/submit-satisfaction-response.dto';
import { calculateSatisfactionMetrics } from './satisfaction-metrics';

const SURVEY_SELECT = `
  *,
  tb_inspections!inner (
    id,
    idclient,
    datetime,
    inspector,
    status,
    tb_clients!inner (
      id,
      name,
      unit,
      phone,
      identerprise,
      tb_enterprises (
        id,
        name
      )
    )
  ),
  tb_satisfaction_notifications (
    id,
    kind,
    status,
    attempts,
    next_attempt_at,
    sent_at,
    last_error,
    huggy_contact_id,
    huggy_chat_id
  )
`;

@Injectable()
export class SatisfactionService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async getPublicSurvey(token: string) {
    const { data, error } = await this.admin
      .from('tb_satisfaction_surveys')
      .select(
        `
        id,
        status,
        tb_inspections!inner (
          datetime,
          tb_clients!inner (
            tb_enterprises (name)
          )
        )
      `,
      )
      .eq('public_token', token)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Pesquisa nao encontrada');

    const inspection = this.unwrap((data as any).tb_inspections);
    const client = this.unwrap(inspection?.tb_clients);
    const enterprise = this.unwrap(client?.tb_enterprises);

    return {
      status: data.status,
      inspectionDate: inspection?.datetime ?? null,
      enterpriseName: enterprise?.name ?? null,
    };
  }

  async submitPublicSurvey(token: string, dto: SubmitSatisfactionResponseDto) {
    const { data: survey, error: findError } = await this.admin
      .from('tb_satisfaction_surveys')
      .select('id, status')
      .eq('public_token', token)
      .maybeSingle();

    if (findError) throw new BadRequestException(findError.message);
    if (!survey) throw new NotFoundException('Pesquisa nao encontrada');
    if (survey.status === 'ANSWERED') {
      throw new ConflictException('Esta pesquisa ja foi respondida');
    }

    const answeredAt = new Date().toISOString();
    const { data, error } = await this.admin
      .from('tb_satisfaction_surveys')
      .update({
        ...dto,
        positive_highlight: dto.positive_highlight ?? null,
        feedback: dto.feedback?.trim() || null,
        status: 'ANSWERED',
        answered_at: answeredAt,
        updated_at: answeredAt,
      })
      .eq('id', survey.id)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new ConflictException('Esta pesquisa ja foi respondida');

    await this.admin
      .from('tb_satisfaction_notifications')
      .update({ status: 'CANCELED', updated_at: answeredAt })
      .eq('idsurvey', survey.id)
      .in('status', ['PENDING', 'PROCESSING', 'FAILED']);

    return { success: true };
  }

  async getSummary(query: QuerySatisfactionDto, user: AuthUser) {
    const rows = await this.findRows(query, user);
    return calculateSatisfactionMetrics(rows as any);
  }

  async getResponses(query: QuerySatisfactionDto, user: AuthUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    let dbQuery = this.createFilteredQuery(query, user, true);
    dbQuery = dbQuery
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await dbQuery;
    if (error) throw new BadRequestException(error.message);

    return {
      items: (data ?? []).map((row: any) => this.mapSurvey(row)),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async getResponse(id: number, user: AuthUser) {
    const row = await this.findAccessibleSurvey(id, user);
    return this.mapSurvey(row);
  }

  async getByInspection(idinspection: number, user: AuthUser) {
    let query = this.admin
      .from('tb_satisfaction_surveys')
      .select(SURVEY_SELECT)
      .eq('idinspection', idinspection);
    query = this.applyUserAccess(query, user);

    const { data, error } = await query.maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data)
      throw new NotFoundException('Pesquisa da vistoria nao encontrada');
    return this.mapSurvey(data);
  }

  async retryNotification(id: number, user: AuthUser) {
    const survey = await this.findAccessibleSurvey(id, user);
    if (survey.status === 'ANSWERED') {
      throw new BadRequestException('Pesquisa ja respondida');
    }

    const notifications = (survey.tb_satisfaction_notifications ?? []) as any[];
    const failed = [...notifications]
      .filter((notification) => notification.status === 'FAILED')
      .sort((a, b) => Number(b.id) - Number(a.id))[0];

    if (!failed) {
      throw new BadRequestException('Nao existe notificacao com falha');
    }

    const now = new Date().toISOString();
    const { data, error } = await this.admin
      .from('tb_satisfaction_notifications')
      .update({
        status: 'PENDING',
        attempts: 0,
        next_attempt_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq('id', failed.id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  private async findRows(query: QuerySatisfactionDto, user: AuthUser) {
    const rows: any[] = [];
    const batchSize = 1000;

    for (let offset = 0; ; offset += batchSize) {
      const dbQuery = this.createFilteredQuery(query, user, false)
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      const { data, error } = await dbQuery;
      if (error) throw new BadRequestException(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < batchSize) break;
    }

    return rows;
  }

  private createFilteredQuery(
    query: QuerySatisfactionDto,
    user: AuthUser,
    withCount: boolean,
  ) {
    let dbQuery: any = this.admin
      .from('tb_satisfaction_surveys')
      .select(SURVEY_SELECT, withCount ? { count: 'exact' } : undefined);

    dbQuery = this.applyUserAccess(dbQuery, user);
    if (query.identerprise) {
      if (!isAdmin(user) && !user.enterpriseIds.includes(query.identerprise)) {
        throw new ForbiddenException('Usuario sem acesso ao empreendimento');
      }
      dbQuery = dbQuery.eq(
        'tb_inspections.tb_clients.identerprise',
        query.identerprise,
      );
    }
    if (query.from) {
      dbQuery = dbQuery.gte(
        'tb_inspections.datetime',
        new Date(`${query.from}T00:00:00-03:00`).toISOString(),
      );
    }
    if (query.to) {
      const end = new Date(`${query.to}T00:00:00-03:00`);
      end.setDate(end.getDate() + 1);
      dbQuery = dbQuery.lt('tb_inspections.datetime', end.toISOString());
    }
    if (query.inspector) {
      dbQuery = dbQuery.ilike(
        'tb_inspections.inspector',
        `%${query.inspector}%`,
      );
    }
    if (query.status) dbQuery = dbQuery.eq('status', query.status);
    if (query.segment === 'PROMOTER') {
      dbQuery = dbQuery.gte('recommendation_score', 9);
    } else if (query.segment === 'PASSIVE') {
      dbQuery = dbQuery
        .gte('recommendation_score', 7)
        .lte('recommendation_score', 8);
    } else if (query.segment === 'DETRACTOR') {
      dbQuery = dbQuery.lte('recommendation_score', 6);
    }

    return dbQuery;
  }

  private applyUserAccess(query: any, user: AuthUser) {
    if (isAdmin(user)) return query;
    if (user.enterpriseIds.length === 0) {
      return query.eq('tb_inspections.tb_clients.identerprise', -1);
    }
    return query.in(
      'tb_inspections.tb_clients.identerprise',
      user.enterpriseIds,
    );
  }

  private async findAccessibleSurvey(id: number, user: AuthUser) {
    let query = this.admin
      .from('tb_satisfaction_surveys')
      .select(SURVEY_SELECT)
      .eq('id', id);
    query = this.applyUserAccess(query, user);
    const { data, error } = await query.maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Pesquisa nao encontrada');
    return data as any;
  }

  private mapSurvey(row: any) {
    const inspection = this.unwrap(row.tb_inspections);
    const client = this.unwrap(inspection?.tb_clients);
    const enterprise = this.unwrap(client?.tb_enterprises);
    const notifications = (row.tb_satisfaction_notifications ?? []) as any[];
    const latestNotification = [...notifications].sort(
      (a, b) => Number(b.id) - Number(a.id),
    )[0];
    const failedNotification = [...notifications]
      .filter((notification) => notification.status === 'FAILED')
      .sort((a, b) => Number(b.id) - Number(a.id))[0];
    const initialNotification = notifications.find(
      (notification) => notification.kind === 'INITIAL',
    );
    const deliveryNotification =
      failedNotification ?? initialNotification ?? latestNotification;

    return {
      id: row.id,
      idinspection: row.idinspection,
      status: row.status,
      service_rating: row.service_rating,
      broker_rating: row.broker_rating,
      inspector_rating: row.inspector_rating,
      common_areas_rating: row.common_areas_rating,
      unit_quality_rating: row.unit_quality_rating,
      recommendation_score: row.recommendation_score,
      positive_highlight: row.positive_highlight,
      feedback: row.feedback,
      answered_at: row.answered_at,
      created_at: row.created_at,
      public_url: this.publicUrl(row.public_token),
      client: {
        id: client?.id ?? null,
        name: client?.name ?? null,
        unit: client?.unit ?? null,
        identerprise: client?.identerprise ?? null,
      },
      enterprise: {
        id: enterprise?.id ?? null,
        name: enterprise?.name ?? null,
      },
      inspection: {
        datetime: inspection?.datetime ?? null,
        inspector: inspection?.inspector ?? null,
        status: inspection?.status ?? null,
      },
      notifications,
      delivery_status: deliveryNotification?.status ?? 'PENDING',
      delivery_error: deliveryNotification?.last_error ?? null,
    };
  }

  private publicUrl(token: string) {
    const base = (
      this.config.get<string>('PUBLIC_SURVEY_BASE_URL') ||
      'http://localhost:3010'
    ).replace(/\/$/, '');
    return `${base}/pesquisa/${token}`;
  }

  private unwrap(value: any) {
    return Array.isArray(value) ? value[0] : value;
  }
}
