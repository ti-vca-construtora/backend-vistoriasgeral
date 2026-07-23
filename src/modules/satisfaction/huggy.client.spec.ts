import { ConfigService } from '@nestjs/config';
import { HuggyClient } from './huggy.client';

const CHANNEL_UUID = 'dedae4f0-8275-4d9d-abb6-66af99730b73';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => JSON.stringify(body),
  } as Response;
}

function createClient(dynamicButtonsEnabled = false) {
  const values: Record<string, string> = {
    HUGGY_ACCESS_TOKEN: 'test-token',
    HUGGY_CHANNEL_UUID: CHANNEL_UUID,
    HUGGY_INITIAL_TEMPLATE_ID: '100555',
    HUGGY_REMINDER_TEMPLATE_ID: '100556',
    HUGGY_INSPECTION_REMINDER_TEMPLATE_ID: '100607',
    HUGGY_DYNAMIC_BUTTONS_ENABLED: String(dynamicButtonsEnabled),
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return new HuggyClient(config);
}

describe('HuggyClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('creates a chat when the open chat belongs to another channel', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response([{ id: 60424026 }]))
      .mockResolvedValueOnce(
        response([
          {
            id: 456525121,
            situation: 'wait_for_chat',
            closedAt: null,
            channels: [{ uuid: 'disabled-channel' }],
          },
        ]),
      )
      .mockResolvedValueOnce(response({ id: 999 }))
      .mockResolvedValueOnce(response({}));

    await createClient().sendSurveyMessage({
      kind: 'INITIAL',
      clientName: 'Cliente Teste',
      unit: 'Unidade 1',
      phone: '5577999999999',
      inspectionDate: '15/07/2026',
      surveyPath: 'pesquisa/token',
      surveyUrl: 'http://10.0.1.127:3010/pesquisa/token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2][0]).toContain('/contacts/60424026/chats');
    expect(fetchMock.mock.calls[2][1]?.body).toBe(
      JSON.stringify({ channelUuid: CHANNEL_UUID }),
    );
    expect(fetchMock.mock.calls[3][0]).toContain('/chats/999/messages');
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toEqual({
      hsm: {
        template_id: 100555,
        params: {
          '1': 'Cliente Teste',
          '2': 'Unidade 1',
          '3': '15/07/2026',
          '4': 'http://10.0.1.127:3010/pesquisa/token',
        },
        buttons: {
          params: [],
        },
      },
    });
  });

  it('reuses an open chat from the configured channel', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response([{ id: 60424026 }]))
      .mockResolvedValueOnce(
        response([
          {
            id: 777,
            situation: 'auto',
            closedAt: null,
            channels: [{ uuid: CHANNEL_UUID }],
          },
        ]),
      )
      .mockResolvedValueOnce(response({}));

    await createClient(true).sendSurveyMessage({
      kind: 'REMINDER',
      clientName: 'Cliente Teste',
      unit: 'Unidade 1',
      phone: '5577999999999',
      inspectionDate: '15/07/2026',
      surveyPath: 'pesquisa/token',
      surveyUrl: 'http://10.0.1.127:3010/pesquisa/token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('/chats/777/messages');
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      hsm: {
        template_id: 100556,
        params: {
          '1': 'Cliente Teste',
          '2': 'Unidade 1',
          '3': '15/07/2026',
        },
        buttons: {
          params: [{ type: 'text', text: 'pesquisa/token' }],
        },
      },
    });
  });

  it('keeps the initial template variables ordered and sends only the URL suffix', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response([{ id: 60424026 }]))
      .mockResolvedValueOnce(
        response([
          {
            id: 777,
            situation: 'auto',
            closedAt: null,
            channels: [{ uuid: CHANNEL_UUID }],
          },
        ]),
      )
      .mockResolvedValueOnce(response({ id: 123 }));

    await createClient(true).sendSurveyMessage({
      kind: 'INITIAL',
      clientName: 'Silas Pires',
      unit: 'QD04 - CASA 04',
      phone: '5577999999999',
      inspectionDate: '16/07/2026',
      surveyPath: 'pesquisa/token-da-pesquisa',
      surveyUrl: 'https://example.com/pesquisa/token-da-pesquisa',
    });

    const rawBody = String(fetchMock.mock.calls[2][1]?.body);
    expect(JSON.parse(rawBody)).toEqual({
      hsm: {
        template_id: 100555,
        params: {
          '1': 'Silas Pires',
          '2': 'QD04 - CASA 04',
          '3': '16/07/2026',
          '4': 'Acesse pelo botão abaixo.',
        },
        buttons: {
          params: [{ type: 'text', text: 'pesquisa/token-da-pesquisa' }],
        },
      },
    });
    expect(rawBody.indexOf('"1"')).toBeLessThan(rawBody.indexOf('"2"'));
    expect(rawBody.indexOf('"2"')).toBeLessThan(rawBody.indexOf('"3"'));
    expect(rawBody.indexOf('"3"')).toBeLessThan(rawBody.indexOf('"4"'));
  });

  it('sends the scheduled inspection reminder with ordered variables', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(response([{ id: 60424026 }]))
      .mockResolvedValueOnce(
        response([
          {
            id: 777,
            situation: 'auto',
            closedAt: null,
            channels: [{ uuid: CHANNEL_UUID }],
          },
        ]),
      )
      .mockResolvedValueOnce(response({ id: 9924140790 }));

    const result = await createClient().sendInspectionReminder({
      clientName: 'Silas Pires',
      unit: 'QD04 - CASA 04',
      enterpriseName: 'VCA Verso',
      phone: '77981243447',
      inspectionDate: '18/07/2026',
      inspectionTime: '10:00',
      orientationPath: 'orientacoes/abc-123',
    });

    const rawBody = String(fetchMock.mock.calls[2][1]?.body);
    expect(JSON.parse(rawBody)).toEqual({
      hsm: {
        template_id: 100607,
        params: {
          '1': 'Silas Pires',
          '2': 'QD04 - CASA 04',
          '3': 'VCA Verso',
          '4': '18/07/2026',
          '5': '10:00',
        },
        buttons: {
          params: [
            {
              type: 'text',
              text: 'orientacoes/abc-123',
            },
          ],
        },
      },
    });
    expect(rawBody.indexOf('"1"')).toBeLessThan(rawBody.indexOf('"2"'));
    expect(rawBody.indexOf('"2"')).toBeLessThan(rawBody.indexOf('"3"'));
    expect(rawBody.indexOf('"3"')).toBeLessThan(rawBody.indexOf('"4"'));
    expect(rawBody.indexOf('"4"')).toBeLessThan(rawBody.indexOf('"5"'));
    expect(result.messageId).toBe('9924140790');
  });
});
