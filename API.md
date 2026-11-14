# Integração da API ESP32

## Configuração

O dashboard consulta a lista pública de leituras definida em `api-config.js`:

```text
https://6acf5e9d03feaa52b21e6c92.mockapi.io/api/esp32/leituras
```

A consulta é feita ao abrir o dashboard, pelo botão **Atualizar** e a cada 60 segundos enquanto a página está visível. O dashboard usa o último item retornado pela lista como a leitura mais recente. Se a API falhar, a interface informa o erro e mantém os últimos dados válidos; ela não preenche a tela com valores de demonstração.

## Campos utilizados

| Campo da API | Exibição |
| --- | --- |
| `luminosidade` | Valor bruto do sensor, sem conversão para lux |
| `presenca` | Estado do sensor PIR |
| `intensidade` ou `led1`/`led2`/`led3` | Intensidade da iluminação em porcentagem |
| `luzAtiva` ou `luzativa` | Estado ligado/desligado da iluminação |
| `tensao`, `corrente`, `potencia` | Gráficos em V, A e W |
| `energiaKWh`/`energiakwh`, `energiaWh`/`energiawh` | Energia informada pela API, exibida no painel ao vivo e no histórico |

Quando a API fornece nomes repetidos com capitalização diferente, é usado o primeiro valor numérico diferente de zero; se todos forem zero, o zero é mantido. Campos ausentes não são estimados. A API atual não fornece custo nem séries diárias/mensais consolidadas; por isso, o custo aparece como indisponível e os gráficos históricos são formados somente pelas amostras coletadas pelo dashboard.

Como a resposta não informa se o ESP32 está conectado, o painel de dispositivos mostra a conexão como **Não informado**. O fato de a API responder não é usado para presumir o estado do dispositivo.

## Data e histórico

Como a resposta não contém data, cada leitura recebe automaticamente o instante em que o dashboard recebeu a resposta, no formato ISO (`YYYY-MM-DDTHH:mm:ss.sssZ`). Esse instante aparece em **Última atualização** e é salvo junto com cada amostra no histórico local do navegador.

O histórico não inventa datas para os itens antigos já existentes na API: somente o último item é coletado em cada consulta, e os gráficos passam a acumular amostras a partir daí. O armazenamento é local ao navegador e não substitui um histórico persistido no servidor.

Na primeira abertura após esta integração, os registros fictícios antigos do histórico e o total de energia acumulada do modo de demonstração são descartados. A partir daí, somente as novas coletas da API alimentam esses dados locais.

O card **Energia acumulada** integra a potência medida entre consultas consecutivas. Intervalos superiores a cinco minutos são ignorados para evitar estimar consumo durante períodos sem coleta. Esse total também é armazenado localmente.

## Observações

- Se a API estiver em outra origem, ela precisa permitir CORS para a origem do dashboard.
- Os valores de `luminosidade` são apresentados sem unidade porque a API não informa se o número está em lux ou em outra escala.
- Não coloque chaves privadas ou segredos em arquivos JavaScript enviados ao navegador.
