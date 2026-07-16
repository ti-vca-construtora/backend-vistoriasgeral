import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { isValidBrazilPhone, normalizeBrazilPhone } from './phone.util';

@Injectable()
export class ClientsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(query: { id?: number; identerprise?: number }, user: AuthUser) {
    let q = this.supabase
      .getAdmin()
      .from('tb_clients')
      .select(`
        id,
        name,
        unit,
        seller,
        phone,
        identerprise,
        created_at,
        updated_at,
        nameenterprise:tb_enterprises!inner(name)
      `);

    if (query.id) q = q.eq('id', query.id);
    if (query.identerprise) q = q.eq('identerprise', query.identerprise);

    if (!isAdmin(user)) {
      if (query.identerprise && !user.enterpriseIds.includes(Number(query.identerprise))) {
        return [];
      }

      if (!query.identerprise) {
        if (user.enterpriseIds.length === 0) return [];
        q = q.in('identerprise', user.enterpriseIds);
      }
    }

    const { data, error } = await q;

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data.map(({ nameenterprise, ...rest }) => {
      const enterpriseName = Array.isArray(nameenterprise)
        ? nameenterprise[0]?.name ?? null
        : (nameenterprise as any)?.name ?? null;

      return {
        ...rest,
        nameenterprise: enterpriseName,
      };
    });
  }

  async create(dto: CreateClientDto) {
    const clientPayload = this.normalizeClientPhone(dto);
    const { data: exists } = await this.supabase.getAdmin()
      .from('tb_clients')
      .select('id')
      .eq('name', clientPayload.name)
      .eq('unit', clientPayload.unit)
      .eq('identerprise', clientPayload.identerprise)
      .maybeSingle();

    if (exists) {
      throw new BadRequestException(
        'Já existe um cliente com essa unidade neste empreendimento',
      );
    }

    const { data, error } = await this.supabase.getAdmin()
      .from('tb_clients')
      .insert(clientPayload)
      .select()
      .single();

    if (error) {
      if (error.message.includes('tb_clients_identerprise_fkey')) {
        throw new BadRequestException(
          'Empresa informada não existe',
        );
      }

      throw new BadRequestException(error.message);
    }

    try {
      const payload = {
        idclient: data.id,
        status: 'PENDENTE',
        status_quality: 'PENDENTE',
        status_construction: 'PENDENTE',
        status_delivery: 'PENDENTE',
        obs: null,
        situation: 'ATIVO',
      };

      await this.supabase.getAdmin()
        .from('tb_general')
        .insert(payload);
    } catch (e) {
      // Não interromper a criação do cliente se a criação do overview falhar.
    }

    return data;
  }

  async update(id: number, dto: UpdateClientDto) {
    const { data: current } = await this.supabase.getAdmin()
      .from('tb_clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!current) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const clientPayload = this.normalizeClientPhone(dto);
    const name = clientPayload.name ?? current.name;
    const unit = clientPayload.unit ?? current.unit;
    const identerprise =
      clientPayload.identerprise ?? current.identerprise;

    const { data: duplicate } = await this.supabase.getAdmin()
      .from('tb_clients')
      .select('id')
      .eq('name', name)
      .eq('unit', unit)
      .eq('identerprise', identerprise)
      .neq('id', id)
      .maybeSingle();

    if (duplicate) {
      throw new BadRequestException(
        'Atualização resultaria em cliente duplicado na mesma unidade',
      );
    }

    const { data, error } = await this.supabase.getAdmin()
      .from('tb_clients')
      .update(clientPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: number) {
    const { data: exists } = await this.supabase.getAdmin()
      .from('tb_clients')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!exists) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const { error } = await this.supabase.getAdmin()
      .from('tb_clients')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(
        'Cliente não pode ser excluído pois possui registros vinculados',
      );
    }

    return { message: 'Cliente excluído com sucesso' };
  }

  async bulkCreate(clients: CreateClientDto[]) {
    const admin = this.supabase.getAdmin();
    const normalizedClients = clients.map((client) =>
      this.normalizeClientPhone(client),
    );
    const enterpriseIds = [
      ...new Set(normalizedClients.map((client) => client.identerprise)),
    ];

    const { data: existing } = await admin
      .from('tb_clients')
      .select('name, unit, identerprise')
      .in('identerprise', enterpriseIds);

    const existingSet = new Set(
      (existing ?? []).map(e => `${e.name}|${e.unit}|${e.identerprise}`),
    );

    const toInsert: CreateClientDto[] = [];
    const skippedDetails: { name: string; unit: string; reason: string }[] = [];
    const seenInBatch = new Set<string>();

    for (const client of normalizedClients) {
      const key = `${client.name}|${client.unit}|${client.identerprise}`;

      if (existingSet.has(key)) {
        skippedDetails.push({
          name: client.name,
          unit: client.unit,
          reason: 'Cliente já existe neste empreendimento',
        });
      } else if (seenInBatch.has(key)) {
        skippedDetails.push({
          name: client.name,
          unit: client.unit,
          reason: 'Duplicado dentro do lote de importação',
        });
      } else {
        seenInBatch.add(key);
        toInsert.push(client);
      }
    }

    const BATCH_SIZE = 500;
    const insertedClients: any[] = [];

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);

      const { data, error } = await admin
        .from('tb_clients')
        .insert(batch)
        .select();

      if (error) {
        throw new BadRequestException(
          `Erro ao inserir lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`,
        );
      }

      insertedClients.push(...(data ?? []));
    }

    if (insertedClients.length > 0) {
      const overviews = insertedClients.map(c => ({
        idclient: c.id,
        status: 'PENDENTE',
        status_quality: 'PENDENTE',
        status_construction: 'PENDENTE',
        status_delivery: 'PENDENTE',
        obs: null,
        situation: 'ATIVO',
      }));

      for (let i = 0; i < overviews.length; i += BATCH_SIZE) {
        const batch = overviews.slice(i, i + BATCH_SIZE);
        await admin.from('tb_general').insert(batch);
      }
    }

    return {
      total: normalizedClients.length,
      inserted: insertedClients.length,
      skipped: skippedDetails.length,
      skippedDetails,
    };
  }

  private normalizeClientPhone<T extends { phone?: unknown }>(client: T): T {
    const phone = normalizeBrazilPhone(client.phone);
    if (!isValidBrazilPhone(phone)) {
      throw new BadRequestException(
        'Telefone invalido. Informe DDD + numero, com ou sem o codigo 55.',
      );
    }

    return { ...client, phone };
  }
}
