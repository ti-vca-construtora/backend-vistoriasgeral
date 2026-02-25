# Módulo Eligible (Aptos)

Módulo para listar clientes elegíveis/aptos para agendamento de vistoria.

## Endpoint

### GET /eligible

Lista clientes aptos para vistoria baseado no tipo especificado.

#### Query Parameters

- `type` (opcional): Tipo de elegibilidade
  - `new` - Clientes aptos para **primeira vistoria**
  - `again` - Clientes aptos para **reagendar** vistoria após recusa
  - **Sem valor** - Retorna **TODOS** (new + again)

#### Exemplos de Uso

```bash
# Todos os clientes aptos (new + again)
GET /eligible

# Apenas clientes aptos para primeira vistoria
GET /eligible?type=new

# Apenas clientes aptos para reagendar
GET /eligible?type=again
```

## Regras de Negócio

### Tipo "new" (Primeira Vistoria)
Retorna clientes que:
- Possuem status `LIBERADA` na tabela `tb_general`
- **NÃO** possuem nenhum registro na tabela `tb_inspections`

### Tipo "again" (Reagendamento)
Retorna clientes que:
- Possuem recusa com status `CONCLUÍDO` na tabela `tb_rejections`
- **NÃO** possuem vistoria agendada após a data da recusa

## Response Schema

```json
[
  {
    "id": 1,
    "name": "João Silva",
    "unit": "101",
    "seller": "Maria Santos",
    "identerprise": 1,
    "nameenterprise": "Residencial Alegria",
    "status": "LIBERADA",
    "type": "new",
    "idrejection": null,
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-01-20T14:30:00.000Z"
  }
]
```

### Campos

- `id`: ID do cliente
- `name`: Nome do cliente
- `unit`: Unidade
- `seller`: Vendedor
- `identerprise`: ID do empreendimento
- `nameenterprise`: Nome do empreendimento
- `status`: Status atual (`LIBERADA` para new, `CONCLUÍDO` para again)
- `type`: Tipo de elegibilidade (`new` ou `again`)
- `idrejection`: ID da recusa (apenas para type=again)
- `created_at`: Data de criação do registro
- `updated_at`: Data de última atualização
