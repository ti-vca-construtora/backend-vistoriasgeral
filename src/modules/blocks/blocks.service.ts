import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { QueryBlockDto } from './dto/query-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

type BlockInterval = {
  startTime: string;
  endTime: string;
};

@Injectable()
export class BlocksService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async findAll(query: QueryBlockDto, user: AuthUser) {
    if (query.from && query.to && query.to < query.from) {
      throw new BadRequestException('A data final deve ser maior ou igual a inicial');
    }

    let q = this.admin
      .from('tb_inspection_blocks')
      .select(
        `
        *,
        tb_enterprises (
          id,
          name
        )
      `,
      )
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

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

  async create(dto: CreateBlockDto, user: AuthUser) {
    this.assertEnterpriseAccess(dto.identerprise, user);
    await this.assertEnterpriseExists(dto.identerprise);

    const intervals = this.resolveIntervals(dto);
    this.assertIntervalsNotInPast(dto.date, intervals);
    await this.assertIntervalsCanBeBlocked(dto.identerprise, dto.date, intervals);

    const payload = intervals.map((interval) => ({
      identerprise: dto.identerprise,
      date: dto.date,
      start_time: interval.startTime,
      end_time: interval.endTime,
      reason: dto.reason ?? null,
    }));

    const { data, error } = await this.admin
      .from('tb_inspection_blocks')
      .insert(payload)
      .select();

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async update(id: number, dto: UpdateBlockDto, user: AuthUser) {
    const current = await this.findById(id);
    this.assertEnterpriseAccess(current.identerprise, user);

    const interval = {
      startTime: dto.startTime ?? this.normalizeDbTime(current.start_time),
      endTime: dto.endTime ?? this.normalizeDbTime(current.end_time),
    };
    const date = dto.date ?? current.date;

    this.assertValidInterval(interval);
    this.assertIntervalsNotInPast(date, [interval]);
    await this.assertIntervalsCanBeBlocked(
      current.identerprise,
      date,
      [interval],
      id,
    );

    const { data, error } = await this.admin
      .from('tb_inspection_blocks')
      .update({
        date,
        start_time: interval.startTime,
        end_time: interval.endTime,
        reason: dto.reason ?? current.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: number, user: AuthUser) {
    const current = await this.findById(id);
    this.assertEnterpriseAccess(current.identerprise, user);

    const { error } = await this.admin
      .from('tb_inspection_blocks')
      .delete()
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  private async findById(id: number) {
    const { data, error } = await this.admin
      .from('tb_inspection_blocks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Bloqueio nao encontrado');
    return data;
  }

  private async assertEnterpriseExists(identerprise: number) {
    const { data, error } = await this.admin
      .from('tb_enterprises')
      .select('id')
      .eq('id', identerprise)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Empreendimento informado nao existe');
  }

  private assertEnterpriseAccess(identerprise: number, user: AuthUser) {
    if (isAdmin(user)) return;

    if (!user.enterpriseIds.includes(Number(identerprise))) {
      throw new ForbiddenException('Usuario sem acesso ao empreendimento');
    }
  }

  private resolveIntervals(dto: CreateBlockDto): BlockInterval[] {
    if (dto.startTime && dto.endTime) {
      const interval = {
        startTime: dto.startTime,
        endTime: dto.endTime,
      };
      this.assertValidInterval(interval);
      return [interval];
    }

    const times = [...new Set(dto.times ?? [])].sort(
      (a, b) => this.timeToMinutes(a) - this.timeToMinutes(b),
    );

    if (times.length === 0) {
      throw new BadRequestException('Informe startTime/endTime ou times para criar o bloqueio');
    }

    const intervals = times.map((time) => ({
      startTime: time,
      endTime: this.addMinutes(time, 30),
    }));

    intervals.forEach((interval) => this.assertValidInterval(interval));
    return intervals;
  }

  private assertValidInterval(interval: BlockInterval) {
    this.assertValidTime(interval.startTime);
    this.assertValidTime(interval.endTime);

    if (this.timeToMinutes(interval.endTime) <= this.timeToMinutes(interval.startTime)) {
      throw new BadRequestException('Horario final deve ser maior que o inicial');
    }
  }

  private assertIntervalsNotInPast(date: string, intervals: BlockInterval[]) {
    const today = this.todayInBrazil();

    if (date < today.date) {
      throw new BadRequestException('Nao e permitido criar bloqueio em data passada');
    }

    if (date > today.date) return;

    const nowMinutes = this.timeToMinutes(today.time);
    const hasPastStart = intervals.some(
      (interval) => this.timeToMinutes(interval.startTime) < nowMinutes,
    );

    if (hasPastStart) {
      throw new BadRequestException('Nao e permitido criar bloqueio em horario passado');
    }
  }

  private async assertIntervalsCanBeBlocked(
    identerprise: number,
    date: string,
    intervals: BlockInterval[],
    ignoreBlockId?: number,
  ) {
    const { data: existingBlocks, error: blocksError } = await this.admin
      .from('tb_inspection_blocks')
      .select('id, start_time, end_time')
      .eq('identerprise', identerprise)
      .eq('date', date);

    if (blocksError) throw new BadRequestException(blocksError.message);

    for (const interval of intervals) {
      const hasOverlap = (existingBlocks ?? []).some((block) =>
        Number(block.id) !== Number(ignoreBlockId)
          && this.intervalsOverlap(
            interval.startTime,
            interval.endTime,
            this.normalizeDbTime(block.start_time),
            this.normalizeDbTime(block.end_time),
          ),
      );

      if (hasOverlap) {
        throw new BadRequestException('Ja existe bloqueio para parte deste intervalo');
      }
    }

    const hasInternalOverlap = intervals.some((interval, index) =>
      intervals.some((other, otherIndex) =>
        index !== otherIndex
          && this.intervalsOverlap(
            interval.startTime,
            interval.endTime,
            other.startTime,
            other.endTime,
          ),
      ),
    );

    if (hasInternalOverlap) {
      throw new BadRequestException('Intervalos de bloqueio nao podem se sobrepor');
    }

    const inspections = await this.findInspectionsForEnterpriseDate(identerprise, date);
    const occupied = intervals.some((interval) =>
      inspections.some((inspection) =>
        this.timeWithinInterval(
          this.extractBrazilTime(inspection.datetime),
          interval.startTime,
          interval.endTime,
        ),
      ),
    );

    if (occupied) {
      throw new BadRequestException('Nao e possivel bloquear intervalo com vistoria ja agendada');
    }
  }

  private async findInspectionsForEnterpriseDate(identerprise: number, date: string) {
    const range = this.brazilDateUtcRange(date);

    const { data, error } = await this.admin
      .from('tb_inspections')
      .select(
        `
        id,
        datetime,
        tb_clients!inner (
          identerprise
        )
      `,
      )
      .eq('tb_clients.identerprise', identerprise)
      .gte('datetime', range.start)
      .lt('datetime', range.end);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
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

  private normalizeDbTime(time: string) {
    return time.slice(0, 5);
  }

  private timeToMinutes(time: string) {
    const [hour, minute] = this.normalizeDbTime(time).split(':').map(Number);
    return hour * 60 + minute;
  }

  private addMinutes(time: string, minutes: number) {
    const total = this.timeToMinutes(time) + minutes;
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private intervalsOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string,
  ) {
    return this.timeToMinutes(startA) < this.timeToMinutes(endB)
      && this.timeToMinutes(startB) < this.timeToMinutes(endA);
  }

  private timeWithinInterval(time: string, start: string, end: string) {
    const minutes = this.timeToMinutes(time);
    return minutes >= this.timeToMinutes(start) && minutes < this.timeToMinutes(end);
  }

  private todayInBrazil() {
    const now = new Date();
    return {
      date: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now),
      time: new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now),
    };
  }

  private extractBrazilTime(datetime: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(datetime));
  }

  private brazilDateUtcRange(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const BRAZIL_OFFSET = 3 * 60 * 60 * 1000;
    const startLocal = new Date(year, month - 1, day);
    const endLocal = new Date(year, month - 1, day + 1);

    return {
      start: new Date(startLocal.getTime() - BRAZIL_OFFSET).toISOString(),
      end: new Date(endLocal.getTime() - BRAZIL_OFFSET).toISOString(),
    };
  }
}
