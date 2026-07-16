import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class HuggyRequestError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

type SendSurveyMessage = {
  kind: 'INITIAL' | 'REMINDER';
  clientName: string;
  unit: string;
  phone: string;
  inspectionDate: string;
  surveyPath: string;
  surveyUrl: string;
};

@Injectable()
export class HuggyClient {
  constructor(private readonly config: ConfigService) {}

  async sendSurveyMessage(message: SendSurveyMessage) {
    const phone = this.normalizeBrazilPhone(message.phone);
    const contact = await this.findOrCreateContact(phone, message.clientName);
    const chat = await this.findOrCreateChat(String(contact.id));
    const dynamicButtonsEnabled =
      this.config.get<string>('HUGGY_DYNAMIC_BUTTONS_ENABLED') === 'true';
    // O lembrete atual tambem tem CTA fixo. Ate os templates dinamicos serem
    // recriados, reutilizamos o inicial para manter o link clicavel no corpo.
    const templateKind = dynamicButtonsEnabled ? message.kind : 'INITIAL';
    const templateId = this.templateId(templateKind);
    const params = {
      '1': message.clientName,
      '2': message.unit,
      '3': message.inspectionDate,
      // O template inicial ainda exige {{4}}. A Meta pode descartar valores
      // vazios ou invisiveis mesmo quando a Huggy aceita a requisicao.
      ...(templateKind === 'INITIAL'
        ? {
            '4': dynamicButtonsEnabled
              ? 'Acesse pelo botão abaixo.'
              : message.surveyUrl,
          }
        : {}),
    };

    const sentMessage = await this.request<any>(`/chats/${chat.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        hsm: {
          template_id: templateId,
          params,
          buttons: {
            params: dynamicButtonsEnabled
              ? [
                  {
                    type: 'text',
                    text: message.surveyPath,
                  },
                ]
              : [],
          },
        },
      }),
    });
    this.assertMessageAccepted(sentMessage);

    return {
      contactId: String(contact.id),
      chatId: String(chat.id),
    };
  }

  private normalizeBrazilPhone(value: string) {
    let digits = (value || '').replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

    if (!/^55\d{10,11}$/.test(digits)) {
      throw new HuggyRequestError(
        'Telefone invalido para envio no WhatsApp',
        false,
      );
    }

    return digits;
  }

  private async findOrCreateContact(phone: string, name: string) {
    const contacts = await this.request<any[]>(
      `/contacts?phone=${encodeURIComponent(phone)}`,
    );
    const existing = Array.isArray(contacts) ? contacts[0] : null;
    if (existing?.id) return existing;

    return this.request<any>('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name, phone }),
    });
  }

  private async findOrCreateChat(contactId: string) {
    const channelUuid = this.requiredConfig('HUGGY_CHANNEL_UUID');
    const chats = await this.request<any[]>(
      `/chats?customer=${encodeURIComponent(contactId)}&channel=whatsapp`,
    );
    const openChat = (Array.isArray(chats) ? chats : [])
      .filter(
        (chat) =>
          !chat.closedAt &&
          chat.situation !== 'finishing' &&
          this.chatUsesChannel(chat, channelUuid),
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime(),
      )[0];

    if (openChat?.id) return openChat;

    return this.request<any>(`/contacts/${contactId}/chats`, {
      method: 'POST',
      body: JSON.stringify({
        channelUuid,
      }),
    });
  }

  private chatUsesChannel(chat: any, channelUuid: string) {
    const channels = Array.isArray(chat?.channels) ? chat.channels : [];
    return channels.some(
      (channel: any) =>
        String(channel?.uuid ?? channel?.id ?? '') === channelUuid,
    );
  }

  private assertMessageAccepted(message: any) {
    const explicitError = message?.reason ?? message?.error;
    const text = String(explicitError ?? message?.text ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (
      explicitError ||
      (text.includes('nao pode ser enviada') &&
        text.includes('parametro obrigatorio'))
    ) {
      throw new HuggyRequestError(
        `Huggy recusou a mensagem: ${String(explicitError ?? message.text)}`,
        false,
      );
    }
  }

  private templateId(kind: 'INITIAL' | 'REMINDER') {
    const key =
      kind === 'INITIAL'
        ? 'HUGGY_INITIAL_TEMPLATE_ID'
        : 'HUGGY_REMINDER_TEMPLATE_ID';
    const value = Number(this.requiredConfig(key));
    if (!Number.isInteger(value) || value <= 0) {
      throw new HuggyRequestError(
        `${key} deve ser um ID numerico valido`,
        false,
      );
    }
    return value;
  }

  private requiredConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new HuggyRequestError(`Configuracao ${key} nao informada`, false);
    }
    return value;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.requiredConfig('HUGGY_ACCESS_TOKEN');
    const base = (
      this.config.get<string>('HUGGY_API_BASE_URL') ||
      'https://api.huggy.app/v3'
    ).replace(/\/$/, '');
    const companyId = this.config.get<string>('HUGGY_COMPANY_ID')?.trim();
    const prefix = companyId ? `${base}/companies/${companyId}` : base;

    let response: Response;
    try {
      response = await fetch(`${prefix}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      throw new HuggyRequestError(
        `Falha de conexao com a Huggy: ${(error as Error).message}`,
        true,
      );
    }

    const body = await response.text();
    if (!response.ok) {
      throw new HuggyRequestError(
        `Huggy ${response.status}: ${body || response.statusText}`,
        response.status === 429 || response.status >= 500,
      );
    }

    if (!body) return {} as T;
    try {
      return JSON.parse(body) as T;
    } catch {
      return {} as T;
    }
  }
}
