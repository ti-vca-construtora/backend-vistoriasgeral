# Timeline API

## Visão Geral

O módulo **Timeline** fornece uma visualização cronológica completa de todos os eventos relacionados a um cliente, desde seu cadastro até vistorias, recusas e resoluções.

## Endpoint

### GET /timeline/:idclient

Retorna a timeline completa de um cliente específico.

**Autenticação:** Bearer Token (obrigatório)

#### Parâmetros

- `idclient` (number, path): ID do cliente

#### Resposta de Sucesso (200)

```json
{
  "clientId": 1,
  "clientName": "João Silva",
  "unit": "Apto 101",
  "events": [
    {
      "type": "CLIENT_CREATED",
      "date": "2026-01-16T15:00:00Z",
      "description": "Cliente cadastrado no sistema",
      "metadata": {
        "clientId": 1,
        "name": "João Silva",
        "unit": "Apto 101"
      }
    },
    {
      "type": "UNIT_RELEASED",
      "date": "2026-01-20T10:00:00Z",
      "description": "Unidade liberada para vistoria",
      "metadata": {
        "status": "LIBERADA"
      }
    },
    {
      "type": "INSPECTION_SCHEDULED",
      "date": "2026-01-21T09:00:00Z",
      "description": "Vistoria agendada com Maria Inspetora",
      "metadata": {
        "inspectionId": 1,
        "datetime": "2026-01-25T14:00:00Z",
        "inspector": "Maria Inspetora",
        "status": "AGUARDANDO"
      }
    },
    {
      "type": "INSPECTION_COMPLETED",
      "date": "2026-01-25T16:00:00Z",
      "description": "Vistoria recusada",
      "metadata": {
        "inspectionId": 1,
        "status": "RECUSADA",
        "obs": "Problemas elétricos encontrados"
      }
    },
    {
      "type": "REJECTION_CREATED",
      "date": "2026-01-25T16:30:00Z",
      "description": "Recusa registrada",
      "metadata": {
        "rejectionId": 1,
        "inspectionId": 1,
        "previsionDate": "2026-02-10T00:00:00Z",
        "constructionStatus": "EM_ANDAMENTO",
        "status": "PENDENTE",
        "obs": "Aguardando correções elétricas"
      }
    },
    {
      "type": "REJECTION_RESOLVED",
      "date": "2026-02-08T11:00:00Z",
      "description": "Recusa resolvida",
      "metadata": {
        "rejectionId": 1,
        "inspectionId": 1,
        "obs": "Problemas corrigidos"
      }
    },
    {
      "type": "INSPECTION_SCHEDULED",
      "date": "2026-02-08T11:30:00Z",
      "description": "Vistoria agendada com Carlos Inspetor",
      "metadata": {
        "inspectionId": 2,
        "datetime": "2026-02-12T10:00:00Z",
        "inspector": "Carlos Inspetor",
        "status": "AGUARDANDO"
      }
    },
    {
      "type": "INSPECTION_COMPLETED",
      "date": "2026-02-12T12:00:00Z",
      "description": "Vistoria aprovada",
      "metadata": {
        "inspectionId": 2,
        "status": "APROVADA",
        "obs": "Unidade em perfeitas condições"
      }
    }
  ]
}
```

#### Respostas de Erro

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Cliente com ID 999 não encontrado",
  "error": "Not Found"
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

## Tipos de Eventos

A timeline pode conter os seguintes tipos de eventos:

| Tipo                    | Descrição                                    |
|-------------------------|----------------------------------------------|
| `CLIENT_CREATED`        | Cliente cadastrado no sistema                |
| `UNIT_RELEASED`         | Unidade liberada para vistoria               |
| `INSPECTION_SCHEDULED`  | Vistoria agendada                            |
| `INSPECTION_COMPLETED`  | Vistoria concluída (aprovada/recusada)       |
| `REJECTION_CREATED`     | Recusa registrada após vistoria              |
| `REJECTION_RESOLVED`    | Recusa resolvida, pronta para nova vistoria  |

## Exemplo de Uso

### cURL

```bash
curl -X GET "http://localhost:3000/timeline/1" \
  -H "Authorization: Bearer seu_token_aqui"
```

### JavaScript (fetch)

```javascript
const clientId = 1;
const token = 'seu_token_aqui';

fetch(`http://localhost:3000/timeline/${clientId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(response => response.json())
  .then(data => {
    console.log('Timeline:', data);
    data.events.forEach(event => {
      console.log(`[${event.date}] ${event.type}: ${event.description}`);
    });
  });
```

### Python (requests)

```python
import requests

client_id = 1
token = 'seu_token_aqui'

response = requests.get(
    f'http://localhost:3000/timeline/{client_id}',
    headers={'Authorization': f'Bearer {token}'}
)

timeline = response.json()
print(f"Timeline para {timeline['clientName']} - {timeline['unit']}")
for event in timeline['events']:
    print(f"[{event['date']}] {event['type']}: {event['description']}")
```

## Fluxo Típico

1. **Cliente criado** → `CLIENT_CREATED`
2. **Unidade liberada** → `UNIT_RELEASED`
3. **Vistoria agendada** → `INSPECTION_SCHEDULED`
4. **Vistoria realizada** → `INSPECTION_COMPLETED`
5. **Se recusada:**
   - `REJECTION_CREATED`
   - (correções realizadas)
   - `REJECTION_RESOLVED`
   - Nova `INSPECTION_SCHEDULED`
   - Nova `INSPECTION_COMPLETED`
6. **Se aprovada:** Processo finalizado

## Notas

- Os eventos são ordenados cronologicamente
- Um cliente pode ter múltiplas vistorias
- Cada vistoria pode ter múltiplas recusas
- O campo `metadata` contém informações adicionais específicas para cada tipo de evento
- Vistorias com status "AGUARDANDO" não geram evento de conclusão
