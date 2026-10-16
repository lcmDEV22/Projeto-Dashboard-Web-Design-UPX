# Dashboard de Consumo

Dashboard responsivo para acompanhar consumo de energia, leituras de sensores e estado de conexão de dispositivos. O projeto usa HTML, CSS e JavaScript sem framework ou processo de build.

## Requisitos

- Navegador moderno com suporte a JavaScript, `localStorage`, `sessionStorage` e Web Crypto.
- Um servidor HTTP estático local para executar o projeto. Não há dependências npm para instalar.
- Opcionalmente, uma API compatível com o contrato descrito em [API.md](API.md).

## Executar localmente

Abra um terminal na pasta do projeto e inicie um servidor estático. Com Python instalado:

```powershell
python -m http.server 8000
```

Acesse `http://localhost:8000/` no navegador. A página inicial é o login; selecione **Cadastre-se** para criar uma conta neste navegador e depois entre com o usuário ou e-mail e a senha cadastrados. A senha precisa ter pelo menos 8 caracteres.

Também é possível usar a extensão Live Server do VS Code: abra `index.html` e escolha **Open with Live Server**. Não é necessário executar uma etapa de build.

## Configurar a API

Por padrão, o dashboard usa dados demonstrativos. Para conectar uma API:

1. Abra `api-config.js`.
2. Defina `baseUrl` com a URL base do serviço e, se necessário, ajuste `dashboardPath`.
3. Faça o serviço retornar o JSON esperado para `GET /api/dashboard?year=AAAA&month=M`.

Exemplo de configuração:

```js
const API_CONFIG = {
    baseUrl: "http://localhost:3000",
    dashboardPath: "/api/dashboard",
    timeoutMs: 12000
};
```

A rota precisa fornecer os dados de resumo, séries de consumo e medições de tensão, corrente e potência. `currentState` e seus campos são opcionais. Para apresentar mais de um dispositivo no painel **Dispositivos**, envie `currentState.devices` como uma lista de objetos com `id`, `name` e `online`. Se a lista for omitida, o dashboard usa `esp32Connected` para exibir o controlador ESP32. Campos de conexão ausentes aparecem como não informados; não são inferidos pelas leituras dos sensores.

Consulte [API.md](API.md) para ver o JSON de exemplo, as regras de validação, as unidades, os campos opcionais e os detalhes do filtro de período. Se a API estiver em outra origem, ela deve permitir CORS para a origem do dashboard. As requisições incluem cookies (`credentials: include`), então o serviço também precisa aceitar credenciais quando usar autenticação por sessão.

## Recursos

- **Resumo atual:** luminosidade, presença, intensidade da iluminação, potência, energia acumulada e estados do controlador.
- **Consumo:** gráficos mensais, diários e acumulados; os gráficos diários podem exibir registros por horário quando disponíveis.
- **Iluminação e luminosidade:** gráficos dos sensores de intensidade da iluminação e luminosidade ambiente, por dia ou por horário.
- **Dispositivos:** lista os dispositivos reportados pela API e informa se estão online ou offline.
- **Histórico:** consulta registros locais, compara períodos de consumo e exporta os dados em uma planilha `.xlsx`.
- **Atualização periódica:** consulta a API ao abrir o dashboard, pelo botão **Atualizar** e a cada minuto enquanto a página estiver visível.

## Acesso e armazenamento

O cadastro, o login e a recuperação de senha são implementados no navegador, sem um servidor de autenticação. Os usuários e hashes de senha ficam no `localStorage`; as senhas são derivadas com PBKDF2 e salt individual. A sessão fica no `sessionStorage` da aba. A recuperação valida usuário e e-mail armazenados localmente e **não envia e-mail**.

O histórico do dashboard e as amostras de energia acumulada também ficam no armazenamento local do navegador. Esses dados não são sincronizados entre navegadores, dispositivos ou usuários. A energia acumulada começa a ser calculada quando chegam leituras válidas de potência e não reconstrói intervalos sem coleta.

Esses fluxos locais servem para demonstração e uso acadêmico, não para proteger contas ou dados em produção. Para uso real, implemente autenticação, autorização e armazenamento no servidor; não inclua segredos da API em arquivos JavaScript públicos.

## Arquivos do projeto

- `index.html`: tela de login e entrada do projeto.
- `cadastro.html`: criação de conta local.
- `recuperacao_senha.html`: redefinição local de senha.
- `dashboard.html`: navegação e painéis do dashboard.
- `auth.js`: cadastro, login, sessão e recuperação de senha no navegador.
- `script.js`: chamadas à API, estado dos painéis, gráficos, histórico e exportação.
- `api-config.js`: URL, rota e tempo limite da API.
- `style.css`: estilos compartilhados e layout responsivo.
- `API.md`: contrato completo da API e detalhes do comportamento dos dados.
- `imagens/`: imagens de fundo das telas de acesso.

## Como usar o dashboard

Depois de entrar, o dashboard abre no painel **Resumo atual**.
Use a navegação lateral para trocar entre os painéis.
Em telas estreitas, os botões de navegação passam para uma disposição compacta.

### Resumo atual

Este painel mostra informações instantâneas recebidas do serviço ou valores claramente marcados como demonstração.
Os indicadores incluem luminosidade ambiente em lux e presença detectada.
Também são apresentados o percentual de intensidade configurada para a iluminação e a potência instantânea em watts.
O estado do ESP32 e da iluminação é exibido separadamente das medições numéricas.
O horário de atualização ajuda a identificar quando os dados foram recebidos ou atualizados pelo dispositivo.

O card de energia acumulada integra leituras consecutivas de potência para estimar o total em kWh.
O cálculo usa a média entre a potência anterior e a atual durante o intervalo entre as medições.
Leituras repetidas ou mais antigas não são integradas novamente.
Intervalos maiores que cinco minutos são descartados para evitar estimar energia durante lacunas longas.
O total é preservado no navegador atual e não é recuperado de períodos anteriores sem coleta.

### Consumo

O painel **Consumo** apresenta gráficos mensal e diário das métricas disponíveis.
O seletor de grandeza permite alternar entre consumo, tensão, corrente e potência.
O gráfico diário pode mostrar os valores agrupados por dia ou as amostras registradas por horário.
No modo por horário, o seletor de data contém apenas dias com amostras horárias disponíveis.
No modo por dia, o seletor de mês aparece quando o intervalo atravessa mais de um mês.
Dias ou meses sem medições são exibidos como lacunas, em vez de receberem valores estimados.

O gráfico de energia acumulada possui um período próprio, independente do filtro geral.
É possível consultar as últimas 24 horas, 7, 30 ou 90 dias, ou todo o histórico armazenado.
Os pontos do gráfico representam amostras horárias do total acumulado.

### Iluminação e luminosidade

O painel reúne um gráfico da intensidade da iluminação e outro da luminosidade ambiente medida pelo sensor LDR.
Cada gráfico possui seu próprio seletor de visualização por horário ou por dia.
No modo horário, é necessário escolher uma data com amostras disponíveis.
No modo diário, várias leituras do mesmo dia são resumidas pela média.
A intensidade é representada em percentual, com escala de zero a cem por cento.
A escala do gráfico de luminosidade é ajustada de acordo com os valores em lux.

### Dispositivos

O painel **Dispositivos** exibe os nomes e estados enviados em `currentState.devices`.
Cada item da lista precisa informar um identificador, um nome e um booleano `online`.
O texto e a cor do estado distinguem dispositivos online e offline.
O estado deve vir da API; o dashboard não considera uma leitura recente de sensor como prova de conexão.
Se o serviço não enviar `devices`, o painel usa `esp32Connected` para mostrar o controlador ESP32.
Se ambos os campos não informarem o estado, ele é apresentado como não informado.
Uma lista `devices` vazia é mostrada como vazia, sem criar um dispositivo fictício.
Quando a URL da API está vazia, o controlador é exibido com um status identificado como demonstração.

### Histórico

O histórico guarda snapshots recebidos da API e registros demonstrativos no navegador atual.
É possível filtrar as linhas por grandeza e mês, além de comparar dois meses de consumo.
A tabela mostra até 50 registros mais recentes para os filtros selecionados.
A exportação inclui o histórico completo, independentemente do filtro aplicado à tabela.
O arquivo `.xlsx` contém uma aba geral e abas separadas para cada ano disponível.
Os filtros da tabela e da planilha servem para consulta e não alteram os registros armazenados.

## Dados da API

O dashboard faz uma requisição GET para cada mês necessário ao intervalo selecionado.
Os parâmetros `year` e `month` usam o ano com quatro dígitos e o número do mês de 1 a 12.
O mês final do intervalo é consultado para atualizar o estado mais recente.
Meses anteriores com histórico diário completo podem ser reutilizados localmente.

O objeto de resumo fornece custo total, consumo diário e consumo mensal.
As séries `monthlyConsumptionKwh` e os valores mensais de cada medição devem conter 12 números.
As séries diárias devem conter um número por dia do mês solicitado.
O número de dias é verificado considerando o calendário do mês e o ano consultado.
As medições obrigatórias são `voltage`, `current` e `power`, cada uma com séries `monthly` e `daily`.
Valores negativos, não numéricos ou séries com tamanho incorreto fazem a resposta ser rejeitada.

Os campos de `currentState` são opcionais para manter compatibilidade com APIs existentes.
Leituras omitidas aparecem como não informadas, em vez de serem convertidas em zero.
Os estados de conexão precisam ser booleanos quando fornecidos.
Para múltiplos dispositivos, use uma estrutura semelhante a esta:

```json
{
    "currentState": {
        "esp32Connected": true,
        "devices": [
            { "id": "esp32", "name": "Controlador ESP32", "online": true },
            { "id": "sensor-presenca", "name": "Sensor de presença", "online": false }
        ]
    }
}
```

Esse trecho mostra apenas o estado atual; a resposta real também deve conter os resumos e as séries obrigatórias.
O exemplo completo e as regras campo a campo estão em [API.md](API.md).

## Persistência e privacidade

O navegador separa os dados por origem e perfil.
Executar o site em `localhost` e depois em outro domínio pode apresentar armazenamentos diferentes.
Limpar os dados do site no navegador remove as contas locais, o histórico e o total de energia acumulada.
O modo privado pode apagar esses dados ao fechar a janela.
Não há sincronização automática entre navegadores ou computadores.

O cadastro gera salt e hash de senha com PBKDF2, mas a verificação continua inteiramente no cliente.
Isso não equivale a uma autenticação gerenciada por servidor.
Qualquer usuário com acesso ao navegador pode apagar o armazenamento ou alterar os arquivos do projeto.
O fluxo de recuperação não valida identidade por e-mail e não deve ser usado para contas reais.
Para uma implantação pública, mova autenticação, permissões e dados sensíveis para um backend.
Configure HTTPS e controles apropriados no servidor antes de disponibilizar o sistema fora de um ambiente de demonstração.

## Resolução de problemas

### A página não abre ou os scripts não funcionam

Confirme que o servidor está executando na pasta raiz do projeto.
Verifique o endereço e a porta exibidos pelo terminal após iniciar o servidor.
Não abra uma subpasta como se fosse a raiz; `index.html` e `dashboard.html` ficam na raiz.
Se a porta 8000 já estiver ocupada, inicie o servidor em outra porta, por exemplo 8001.

### O dashboard mostra dados demonstrativos

Confira se `baseUrl` em `api-config.js` não está vazio.
Verifique se o endereço base não contém espaços ou uma rota repetida.
Confirme se a rota configurada corresponde ao endereço implementado pelo serviço.
O status da API na página informa se o dashboard está em demonstração, carregando ou com erro.

### A chamada da API falha

Teste a rota diretamente e confirme que ela retorna JSON válido para os parâmetros de ano e mês.
Confira se todas as séries têm os tamanhos exigidos e se os campos numéricos não são negativos.
Em serviços hospedados em outra origem, configure CORS para permitir a origem do dashboard.
Se a API usar cookies, habilite o suporte a credenciais no CORS e configure os cookies conforme HTTPS e o domínio usados.
Consulte o console do navegador e o status exibido no dashboard para detalhes adicionais.

### Um dispositivo aparece como não informado

Verifique se a resposta inclui `currentState.devices` com um booleano `online` por dispositivo.
Para usar o modo de compatibilidade, envie `currentState.esp32Connected` como `true` ou `false`.
Ausência desses campos não é tratada como offline, pois não há informação suficiente para concluir o estado.

### Um gráfico não tem pontos por horário

O modo por horário depende de registros salvos com instante de leitura.
O contrato atual não reconstrói amostras horárias antigas a partir de totais diários.
Novas consultas bem-sucedidas passam a registrar as leituras atuais quando os campos correspondentes são enviados.
No modo demonstrativo, as amostras horárias estão disponíveis apenas para o mês atual.

## Manutenção do projeto

O projeto não tem etapa de compilação nem gerenciador de dependências.
As páginas carregam os arquivos JavaScript diretamente pelo HTML.
`auth.js` trata apenas os formulários e a sessão local.
`script.js` controla a consulta da API, os painéis, os gráficos, o histórico e a exportação.
`api-config.js` mantém os parâmetros de conexão separados da lógica de apresentação.
`style.css` contém os estilos das páginas de acesso e do dashboard.

Ao alterar o formato da resposta da API, atualize o código de validação e a documentação em `API.md`.
Ao adicionar campos de conexão, defina como representar estados ausentes antes de exibi-los como online ou offline.
Ao modificar os nomes dos elementos HTML, confira os seletores correspondentes em `script.js` e `auth.js`.
Como o projeto não possui suíte de testes automatizada, valide os fluxos principais no navegador após alterações.
Faça ao menos uma verificação em tela estreita e outra em tela ampla para conferir o layout responsivo.
