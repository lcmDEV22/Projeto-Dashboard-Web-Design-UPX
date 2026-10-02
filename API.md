# Integração da API

## Configuração

Em `api-config.js`, informe a URL base do serviço em `baseUrl`. O dashboard fará uma requisição `GET` para `/api/dashboard?year=AAAA&month=M`, usando mês de 1 a 12. O caminho pode ser alterado em `dashboardPath`.

Se a URL ficar vazia, a interface usa os dados demonstrativos que já existem no projeto e mostra esse estado na tela.

## Formato da resposta

A rota deve retornar JSON neste formato. As séries mensais devem conter 12 números; cada série diária deve conter um número para cada dia do mês solicitado, na ordem dos dias. As medidas elétricas usam volts (V), ampères (A) e watts (W).

```json
{
  "summary": {
    "totalCostBrl": 1240.5,
    "dailyConsumptionKwh": 32.4,
    "monthlyConsumptionKwh": 845.2,
    "dailyChangePercent": 2.1,
    "monthlyChangePercent": 5.7
  },
  "monthlyConsumptionKwh": [420, 510, 480, 620, 590, 710, 680, 790, 830, 910, 870, 980],
  "dailyConsumptionKwh": [32.4, 30.1, 34.8, 29.7, 35.2, 31.6, 33.1, 28.9, 30.5, 36.2, 34.1, 32.8, 31.9, 33.7, 29.8, 35.4, 30.6, 32.1, 34.3, 31.2, 33.9, 28.7, 30.8, 35.1, 32.6, 31.4, 34.7, 29.9, 33.2, 30.3, 32.5],
  "measurements": {
    "voltage": {
      "monthly": [220, 219, 221, 220, 218, 222, 220, 219, 221, 220, 218, 222],
      "daily": [220, 219, 221, 220, 218, 222, 220, 219, 221, 220, 218, 222, 220, 219, 221, 220, 218, 222, 220, 219, 221, 220, 218, 222, 220, 219, 221, 220, 218, 222, 220]
    },
    "current": {
      "monthly": [5.2, 5.1, 5.4, 5.0, 5.3, 5.5, 5.2, 5.1, 5.4, 5.0, 5.3, 5.5],
      "daily": [5.2, 5.1, 5.4, 5.0, 5.3, 5.5, 5.2, 5.1, 5.4, 5.0, 5.3, 5.5, 5.2, 5.1, 5.4, 5.0, 5.3, 5.5, 5.2, 5.1, 5.4, 5.0, 5.3, 5.5, 5.2, 5.1, 5.4, 5.0, 5.3, 5.5, 5.2]
    },
    "power": {
      "monthly": [1140, 1117, 1193, 1100, 1155, 1210, 1140, 1117, 1193, 1100, 1155, 1210],
      "daily": [1140, 1117, 1193, 1100, 1155, 1210, 1140, 1117, 1193, 1100, 1155, 1210, 1140, 1117, 1193, 1100, 1155, 1210, 1140, 1117, 1193, 1100, 1155, 1210, 1140, 1117, 1193, 1100, 1155, 1210, 1140]
    }
  },
  "availableYears": [2024, 2025, 2026]
}
```

`dailyChangePercent`, `monthlyChangePercent` e `availableYears` são opcionais. Se as variações não forem enviadas, os cards mostram `0%`. O objeto `measurements` com tensão, corrente e potência é obrigatório para habilitar todas as opções reais dos gráficos.

## Atualização e erros

Os dados são carregados ao abrir o dashboard, ao mudar mês/ano e pelo botão **Atualizar**. Respostas HTTP malsucedidas, JSON inválido ou séries com tamanho incorreto são exibidos no estado da página, sem trocar os últimos dados válidos.

Se a API estiver em outra origem, o servidor precisa liberar CORS para a origem do dashboard. A chamada inclui cookies (`credentials: include`) para APIs autenticadas por sessão. Não coloque chaves privadas ou segredos em arquivos JavaScript enviados ao navegador; para APIs privadas, use um backend/proxy.

O CSV exporta a série mensal do ano carregado e a série diária do mês/ano selecionado.