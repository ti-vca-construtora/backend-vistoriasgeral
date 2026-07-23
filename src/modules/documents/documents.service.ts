import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../infra/supabase/supabase.service';

const DOCUMENTS_LINK_KEY = 'sidebar_documents_url';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get admin() {
    return this.supabaseService.getAdmin();
  }

  async list() {
    const { data, error } = await this.admin
      .from('tb_enterprise_documents')
      .select(
        `
        id,
        identerprise,
        title,
        filename,
        mime_type,
        size_bytes,
        public_token,
        active,
        created_at,
        updated_at,
        tb_enterprises (id, name)
      `,
      )
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row: any) => this.mapDocument(row));
  }

  async findOrientation(identerprise: number) {
    const { data, error } = await this.admin
      .from('tb_enterprise_documents')
      .select(
        `
        id,
        identerprise,
        title,
        filename,
        mime_type,
        size_bytes,
        public_token,
        active,
        created_at,
        updated_at,
        tb_enterprises (id, name)
      `,
      )
      .eq('identerprise', identerprise)
      .eq('kind', 'ORIENTATION')
      .eq('active', true)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Orientacoes nao cadastradas');
    return this.mapDocument(data);
  }

  async uploadOrientation(identerprise: number, file: any, title?: string) {
    if (!file) throw new BadRequestException('Selecione um arquivo PDF');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Somente arquivos PDF sao permitidos');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('O PDF deve ter no maximo 10 MB');
    }

    const { data: enterprise } = await this.admin
      .from('tb_enterprises')
      .select('id')
      .eq('id', identerprise)
      .maybeSingle();
    if (!enterprise)
      throw new NotFoundException('Empreendimento nao encontrado');

    const now = new Date().toISOString();
    await this.admin
      .from('tb_enterprise_documents')
      .update({ active: false, updated_at: now })
      .eq('identerprise', identerprise)
      .eq('kind', 'ORIENTATION')
      .eq('active', true);

    const { data, error } = await this.admin
      .from('tb_enterprise_documents')
      .insert({
        identerprise,
        kind: 'ORIENTATION',
        title: title?.trim() || 'Orientacoes para vistoria',
        filename: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        content_base64: file.buffer.toString('base64'),
        active: true,
      })
      .select(
        'id, identerprise, title, filename, mime_type, size_bytes, public_token, active, created_at, updated_at',
      )
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.mapDocument(data);
  }

  async remove(id: number) {
    const { error } = await this.admin
      .from('tb_enterprise_documents')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getPublicFile(token: string) {
    const { data, error } = await this.admin
      .from('tb_enterprise_documents')
      .select('filename, mime_type, content_base64, active')
      .eq('public_token', token)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Documento nao encontrado');
    return {
      filename: data.filename,
      mimeType: data.mime_type,
      buffer: Buffer.from(data.content_base64, 'base64'),
    };
  }

  async getSidebarLink() {
    const { data, error } = await this.admin
      .from('tb_system_settings')
      .select('value')
      .eq('key', DOCUMENTS_LINK_KEY)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return { url: data?.value ?? '' };
  }

  async updateSidebarLink(url: string) {
    const normalized = url.trim();
    if (normalized && !/^https?:\/\/[^\s]+$/i.test(normalized)) {
      throw new BadRequestException('Informe um link http ou https valido');
    }
    const now = new Date().toISOString();
    const { error } = await this.admin.from('tb_system_settings').upsert(
      {
        key: DOCUMENTS_LINK_KEY,
        value: normalized,
        updated_at: now,
      },
      { onConflict: 'key' },
    );
    if (error) throw new BadRequestException(error.message);
    return { url: normalized };
  }

  private mapDocument(row: any) {
    const enterprise = Array.isArray(row.tb_enterprises)
      ? row.tb_enterprises[0]
      : row.tb_enterprises;
    return {
      ...row,
      tb_enterprises: undefined,
      enterprise: enterprise
        ? { id: enterprise.id, name: enterprise.name }
        : null,
      public_url: `${this.publicBase()}/orientacoes/${row.public_token}`,
    };
  }

  private publicBase() {
    return (
      this.config.get<string>('PUBLIC_APP_BASE_URL') ||
      this.config.get<string>('PUBLIC_SURVEY_BASE_URL') ||
      'http://localhost:3010'
    ).replace(/\/$/, '');
  }
}
