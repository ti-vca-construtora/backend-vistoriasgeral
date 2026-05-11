import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthUser, isAdmin } from '../../infra/auth/auth-user';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

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
      // Trata tanto array quanto objeto
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
    const { data: exists } = await this.supabase.getAdmin()
      .from('tb_clients')
      .select('id')
      .eq('name', dto.name)
      .eq('unit', dto.unit)
      .eq('identerprise', dto.identerprise)
      .maybeSingle();

    if (exists) {
      throw new BadRequestException(
        'Já existe um cliente com essa unidade neste empreendimento',
      );
    }

    const { data, error } = await this.supabase.getAdmin()
      .from('tb_clients')
      .insert(dto)
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
    
    // 3️⃣ Criar overview automaticamente para o cliente recém-criado
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
      // não interromper a criação do cliente se a criação do overview falhar
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

    const name = dto.name ?? current.name;
    const unit = dto.unit ?? current.unit;
    const identerprise = dto.identerprise ?? current.identerprise;

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
      .update(dto)
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

  // ── BULK IMPORT ──────────────────────────────────────────────
  async bulkCreate(clients: CreateClientDto[]) {
    const admin = this.supabase.getAdmin();

    // 1) Buscar clientes já existentes no banco para os empreendimentos envolvidos
    const enterpriseIds = [...new Set(clients.map(c => c.identerprise))];

    const { data: existing } = await admin
      .from('tb_clients')
      .select('name, unit, identerprise')
      .in('identerprise', enterpriseIds);

    // Criar set para lookup rápido: "name|unit|identerprise"
    const existingSet = new Set(
      (existing ?? []).map(e => `${e.name}|${e.unit}|${e.identerprise}`),
    );

    // 2) Separar novos vs duplicados
    const toInsert: CreateClientDto[] = [];
    const skippedDetails: { name: string; unit: string; reason: string }[] = [];
    const seenInBatch = new Set<string>();

    for (const client of clients) {
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

    // 3) Inserir em lotes de 500 (limite seguro do Supabase)
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

    // 4) Criar overviews em lote para todos os clientes inseridos
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
      total: clients.length,
      inserted: insertedClients.length,
      skipped: skippedDetails.length,
      skippedDetails,
    };
  }
}
