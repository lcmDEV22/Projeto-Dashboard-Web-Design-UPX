# Integração da API

## Configuração

Em `api-config.js`, informe a URL base do serviço em `baseUrl`. O dashboard fará requisições `GET` para `/api/dashboard?year=AAAA&month=M`, usando mês de 1 a 12. Ao aplicar um intervalo, consulta os meses sem histórico diário local e sempre atualiza o mês final selecionado. O botão **Atualizar** repete essa consulta. O caminho pode ser alterado em `dashboardPath`.

Se a URL ficar vazia, a interface usa os dados demonstrativos que já existem no projeto e mostra esse estado na tela.

## Filtros dos gráficos

O filtro **Analisar período** atualiza os gráficos mensal e diário. O botão **Mês atual** redefine e aplica o intervalo do primeiro dia do mês atual até hoje. No gráfico diário, o seletor **Mês do intervalo** aparece quando o período aplicado abrange mais de um mês e lista somente os meses incluídos no intervalo. Para o primeiro e o último mês, o gráfico respeita os dias escolhidos no filtro; para os meses intermediários, exibe o mês inteiro. Dias sem medições permanecem como lacunas, sem valores estimados.

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
  "currentState": {
    "ambientLightLux": 320,
    "presenceDetected": false,
    "lightingIntensityPercent": 65,
    "powerWatts": 1140,
    "lightingOn": true,
    "esp32Connected": true,
    "lastUpdatedAt": "2026-10-03T15:40:00.000Z"
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

### Estado atual do sistema

O objeto `currentState` é opcional para manter compatibilidade com serviços existentes. Quando enviado, cada campo também pode ser omitido:

- `ambientLightLux`: luminosidade ambiente em lux (número não negativo).
- `presenceDetected`: presença detectada (booleano).
- `lightingIntensityPercent`: intensidade configurada da iluminação, de 0 a 100.
- `powerWatts`: potência elétrica instantânea em watts (número não negativo), exibida como consumo atual.
- `lightingOn`: estado ligado/desligado da iluminação (booleano).
- `esp32Connected`: conexão atual com o ESP32 (booleano).
- `lastUpdatedAt`: instante em que o dispositivo atualizou essas leituras, em formato de data reconhecido pelo JavaScript; se não vier, o dashboard mostra o horário em que recebeu a resposta.

Campos ausentes aparecem como “Não informado”, em vez de valores presumidos. Sem API configurada, a interface apresenta valores demonstrativos explicitamente identificados como demonstração.

O card **Energia acumulada** integra a potência de `powerWatts` pelo tempo entre leituras consecutivas e exibe o resultado em kWh. A aproximação usa a potência média dos extremos do intervalo; leituras repetidas ou atrasadas não são integradas e intervalos acima de cinco minutos são ignorados por segurança. A consulta automática ocorre a cada minuto enquanto a página está visível, além do botão **Atualizar**. O total e uma amostra por hora ficam salvos no navegador atual; a medição começa após a primeira leitura válida e não recupera períodos em que o dashboard não coletou dados. O gráfico acumulado tem um seletor independente para visualizar as últimas 24 horas, 7, 30 ou 90 dias, ou todo o histórico salvo.

## Filtro por período

O painel **Analisar período** oferece mês atual, últimos 7, 30 ou 90 dias e intervalo personalizado com datas inicial e final. Ao aplicar, o dashboard consulta a API para cada mês que ainda não tenha histórico diário completo no navegador e atualiza o mês final do intervalo. Os cards de resumo e os gráficos usam os registros salvos que correspondem ao período. O gráfico mensal inclui cada mês do calendário entre as datas, mesmo quando a API não tem uma medição guardada para algum mês; nesses casos, a lacuna não é preenchida com um valor inventado. O gráfico diário mostra todos os dias do mês selecionado, com valores das medições disponíveis e lacunas para dias sem dados. O gráfico diário também oferece a opção **Por horário**, com um seletor de data limitado às datas que tenham amostras com horário; ao selecioná-la, o gráfico mensal permanece sem alteração. Dados horários reais começam a ser guardados a cada consulta bem-sucedida para a data atual. O serviço não fornece uma série horária histórica separada, portanto datas antigas sem amostras não são reconstruídas. Sem API, os pontos por hora são dados demonstrativos claramente identificados. A luminosidade, presença, iluminação, potência instantânea e conexão do ESP32 permanecem como estado atual e não são alteradas pelo filtro.

O resumo informa quantos dias têm medições. O custo soma apenas meses completos dentro do intervalo; se não houver custo disponível para esses meses, mostra “—”. O gráfico mensal usa o total mensal registrado para cada mês que cruza o intervalo, enquanto o gráfico diário e os cards usam somente datas incluídas no intervalo. Como a API retorna dados diários de um mês por consulta, intervalos longos podem exigir uma consulta para cada mês ainda não guardado.

## Histórico no dashboard

Cada consulta bem-sucedida salva no armazenamento local do navegador as séries mensais do ano e as séries diárias do mês consultado, com a data do período, horário de captura, grandeza e origem (API ou demonstração). A intensidade percentual e a luminosidade ambiente de `currentState` também são guardadas com o instante da leitura sempre que uma consulta bem-sucedida as fornece. Leituras do mesmo sensor feitas em horários diferentes são preservadas; uma repetição do mesmo instante atualiza a amostra correspondente.

O painel **Iluminação e luminosidade** reúne os dois gráficos e oferece, em cada um, as opções **Por horário** e **Por dia**. No modo por horário, um seletor permite escolher a data e o eixo horizontal mostra o horário das amostras guardadas. No modo por dia, o gráfico mostra a média das amostras disponíveis em cada dia do intervalo. A intensidade usa escala de 0% a 100%; a escala de luminosidade em lux se ajusta aos valores registrados. O horário real começa a ser acumulado a cada consulta bem-sucedida que inclui os campos correspondentes; registros antigos sem horário continuam disponíveis no modo por dia. Sem API configurada, o mês atual usa amostras demonstrativas por hora.

A seção **Histórico** permite comparar o consumo mensal entre períodos guardados e consultar os 50 registros capturados mais recentemente. O histórico é local a este navegador e não substitui o armazenamento persistente do serviço; para compartilhar dados entre dispositivos ou usuários, a API deve manter seu próprio histórico.

O botão **Exportar planilha** baixa todos os registros locais em um arquivo Excel (`.xlsx`) com uma tabela geral na aba **Todos os dados** e uma tabela separada para cada ano disponível. Todas as abas incluem os campos ano, data do período, periodicidade, grandeza, valor, unidade, data e hora da coleta e origem, além de filtros nativos para pesquisar e ordenar os registros. As planilhas têm cabeçalho congelado, larguras padronizadas, formatação de datas e valores numéricos e proteção contra edição acidental, mantendo os filtros e a ordenação disponíveis. A proteção de planilha do Excel não é criptografia e não impede alterações feitas por usuários que saibam removê-la. A exportação inclui o histórico completo, independentemente dos filtros selecionados no dashboard, e recebe a data da exportação no nome do arquivo.

## Atualização e erros

Os dados são carregados ao abrir o dashboard, ao mudar mês/ano e pelo botão **Atualizar**. Respostas HTTP malsucedidas, JSON inválido ou séries com tamanho incorreto são exibidos no estado da página, sem trocar os últimos dados válidos.

Se a API estiver em outra origem, o servidor precisa liberar CORS para a origem do dashboard. A chamada inclui cookies (`credentials: include`) para APIs autenticadas por sessão. Não coloque chaves privadas ou segredos em arquivos JavaScript enviados ao navegador; para APIs privadas, use um backend/proxy.