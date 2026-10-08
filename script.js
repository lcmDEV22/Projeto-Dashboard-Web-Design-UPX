const canvases = [
    document.getElementById("meuGrafico"),
    document.getElementById("meuGrafico2"),
    document.getElementById("meuGraficoIntensidade"),
    document.getElementById("meuGraficoLuminosidade")
].filter(Boolean);
const dadosGraficos = new Map();
const seletoresSensoresLuz = [
    { chave: "intensidade", modoId: "modoGraficoIntensidade", dataId: "dataGraficoIntensidade", controleDataId: "controleDataIntensidade", canvasId: "meuGraficoIntensidade" },
    { chave: "luminosidade", modoId: "modoGraficoLuminosidade", dataId: "dataGraficoLuminosidade", controleDataId: "controleDataLuminosidade", canvasId: "meuGraficoLuminosidade" }
];
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dadosDemoMensais = [4200, 5100, 4800, 6200, 5900, 7100, 6800, 7900, 8300, 9100, 8700, 9800];
const dadosDemoDiarios = [
    320, 350, 295, 410, 375, 430, 390, 460, 425, 510,
    480, 445, 530, 495, 560, 520, 475, 590, 545, 610,
    575, 630, 590, 660, 620, 690, 645, 710, 675, 735, 700
];
const CHAVE_HISTORICO = "dashboardHistoricalReadings";
const CHAVE_VERSAO_DEMO = "dashboardDemoHistoryVersion";
const CHAVE_ENERGIA_ACUMULADA = "dashboardAccumulatedEnergy";
const VERSAO_DEMO_HISTORICO = "6";
const LIMITE_REGISTROS_HISTORICO = 200000;
const LIMITE_AMOSTRAS_ENERGIA = 10000;
const INTERVALO_MAXIMO_INTEGRACAO_MS = 5 * 60 * 1000;
const ANO_INICIAL_DADOS_FICTICIOS = 2020;
let registrosHistorico = [];
let avisoHistorico = "";
let intervaloPeriodoAplicado = null;
let energiaAcumulada = {
    totalKwh: 0,
    ultimaLeitura: null,
    amostras: [],
    disponivel: true
};

function gerarDadosFicticiosHistorico() {
    const hoje = new Date();
    const ultimoAno = hoje.getFullYear();
    const hojeFormatado = formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const registros = [];
    const capturadoEm = new Date().toISOString();

    for (let ano = ANO_INICIAL_DADOS_FICTICIOS; ano <= ultimoAno; ano++) {
        for (let mes = 0; mes < 12; mes++) {
            if (formatarDataHistorico(ano, mes, 1) > hojeFormatado) {
                continue;
            }
            const ultimoDiaMes = new Date(ano, mes + 1, 0);
            const diasNoMes = ultimoDiaMes.getDate();
            const consumoMensal = [];
            const tensaoMensal = [];
            const correnteMensal = [];
            const potenciaMensal = [];

            for (let dia = 1; dia <= diasNoMes; dia++) {
                const data = formatarDataHistorico(ano, mes, dia);
                if (data > hojeFormatado) {
                    continue;
                }

                const picoSemanal = Math.sin((dia + mes + 1) * 0.82) * 0.55;
                const variacaoAnual = (ano - ANO_INICIAL_DADOS_FICTICIOS) * 0.18;
                const consumoDiario = Number((150 + (mes * 7.5) + picoSemanal * 65 + variacaoAnual * 18 + (dia % 7) * 8).toFixed(2));
                const tensaoDiaria = Number((220 + Math.sin((dia + 1) * 0.9 + mes) * 9 + (mes % 3) * 1.8).toFixed(2));
                const correnteDiaria = Number((4.9 + Math.cos((dia + mes) * 0.9) * 1.2 + (ano % 5) * 0.08).toFixed(2));
                const potenciaDiaria = Number((980 + Math.sin((dia + 2) * 0.75) * 210 + (mes * 18)).toFixed(2));

                consumoMensal.push(consumoDiario);
                tensaoMensal.push(tensaoDiaria);
                correnteMensal.push(correnteDiaria);
                potenciaMensal.push(potenciaDiaria);

                registros.push(
                    { tipo: "diario", data, grandeza: "Consumo", chaveGrandeza: "consumo", valor: consumoDiario, unidade: "kWh", capturadoEm, origem: "Demonstração" },
                    { tipo: "diario", data, grandeza: "Tensão", chaveGrandeza: "tensao", valor: tensaoDiaria, unidade: "V", capturadoEm, origem: "Demonstração" },
                    { tipo: "diario", data, grandeza: "Corrente", chaveGrandeza: "corrente", valor: correnteDiaria, unidade: "A", capturadoEm, origem: "Demonstração" },
                    { tipo: "diario", data, grandeza: "Potência", chaveGrandeza: "potencia", valor: potenciaDiaria, unidade: "W", capturadoEm, origem: "Demonstração" },
                    // Os exemplos mantêm históricos demonstrativos separados para os dois sensores de luz.
                    { tipo: "diario", data, grandeza: "Intensidade da iluminação", chaveGrandeza: "intensidade", valor: Number((50 + Math.sin((dia + mes * 2) * 0.72) * 32).toFixed(1)), unidade: "%", capturadoEm, origem: "Demonstração" },
                    { tipo: "diario", data, grandeza: "Luminosidade ambiente (LDR)", chaveGrandeza: "luminosidade", valor: Number((320 + Math.sin((dia + mes) * 0.68) * 210 + Math.cos(dia * 0.31) * 95).toFixed(1)), unidade: "lux", capturadoEm, origem: "Demonstração" }
                );

                // Cria amostras horárias somente para o mês atual, sem aumentar o histórico antigo.
                if (ano === hoje.getFullYear() && mes === hoje.getMonth()) {
                    // Os dados demonstrativos mostram uma curva acumulada; não alteram o total diário já salvo.
                    for (let hora = 0; hora < 24; hora++) {
                        if (data === hojeFormatado && hora > hoje.getHours()) {
                            break;
                        }
                        const instanteLeitura = new Date(ano, mes, dia, hora).toISOString();
                        const variacaoHora = Math.sin((hora / 24) * Math.PI * 2);
                        [
                            ["consumo", "Consumo", consumoDiario * ((hora + 1) / 24), "kWh"],
                            ["tensao", "Tensão", tensaoDiaria + variacaoHora * 2, "V"],
                            ["corrente", "Corrente", correnteDiaria + variacaoHora * 0.2, "A"],
                            ["potencia", "Potência", potenciaDiaria + variacaoHora * 60, "W"]
                        ].forEach(([chaveGrandeza, grandeza, valor, unidade]) => {
                            registros.push({
                                tipo: "diario",
                                data,
                                grandeza,
                                chaveGrandeza,
                                valor: Number(valor.toFixed(2)),
                                unidade,
                                capturadoEm,
                                instanteLeitura,
                                origem: "Demonstração"
                            });
                        });
                    }

                    const intensidadeBase = 50 + Math.sin((dia + mes * 2) * 0.72) * 32;
                    const luminosidadeBase = 320 + Math.sin((dia + mes) * 0.68) * 210 + Math.cos(dia * 0.31) * 95;
                    for (let hora = 0; hora < 24; hora++) {
                        if (data === hojeFormatado && hora > hoje.getHours()) {
                            break;
                        }
                        const instanteLeitura = new Date(ano, mes, dia, hora).toISOString();
                        const curvaDoDia = Math.sin((hora / 24) * Math.PI * 2);
                        registros.push(
                            {
                                tipo: "diario",
                                data,
                                grandeza: "Intensidade da iluminação",
                                chaveGrandeza: "intensidade",
                                valor: Number((intensidadeBase + curvaDoDia * 12).toFixed(1)),
                                unidade: "%",
                                capturadoEm,
                                instanteLeitura,
                                origem: "Demonstração"
                            },
                            {
                                tipo: "diario",
                                data,
                                grandeza: "Luminosidade ambiente (LDR)",
                                chaveGrandeza: "luminosidade",
                                valor: Number((luminosidadeBase + curvaDoDia * Math.min(150, luminosidadeBase * 0.5)).toFixed(1)),
                                unidade: "lux",
                                capturadoEm,
                                instanteLeitura,
                                origem: "Demonstração"
                            }
                        );
                    }
                }
            }

            const totalConsumoMensal = consumoMensal.reduce((total, valor) => total + valor, 0);
            const mediaTensaoMensal = tensaoMensal.reduce((total, valor) => total + valor, 0) / Math.max(tensaoMensal.length, 1);
            const mediaCorrenteMensal = correnteMensal.reduce((total, valor) => total + valor, 0) / Math.max(correnteMensal.length, 1);
            const mediaPotenciaMensal = potenciaMensal.reduce((total, valor) => total + valor, 0) / Math.max(potenciaMensal.length, 1);
            const custoMensal = Number((totalConsumoMensal * (0.82 + (mes % 5) * 0.07 + (ano - ANO_INICIAL_DADOS_FICTICIOS) * 0.03)).toFixed(2));

            registros.push(
                { tipo: "mensal", data: formatarDataHistorico(ano, mes, 1), grandeza: "Consumo", chaveGrandeza: "consumo", valor: Number(totalConsumoMensal.toFixed(2)), unidade: "kWh", capturadoEm, origem: "Demonstração" },
                { tipo: "mensal", data: formatarDataHistorico(ano, mes, 1), grandeza: "Tensão", chaveGrandeza: "tensao", valor: Number(mediaTensaoMensal.toFixed(2)), unidade: "V", capturadoEm, origem: "Demonstração" },
                { tipo: "mensal", data: formatarDataHistorico(ano, mes, 1), grandeza: "Corrente", chaveGrandeza: "corrente", valor: Number(mediaCorrenteMensal.toFixed(2)), unidade: "A", capturadoEm, origem: "Demonstração" },
                { tipo: "mensal", data: formatarDataHistorico(ano, mes, 1), grandeza: "Potência", chaveGrandeza: "potencia", valor: Number(mediaPotenciaMensal.toFixed(2)), unidade: "W", capturadoEm, origem: "Demonstração" },
                { tipo: "resumo", data: formatarDataHistorico(ano, mes, 1), grandeza: "Custo total", chaveGrandeza: "custo", valor: custoMensal, unidade: "BRL", capturadoEm, origem: "Demonstração" }
            );
        }
    }

    return registros
        .sort((primeiro, segundo) => primeiro.data.localeCompare(segundo.data))
        .slice(0, LIMITE_REGISTROS_HISTORICO);
}

function atualizarSeriesDemoComHistorico() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const diasNoMesAtual = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const registrosMensais = registrosHistorico.filter((registro) => registro.tipo === "mensal");
    const registrosDiarios = registrosHistorico.filter((registro) => registro.tipo === "diario" && registro.data.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}-`));
    const mensaisPorPeriodo = new Map();
    const diariosPorData = new Map();
    registrosMensais.forEach((registro) => {
        const chave = `${registro.chaveGrandeza}|${registro.data.slice(0, 7)}`;
        const atual = mensaisPorPeriodo.get(chave);
        if (!atual || registro.capturadoEm > atual.capturadoEm) {
            mensaisPorPeriodo.set(chave, registro);
        }
    });
    registrosDiarios.forEach((registro) => {
        const chave = `${registro.chaveGrandeza}|${registro.data}`;
        const atual = diariosPorData.get(chave);
        if (!atual || registro.capturadoEm > atual.capturadoEm) {
            diariosPorData.set(chave, registro);
        }
    });

    const montarSerie = (chaveGrandeza, nome, unidade) => {
        const mensais = [];
        const diarias = [];
        const mesesUltimos12 = [];

        for (let indice = 11; indice >= 0; indice--) {
            const dataMes = new Date(anoAtual, mesAtual - indice, 1);
            mesesUltimos12.push(`${dataMes.getFullYear()}-${String(dataMes.getMonth() + 1).padStart(2, "0")}`);
        }

        mesesUltimos12.forEach((periodo) => {
            const registro = mensaisPorPeriodo.get(`${chaveGrandeza}|${periodo}`);
            mensais.push(registro ? Number(registro.valor) : null);
        });

        for (let dia = 1; dia <= diasNoMesAtual; dia++) {
            const data = formatarDataHistorico(anoAtual, mesAtual, dia);
            const registro = diariosPorData.get(`${chaveGrandeza}|${data}`);
            diarias.push(registro ? Number(registro.valor) : null);
        }

        return { nome, unidade, mensal: mensais, diario: diarias };
    };

    const dadosDiaAtual = registrosHistorico.filter((registro) => registro.tipo === "diario" && registro.data === formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    const ultimoCusto = registrosHistorico
        .filter((registro) => registro.tipo === "resumo" && registro.chaveGrandeza === "custo")
        .sort((primeiro, segundo) =>
            segundo.data.localeCompare(primeiro.data) ||
            segundo.capturadoEm.localeCompare(primeiro.capturadoEm)
        )[0];

    Object.assign(seriesGrandezas, {
        consumo: montarSerie("consumo", "Consumo", "kWh"),
        tensao: montarSerie("tensao", "Tensão", "V"),
        corrente: montarSerie("corrente", "Corrente", "A"),
        potencia: montarSerie("potencia", "Potência", "W")
    });

    dadosConsumoMensal = seriesGrandezas.consumo.mensal;
    dadosConsumoDiario = seriesGrandezas.consumo.diario;
    const consumoHoje = dadosDiaAtual.find((registro) => registro.chaveGrandeza === "consumo")?.valor ?? 0;
    resumoConsumo = {
        totalCostBrl: ultimoCusto ? Number(ultimoCusto.valor) : 0,
        dailyConsumptionKwh: consumoHoje,
        monthlyConsumptionKwh: seriesGrandezas.consumo.mensal.at(-1) ?? 0,
        dailyChangePercent: 0,
        monthlyChangePercent: 0
    };
}

// Gera valores de demonstração plausíveis para cada grandeza enquanto a API não está conectada.
function criarSerieDemo(tamanho, media, amplitude, fase = 0) {
    return Array.from({ length: tamanho }, (_, indice) =>
        Number((media + Math.sin((indice + fase) * 1.7) * amplitude).toFixed(1))
    );
}

const seriesGrandezas = {
    consumo: { nome: "Consumo", unidade: "kWh", mensal: dadosDemoMensais, diario: dadosDemoDiarios },
    tensao: { nome: "Tensão", unidade: "V", mensal: criarSerieDemo(12, 220, 3), diario: criarSerieDemo(31, 220, 4) },
    corrente: { nome: "Corrente", unidade: "A", mensal: criarSerieDemo(12, 5.2, 0.7), diario: criarSerieDemo(31, 5.2, 1.1, 1) },
    potencia: { nome: "Potência", unidade: "W", mensal: criarSerieDemo(12, 1140, 180), diario: criarSerieDemo(31, 1140, 240, 2) }
};
let grandezaSelecionada = "consumo";
let dadosConsumoMensal = [...dadosDemoMensais];
let dadosConsumoDiario = [...dadosDemoDiarios];
let resumoConsumo = {
    totalCostBrl: 1240.5,
    dailyConsumptionKwh: dadosDemoDiarios[0],
    monthlyConsumptionKwh: dadosDemoMensais[new Date().getMonth()],
    dailyChangePercent: 0,
    monthlyChangePercent: 0
};
let estadoAtual = {
    luminosidadeLux: null,
    presencaDetectada: null,
    intensidadePercentual: null,
    potenciaWatts: null,
    iluminacaoLigada: null,
    esp32Conectado: null,
    atualizadoEm: null,
    origemHorario: ""
};
let requisicaoAtual = null;
let dadosReaisCarregados = false;
let periodoDadosCarregados = null;

// Sincroniza o texto do período visível em cada gráfico com a quantidade de pontos.
function atualizarStatusGrafico(canvasId, quantidadePontos, totalPeriodos = quantidadePontos) {
    if (!intervaloPeriodoAplicado) {
        return;
    }

    if (canvasId === "meuGraficoIntensidade") {
        const status = document.getElementById("periodoGraficoIntensidade");
        const periodo = `${intervaloPeriodoAplicado.inicio.split("-").reverse().join("/")} a ${intervaloPeriodoAplicado.fim.split("-").reverse().join("/")}`;
        const modo = document.getElementById("modoGraficoIntensidade").value;
        const leituras = quantidadePontos === 1 ? "1 leitura" : `${quantidadePontos} leituras`;
        const dataSelecionada = document.getElementById("dataGraficoIntensidade").value;
        const descricao = modo === "horas"
            ? `ao longo do dia ${dataSelecionada ? dataSelecionada.split("-").reverse().join("/") : "sem dia selecionado"}`
            : "por dia no intervalo";
        status.textContent = `${periodo} · ${leituras} ${descricao}.`;
        return;
    }

    if (canvasId === "meuGraficoLuminosidade") {
        const status = document.getElementById("periodoGraficoLuminosidade");
        const periodo = `${intervaloPeriodoAplicado.inicio.split("-").reverse().join("/")} a ${intervaloPeriodoAplicado.fim.split("-").reverse().join("/")}`;
        const modo = document.getElementById("modoGraficoLuminosidade").value;
        const leituras = quantidadePontos === 1 ? "1 leitura" : `${quantidadePontos} leituras`;
        const dataSelecionada = document.getElementById("dataGraficoLuminosidade").value;
        const descricao = modo === "horas"
            ? `ao longo do dia ${dataSelecionada ? dataSelecionada.split("-").reverse().join("/") : "sem dia selecionado"}`
            : "por dia no intervalo";
        status.textContent = `${periodo} · ${leituras} ${descricao}.`;
        return;
    }

    if (canvasId === "meuGrafico2" && document.getElementById("modoGraficoDiario").value === "horas") {
        const dataSelecionada = document.getElementById("dataGraficoDiario").value;
        const dia = dataSelecionada ? dataSelecionada.split("-").reverse().join("/") : "sem dia com amostras";
        const amostras = quantidadePontos === 1 ? "1 amostra horária" : `${quantidadePontos} amostras horárias`;
        document.getElementById("periodoGraficoDiario").textContent = `${dia} · ${amostras}.`;
        return;
    }

    const idStatus = canvasId === "meuGrafico2" ? "periodoGraficoDiario" : "periodoGraficoMensal";
    const status = document.getElementById(idStatus);
    const eDiario = canvasId === "meuGrafico2";
    const unidade = eDiario ? "dias" : "meses";
    const contagem = quantidadePontos === 1
        ? `1 ${eDiario ? "dia" : "mês"} com dados`
        : `${quantidadePontos} ${eDiario ? "dias" : "meses"} com dados`;
    const cobertura = quantidadePontos === totalPeriodos
        ? contagem
        : `${contagem} de ${totalPeriodos} ${unidade} no intervalo`;
    status.textContent = `${intervaloPeriodoAplicado.inicio.split("-").reverse().join("/")} a ${intervaloPeriodoAplicado.fim.split("-").reverse().join("/")} · ${cobertura}.`;
}

// Obtém os limites de dias válidos do mês escolhido, respeitando as datas globais.
function obterLimitesMesDiario() {
    const seletor = document.getElementById("mesGraficoDiario");
    const periodoSelecionado = seletor?.value;
    if (!periodoSelecionado || !intervaloPeriodoAplicado) {
        return null;
    }

    const [ano, mes] = periodoSelecionado.split("-").map(Number);
    const primeiroDiaMes = formatarDataHistorico(ano, mes - 1, 1);
    const ultimoDiaMes = formatarDataHistorico(ano, mes - 1, new Date(ano, mes, 0).getDate());
    const inicio = primeiroDiaMes < intervaloPeriodoAplicado.inicio
        ? intervaloPeriodoAplicado.inicio
        : primeiroDiaMes;
    const fim = ultimoDiaMes > intervaloPeriodoAplicado.fim
        ? intervaloPeriodoAplicado.fim
        : ultimoDiaMes;

    return { ano, mes, inicio, fim };
}

// Lista todos os meses do filtro global e conserva a escolha se ainda estiver no intervalo.
function atualizarMesesGraficoDiario() {
    const seletor = document.getElementById("mesGraficoDiario");
    if (!seletor || !intervaloPeriodoAplicado) {
        return;
    }

    const valorAnterior = seletor.value;
    const inicio = new Date(`${intervaloPeriodoAplicado.inicio}T00:00:00`);
    const fim = new Date(`${intervaloPeriodoAplicado.fim}T00:00:00`);
    const primeiroMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const ultimoMes = new Date(fim.getFullYear(), fim.getMonth(), 1);
    const meses = [];

    for (const cursor = new Date(primeiroMes); cursor <= ultimoMes; cursor.setMonth(cursor.getMonth() + 1)) {
        const periodo = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        meses.push({
            periodo,
            rotulo: cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        });
    }

    seletor.replaceChildren();
    meses.forEach(({ periodo, rotulo }) => {
        const opcao = document.createElement("option");
        opcao.value = periodo;
        opcao.textContent = rotulo;
        seletor.appendChild(opcao);
    });

    seletor.value = meses.some(({ periodo }) => periodo === valorAnterior)
        ? valorAnterior
        : meses[0]?.periodo || "";

    // A escolha mensal só se aplica à série por dia e some quando há apenas um mês.
    document.getElementById("controleMesGraficoDiario").hidden =
        document.getElementById("modoGraficoDiario").value === "horas" || meses.length <= 1;
    atualizarDiasGraficoDiario();
}

// Preenche as datas que realmente possuem amostras de consumo com horário.
function atualizarDiasGraficoDiario() {
    const seletor = document.getElementById("dataGraficoDiario");
    const modo = document.getElementById("modoGraficoDiario").value;
    const valorAnterior = seletor.value;
    const datas = [...new Set(
        registrosHistorico
            .filter((registro) =>
                registro.tipo === "diario" &&
                registro.chaveGrandeza === grandezaSelecionada &&
                registro.instanteLeitura &&
                registro.data >= intervaloPeriodoAplicado.inicio &&
                registro.data <= intervaloPeriodoAplicado.fim
            )
            .map((registro) => registro.data)
    )].sort();

    seletor.replaceChildren();
    datas.forEach((data) => {
        const opcao = document.createElement("option");
        opcao.value = data;
        opcao.textContent = new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        seletor.appendChild(opcao);
    });

    if (datas.includes(valorAnterior)) {
        seletor.value = valorAnterior;
    } else if (datas.length) {
        seletor.value = datas[datas.length - 1];
    }

    document.getElementById("controleDataGraficoDiario").hidden = modo !== "horas";
    seletor.disabled = datas.length === 0;
    document.getElementById("controleMesGraficoDiario").hidden =
        modo === "horas" || document.getElementById("mesGraficoDiario").options.length <= 1;
}

// Expande as medições existentes para cada dia do mês limitado pelo período global.
function obterSerieDiariaMensal(chaveGrandeza) {
    const limites = obterLimitesMesDiario();
    if (!limites) {
        return [];
    }

    const leituras = new Map(
        obterRegistrosDiariosFiltrados(chaveGrandeza, {
            inicio: limites.inicio,
            fim: limites.fim
        }).map((registro) => [registro.data, registro])
    );
    const serie = [];
    const cursor = new Date(`${limites.inicio}T00:00:00`);
    const fim = new Date(`${limites.fim}T00:00:00`);

    for (; cursor <= fim; cursor.setDate(cursor.getDate() + 1)) {
        const data = formatarDataHistorico(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        const leitura = leituras.get(data);
        serie.push({
            data,
            valor: leitura ? leitura.valor : null
        });
    }

    return serie;
}

// Retorna os registros de consumo acumulado capturados ao longo de uma data específica.
function obterSerieConsumoPorHora(data) {
    if (!data) {
        return [];
    }

    return registrosHistorico
        .filter((registro) =>
            registro.tipo === "diario" &&
            registro.chaveGrandeza === grandezaSelecionada &&
            registro.data === data &&
            registro.data >= intervaloPeriodoAplicado.inicio &&
            registro.data <= intervaloPeriodoAplicado.fim &&
            registro.instanteLeitura
        )
        .map((registro) => ({
            data: registro.data,
            periodo: registro.instanteLeitura,
            valor: registro.valor
        }))
        .sort((primeiro, segundo) => primeiro.periodo.localeCompare(segundo.periodo));
}

// Carrega o total e as amostras para preservar o acompanhamento entre sessões no mesmo navegador.
function carregarEnergiaAcumulada() {
    const status = document.getElementById("statusEnergiaAcumulada");
    try {
        const salvo = localStorage.getItem(CHAVE_ENERGIA_ACUMULADA);
        if (salvo) {
            const dados = JSON.parse(salvo);
            const leituraValida = (leitura) =>
                leitura === null ||
                (leitura &&
                    Number.isFinite(leitura.potenciaWatts) &&
                    leitura.potenciaWatts >= 0 &&
                    typeof leitura.instante === "string" &&
                    Number.isFinite(Date.parse(leitura.instante)));
            if (
                !dados ||
                !Number.isFinite(dados.totalKwh) ||
                dados.totalKwh < 0 ||
                !leituraValida(dados.ultimaLeitura) ||
                !Array.isArray(dados.amostras) ||
                !dados.amostras.every((amostra) =>
                    amostra &&
                    Number.isFinite(amostra.kwh) &&
                    amostra.kwh >= 0 &&
                    typeof amostra.instante === "string" &&
                    Number.isFinite(Date.parse(amostra.instante))
                )
            ) {
                throw new Error("Os dados de energia acumulada salvos estão inválidos.");
            }
            energiaAcumulada = {
                totalKwh: dados.totalKwh,
                ultimaLeitura: dados.ultimaLeitura,
                amostras: dados.amostras.slice(-LIMITE_AMOSTRAS_ENERGIA),
                disponivel: true
            };
            status.textContent = energiaAcumulada.ultimaLeitura
                ? "Total preservado neste navegador"
                : "Aguardando leituras de potência";
        }
    } catch (erro) {
        energiaAcumulada.disponivel = false;
        status.textContent = `Não foi possível ler o histórico de energia: ${erro.message}`;
    }
    atualizarIndicadorEnergiaAcumulada();
    desenharGraficoEnergiaAcumulada();
}

// Calcula kWh pela potência média entre leituras válidas, ignorando lacunas longas sem dados.
function registrarLeituraEnergia(estado) {
    if (!energiaAcumulada.disponivel || estado.potenciaWatts === null) {
        return;
    }

    const instante = estado.atualizadoEm || new Date().toISOString();
    const instanteMs = Date.parse(instante);
    const anterior = energiaAcumulada.ultimaLeitura;
    if (!Number.isFinite(instanteMs)) {
        return;
    }
    if (anterior && instanteMs <= Date.parse(anterior.instante)) {
        return;
    }
    let intervaloIgnorado = false;
    if (anterior) {
        const duracaoMs = instanteMs - Date.parse(anterior.instante);
        if (duracaoMs > 0 && duracaoMs <= INTERVALO_MAXIMO_INTEGRACAO_MS) {
            const potenciaMediaWatts = (anterior.potenciaWatts + estado.potenciaWatts) / 2;
            energiaAcumulada.totalKwh += potenciaMediaWatts * (duracaoMs / 3600000) / 1000;
        } else if (duracaoMs > INTERVALO_MAXIMO_INTEGRACAO_MS) {
            intervaloIgnorado = true;
        }
    }

    energiaAcumulada.ultimaLeitura = {
        instante: new Date(instanteMs).toISOString(),
        potenciaWatts: estado.potenciaWatts
    };

    // Mantém uma amostra por hora para que o gráfico histórico permaneça leve.
    const chaveHora = energiaAcumulada.ultimaLeitura.instante.slice(0, 13);
    const ultimaAmostra = energiaAcumulada.amostras.at(-1);
    const amostra = {
        instante: energiaAcumulada.ultimaLeitura.instante,
        kwh: energiaAcumulada.totalKwh,
        lacuna: intervaloIgnorado || Boolean(ultimaAmostra && ultimaAmostra.lacuna)
    };
    if (ultimaAmostra && ultimaAmostra.instante.slice(0, 13) === chaveHora) {
        energiaAcumulada.amostras[energiaAcumulada.amostras.length - 1] = amostra;
    } else {
        energiaAcumulada.amostras.push(amostra);
        energiaAcumulada.amostras = energiaAcumulada.amostras.slice(-LIMITE_AMOSTRAS_ENERGIA);
    }

    try {
        localStorage.setItem(CHAVE_ENERGIA_ACUMULADA, JSON.stringify(energiaAcumulada));
        document.getElementById("statusEnergiaAcumulada").textContent = intervaloIgnorado
            ? "Lacuna acima de 5 min ignorada · salvo neste navegador"
            : "Integrado pela potência medida · salvo neste navegador";
    } catch (erro) {
        document.getElementById("statusEnergiaAcumulada").textContent =
            `Acúmulo em memória; falha ao salvar no navegador: ${erro.message}`;
    }
    atualizarIndicadorEnergiaAcumulada();
    desenharGraficoEnergiaAcumulada();
}

// Atualiza o card com precisão suficiente para tornar visíveis pequenos incrementos de energia.
function atualizarIndicadorEnergiaAcumulada() {
    const valor = document.getElementById("valorEnergiaAcumulada");
    if (valor) {
        valor.textContent = `${energiaAcumulada.totalKwh.toLocaleString("pt-BR", {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        })} kWh`;
    }
}

// Desenha a série acumulada no intervalo aplicado, ajustando a escala ao tamanho responsivo do canvas.
function desenharGraficoEnergiaAcumulada() {
    const canvas = document.getElementById("graficoEnergiaAcumulada");
    if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        return;
    }

    const contexto = canvas.getContext("2d");
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    const proporcao = window.devicePixelRatio || 1;
    canvas.width = largura * proporcao;
    canvas.height = altura * proporcao;
    contexto.scale(proporcao, proporcao);
    contexto.clearRect(0, 0, largura, altura);

    const leituras = energiaAcumulada.amostras.filter((amostra) => {
        const data = amostra.instante.slice(0, 10);
        return !intervaloPeriodoAplicado ||
            (data >= intervaloPeriodoAplicado.inicio && data <= intervaloPeriodoAplicado.fim);
    });
    const descricao = document.getElementById("descricaoGraficoEnergia");
    if (!leituras.length) {
        descricao.textContent = energiaAcumulada.ultimaLeitura
            ? "Não há amostras de energia acumulada no intervalo selecionado."
            : "O gráfico será preenchido após novas leituras de potência.";
        contexto.fillStyle = "#68776d";
        contexto.font = "14px Poppins, sans-serif";
        contexto.textAlign = "center";
        contexto.fillText("Sem amostras no período.", largura / 2, altura / 2);
        return;
    }

    descricao.textContent = `${leituras.length.toLocaleString("pt-BR")} amostras horárias · total acumulado em kWh`;
    const margem = { topo: 16, direita: 18, base: 38, esquerda: 74 };
    const larguraGrafico = largura - margem.esquerda - margem.direita;
    const alturaGrafico = altura - margem.topo - margem.base;
    const maximo = Math.max(...leituras.map((leitura) => leitura.kwh), 0.001);
    const passo = maximo / 4;

    contexto.font = "11px Poppins, sans-serif";
    contexto.textAlign = "right";
    contexto.textBaseline = "middle";
    for (let linha = 0; linha <= 4; linha++) {
        const y = margem.topo + alturaGrafico - (linha / 4) * alturaGrafico;
        contexto.strokeStyle = "#e5ebe6";
        contexto.beginPath();
        contexto.moveTo(margem.esquerda, y);
        contexto.lineTo(largura - margem.direita, y);
        contexto.stroke();
        contexto.fillStyle = "#68776d";
        contexto.fillText((passo * linha).toLocaleString("pt-BR", { maximumFractionDigits: 3 }), margem.esquerda - 8, y);
    }

    contexto.strokeStyle = "#31805a";
    contexto.lineWidth = 2.5;
    contexto.beginPath();
    leituras.forEach((leitura, indice) => {
        const x = margem.esquerda + (leituras.length === 1 ? larguraGrafico / 2 : (indice / (leituras.length - 1)) * larguraGrafico);
        const y = margem.topo + alturaGrafico - (leitura.kwh / maximo) * alturaGrafico;
        if (indice === 0 || leitura.lacuna) {
            contexto.moveTo(x, y);
        } else {
            contexto.lineTo(x, y);
        }
    });
    contexto.stroke();

    const intervaloRotulos = Math.max(1, Math.ceil(leituras.length / 6));
    contexto.fillStyle = "#68776d";
    contexto.textAlign = "center";
    contexto.textBaseline = "top";
    leituras.forEach((leitura, indice) => {
        if (indice % intervaloRotulos !== 0 && indice !== leituras.length - 1) {
            return;
        }
        const x = margem.esquerda + (leituras.length === 1 ? larguraGrafico / 2 : (indice / (leituras.length - 1)) * larguraGrafico);
        const data = new Date(leitura.instante);
        const rotulo = largura < 520
            ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit" });
        contexto.fillText(rotulo, x, altura - margem.base + 10);
    });
}

// Desenha um dos gráficos no canvas recebido.
function criarGrafico(canvas) {
    // Prepara o canvas para alta densidade de pixels sem alterar seu tamanho visual.
    const ctx = canvas.getContext("2d");
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    const proporcao = window.devicePixelRatio || 1;

    canvas.width = largura * proporcao;
    canvas.height = altura * proporcao;
    ctx.scale(proporcao, proporcao);

    const isGraficoDiario = canvas.id === "meuGrafico2";
    // Os dois gráficos de luz compartilham a seleção por horário ou por dia.
    const isGraficoIntensidade = canvas.id === "meuGraficoIntensidade";
    const isGraficoLuminosidade = canvas.id === "meuGraficoLuminosidade";
    const isGraficoSensorLuz = isGraficoIntensidade || isGraficoLuminosidade;
    const modoConsumoDiario = isGraficoDiario
        ? document.getElementById("modoGraficoDiario").value
        : null;
    const eixoPorHorario = (isGraficoSensorLuz && document.getElementById(
        isGraficoIntensidade ? "modoGraficoIntensidade" : "modoGraficoLuminosidade"
    ).value === "horas") || (isGraficoDiario && modoConsumoDiario === "horas");
    const configuracaoSensor = seletoresSensoresLuz.find(({ canvasId }) => canvasId === canvas.id);
    const modoSensor = isGraficoSensorLuz
        ? document.getElementById(configuracaoSensor.modoId).value
        : null;
    const serieSelecionada = isGraficoSensorLuz
        ? {
            nome: isGraficoIntensidade ? "Intensidade da iluminação" : "Luminosidade ambiente (LDR)",
            unidade: isGraficoIntensidade ? "%" : "lux",
            mensal: [],
            diario: []
        }

        : seriesGrandezas[grandezaSelecionada];
    let dias = [];
    let valoresDiarios = serieSelecionada.diario;
    let labels;
    let valores;
    let pontosHistoricos = null;
    let mesSelecionado = null;
    let anoSelecionado = null;

    if (intervaloPeriodoAplicado || isGraficoSensorLuz) {
        // Seleciona leituras do intervalo; os gráficos diários preservam as datas sem medição.
        const leituras = isGraficoSensorLuz
            ? modoSensor === "horas"
                ? obterSerieSensorPorHora(configuracaoSensor.chave, document.getElementById(configuracaoSensor.dataId).value)
                : obterSerieSensorPorDia(configuracaoSensor.chave)
            : isGraficoDiario
                ? modoConsumoDiario === "horas"
                    ? obterSerieConsumoPorHora(document.getElementById("dataGraficoDiario").value)
                    : obterSerieDiariaMensal(grandezaSelecionada)
                : obterSerieHistoricaAgrupada(grandezaSelecionada);
        pontosHistoricos = leituras;
        labels = leituras.map((registro) => {
            if (eixoPorHorario) {
                return new Date(registro.periodo).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                });
            }

            const data = isGraficoSensorLuz || isGraficoDiario ? registro.data : `${registro.periodo}-01`;
            const [ano, mes, dia] = data.split("-").map(Number);
            if (isGraficoSensorLuz) {
                return largura < 520
                    ? `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`
                    : `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
            }
            return isGraficoDiario
                ? String(dia).padStart(2, "0")
                : largura < 520
                    ? String(mes).padStart(2, "0")
                    : `${String(mes).padStart(2, "0")}/${String(ano).slice(-2)}`;
        });
        valores = leituras.map((registro) => registro.valor);
    } else {
        const meses = nomesMeses.map((mes) => mes.slice(0, 3));
        if (isGraficoDiario) {
            const agora = new Date();
            mesSelecionado = agora.getMonth();
            anoSelecionado = agora.getFullYear();

            // O dia zero do próximo mês informa quantos dias existem no mês selecionado.
            const quantidadeDias = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
            dias = Array.from({ length: quantidadeDias }, (_, index) => String(index + 1));
            valoresDiarios = serieSelecionada.diario.slice(0, quantidadeDias);
        }

        labels = isGraficoDiario ? dias : meses;
        valores = isGraficoDiario ? valoresDiarios : serieSelecionada.mensal;
    }

    const intervaloRotulos = intervaloPeriodoAplicado
        ? isGraficoDiario || isGraficoSensorLuz ? Math.max(1, Math.ceil(labels.length / 8)) : 1
        : isGraficoDiario ? 5 : 1;

    // Reserva espaço para os eixos e calcula a escala vertical do gráfico.
    const margemEsquerda = 55;
    const margemDireita = 20;
    const margemSuperior = 38;
    const margemInferior = 45;
    const larguraGrafico = largura - margemEsquerda - margemDireita;
    const alturaGrafico = altura - margemSuperior - margemInferior;
    const valoresValidos = valores.filter(Number.isFinite);
    let maiorValor = Math.max(1, ...valoresValidos);
    if (isGraficoIntensidade) {
        maiorValor = 100;
    } else if (isGraficoLuminosidade) {
        // Arredonda o teto do eixo em intervalos legíveis, de acordo com os lux registrados.
        const passoBruto = Math.max(5, maiorValor) / 5;
        const ordem = 10 ** Math.floor(Math.log10(passoBruto));
        const passoNormalizado = passoBruto / ordem;
        const passo = (passoNormalizado <= 1 ? 1 : passoNormalizado <= 2 ? 2 : passoNormalizado <= 5 ? 5 : 10) * ordem;
        maiorValor = Math.ceil(maiorValor / (passo * 5)) * passo * 5;
    }
    const quantidadeLinhas = 5;

    // Informa com clareza quando o intervalo ainda não tem medições guardadas.
    if (labels.length === 0) {
        dadosGraficos.set(canvas.id, {
            pontos: [],
            tipo: "intervalo",
            grandeza: serieSelecionada.nome,
            unidade: serieSelecionada.unidade,
            mes: null,
            ano: null
        });
        ctx.clearRect(0, 0, largura, altura);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, largura, altura);
        ctx.fillStyle = "#68776d";
        ctx.font = "14px Poppins, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(eixoPorHorario
            ? "Sem leituras horárias neste dia."
            : "Sem medições nesta faixa de datas.", largura / 2, altura / 2);
        atualizarStatusGrafico(canvas.id, 0, labels.length);
        return;
    }

    // Guarda as coordenadas de cada dado para localizar o trecho sob o ponteiro.
    const pontos = valores.map((valor, index) => {
        const instante = eixoPorHorario ? new Date(pontosHistoricos[index].periodo) : null;
        const minutosDoDia = instante
            ? instante.getHours() * 60 + instante.getMinutes() + instante.getSeconds() / 60
            : null;
        const posicaoX = eixoPorHorario
            ? margemEsquerda + (minutosDoDia / (24 * 60)) * larguraGrafico
            : labels.length === 1
                ? margemEsquerda + larguraGrafico / 2
                : margemEsquerda + (larguraGrafico / (labels.length - 1)) * index;

        return {
            x: posicaoX,
            y: Number.isFinite(valor) ? margemSuperior + alturaGrafico - (valor / maiorValor) * alturaGrafico : null,
            valor,
            indice: index,
            dia: index + 1,
            periodo: pontosHistoricos
                ? eixoPorHorario
                    ? pontosHistoricos[index].periodo
                    : isGraficoSensorLuz || isGraficoDiario ? pontosHistoricos[index].data : pontosHistoricos[index].periodo
                : null
        };
    });

    // Armazena os dados e a posição de cada canvas para alimentar seu tooltip.
    dadosGraficos.set(canvas.id, {
        pontos,
        tipo: intervaloPeriodoAplicado ? "intervalo" : isGraficoDiario ? "diario" : "mensal",
        grandeza: serieSelecionada.nome,
        unidade: serieSelecionada.unidade,
        mes: mesSelecionado,
        ano: anoSelecionado,
        periodicidade: eixoPorHorario
            ? "horario"
            : isGraficoDiario || isGraficoSensorLuz ? "diario" : "mensal"
    });
    if (isGraficoDiario && intervaloPeriodoAplicado) {
        const diasComDados = valores.filter(Number.isFinite).length;
        if (eixoPorHorario) {
            const dataSelecionada = document.getElementById("dataGraficoDiario").value;
            const rotuloData = dataSelecionada
                ? new Date(`${dataSelecionada}T00:00:00`).toLocaleDateString("pt-BR")
                : "sem dia com amostras";
            document.getElementById("periodoGraficoDiario").textContent =
                `${rotuloData} · ${diasComDados} ${diasComDados === 1 ? "amostra horária" : "amostras horárias"}.`;
        } else {
            const limites = obterLimitesMesDiario();
            const totalDias = labels.length;
            const nomeMes = new Date(limites.ano, limites.mes - 1, 1).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric"
            });
            const faixa = limites.inicio === limites.fim
                ? limites.inicio.split("-").reverse().join("/")
                : `${limites.inicio.split("-").reverse().join("/")} a ${limites.fim.split("-").reverse().join("/")}`;
            document.getElementById("periodoGraficoDiario").textContent =
                `${nomeMes} · ${faixa} · dados em ${diasComDados} de ${totalDias} dias.`;
        }
    } else {
        atualizarStatusGrafico(canvas.id, valores.filter(Number.isFinite).length, labels.length);
    }

    ctx.clearRect(0, 0, largura, altura);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.fillStyle = "#777";
    ctx.font = "12px Poppins, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Valores em ${serieSelecionada.unidade}`, margemEsquerda, 16);

    // Desenha as linhas horizontais de referência da área do gráfico.
    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    for (let i = 0; i <= quantidadeLinhas; i++) {
        const y = margemSuperior + (alturaGrafico / quantidadeLinhas) * i;
        ctx.beginPath();
        ctx.moveTo(margemEsquerda, y);
        ctx.lineTo(largura - margemDireita, y);
        ctx.stroke();
    }

    // Mostra marcas fixas no eixo X para posicionar as amostras na hora real.
    if (eixoPorHorario) {
        [0, 6, 12, 18, 24].forEach((hora) => {
            const x = margemEsquerda + (hora / 24) * larguraGrafico;
            ctx.beginPath();
            ctx.moveTo(x, margemSuperior);
            ctx.lineTo(x, margemSuperior + alturaGrafico);
            ctx.strokeStyle = "#eef0ee";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "#777";
            ctx.font = "11px Poppins, sans-serif";
            ctx.textAlign = hora === 0 ? "left" : hora === 24 ? "right" : "center";
            ctx.fillText(`${String(hora).padStart(2, "0")}h`, x, altura - 15);
        });
    }

    // Mostra os valores correspondentes às linhas da grade no eixo vertical.
    ctx.fillStyle = "#777";
    ctx.font = "12px Poppins, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= quantidadeLinhas; i++) {
        const valor = maiorValor - (maiorValor / quantidadeLinhas) * i;
        const y = margemSuperior + (alturaGrafico / quantidadeLinhas) * i;
        ctx.fillText(Math.round(valor).toLocaleString("pt-BR"), margemEsquerda - 8, y + 4);
    }

    // Distribui os rótulos do eixo horizontal e omite alguns dias para evitar sobreposição.
    if (intervaloPeriodoAplicado && !isGraficoDiario && !isGraficoSensorLuz && labels.length > 8) {
        ctx.font = "8px Poppins, sans-serif";
    }
    if (!eixoPorHorario) {
        ctx.textAlign = "center";
        labels.forEach((label, index) => {
            if (index % intervaloRotulos !== 0 && index !== labels.length - 1) {
                return;
            }
            const posicaoX = labels.length === 1
                ? margemEsquerda + larguraGrafico / 2
                : margemEsquerda + (larguraGrafico / (labels.length - 1)) * index;
            ctx.fillText(label, posicaoX, altura - 15);
        });
    }

    if (!valores.some(Number.isFinite)) {
        ctx.fillStyle = "#68776d";
        ctx.textAlign = "center";
        ctx.fillText("Sem medições nesta faixa de datas.", largura / 2, margemSuperior + alturaGrafico / 2);
    }

    // Liga os pontos da série para formar a linha de consumo.
    ctx.beginPath();
    let caminhoAberto = false;
    pontos.forEach((ponto, index) => {
        if (!Number.isFinite(ponto.valor)) {
            caminhoAberto = false;
            return;
        }
        if (index === 0) {
            ctx.moveTo(ponto.x, ponto.y);
            caminhoAberto = true;
        } else if (!caminhoAberto || !Number.isFinite(pontos[index - 1].valor)) {
            ctx.moveTo(ponto.x, ponto.y);
            caminhoAberto = true;
        } else {
            ctx.lineTo(ponto.x, ponto.y);
        }
    });
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Desenha um marcador em cada dia ou mês com dado.
    pontos.forEach((ponto) => {
        if (!Number.isFinite(ponto.valor)) {
            return;
        }
        ctx.beginPath();
        ctx.arc(ponto.x, ponto.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// Encontra o trecho da série mais próximo e escolhe o dado associado a ele.
function localizarPontoProximo(x, y, dadosGrafico) {
    const pontosValidos = dadosGrafico?.pontos.filter((ponto) => Number.isFinite(ponto.valor)) || [];
    if (pontosValidos.length === 0) {
        return null;
    }

    if (pontosValidos.length === 1) {
        const ponto = pontosValidos[0];
        const distanciaAoQuadrado = (x - ponto.x) ** 2 + (y - ponto.y) ** 2;
        return { ponto, x: ponto.x, y: ponto.y, distanciaAoQuadrado };
    }

    let resultado = null;

    for (let index = 0; index < dadosGrafico.pontos.length; index++) {
        const inicio = dadosGrafico.pontos[index];
        if (!Number.isFinite(inicio.valor)) {
            continue;
        }

        const distanciaAoPonto = (x - inicio.x) ** 2 + (y - inicio.y) ** 2;
        if (!resultado || distanciaAoPonto < resultado.distanciaAoQuadrado) {
            resultado = {
                ponto: inicio,
                x: inicio.x,
                y: inicio.y,
                distanciaAoQuadrado: distanciaAoPonto
            };
        }

        const fim = dadosGrafico.pontos[index + 1];
        if (!fim || !Number.isFinite(fim.valor)) {
            continue;
        }
        const distanciaX = fim.x - inicio.x;
        const distanciaY = fim.y - inicio.y;
        const comprimentoAoQuadrado = distanciaX ** 2 + distanciaY ** 2;
        const projecao = Math.max(0, Math.min(1,
            ((x - inicio.x) * distanciaX + (y - inicio.y) * distanciaY) / comprimentoAoQuadrado
        ));
        const pontoX = inicio.x + projecao * distanciaX;
        const pontoY = inicio.y + projecao * distanciaY;
        const distanciaAoQuadrado = (x - pontoX) ** 2 + (y - pontoY) ** 2;

        if (!resultado || distanciaAoQuadrado < resultado.distanciaAoQuadrado) {
            const pontoSelecionado = projecao < 0.5 ? inicio : fim;
            resultado = {
                ponto: pontoSelecionado,
                x: pontoX,
                y: pontoY,
                distanciaAoQuadrado
            };
        }
    }

    return resultado;
}

// Exibe a data e o valor corretos para séries diárias ou mensais.
function atualizarTooltipGrafico(evento) {
    const canvas = evento.currentTarget;
    const tooltip = canvas.parentElement.querySelector(".tooltip-grafico");
    const dadosGrafico = dadosGraficos.get(canvas.id);
    const retangulo = canvas.getBoundingClientRect();
    const x = evento.clientX - retangulo.left;
    const y = evento.clientY - retangulo.top;
    const proximidade = localizarPontoProximo(x, y, dadosGrafico);
    const tolerancia = evento.pointerType === "touch" ? 24 : 12;

    if (!proximidade || proximidade.distanciaAoQuadrado > tolerancia ** 2) {
        tooltip.hidden = true;
        return;
    }

    const { ponto } = proximidade;
    let periodo;

    if (dadosGrafico.tipo === "intervalo" && dadosGrafico.periodicidade === "horario") {
        periodo = new Date(ponto.periodo).toLocaleString("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } else if (dadosGrafico.tipo === "intervalo" && dadosGrafico.periodicidade === "diario") {
        const [ano, mes, dia] = ponto.periodo.split("-").map(Number);
        periodo = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    } else if (dadosGrafico.tipo === "intervalo") {
        const [ano, mes] = ponto.periodo.split("-").map(Number);
        periodo = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
        });
    } else if (dadosGrafico.tipo === "diario") {
        const data = new Date(dadosGrafico.ano, dadosGrafico.mes, ponto.dia);
        periodo = data.toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    } else {
        periodo = nomesMeses[ponto.indice];
    }

    tooltip.textContent = `${periodo}: ${ponto.valor.toLocaleString("pt-BR")} ${dadosGrafico.unidade}`;
    tooltip.hidden = false;

    // Mantém a caixa dentro das bordas do canvas em telas estreitas.
    const metadeTooltip = tooltip.offsetWidth / 2;
    const posicaoX = Math.max(metadeTooltip, Math.min(canvas.clientWidth - metadeTooltip, proximidade.x));
    const posicaoY = proximidade.y < 55 ? proximidade.y + 12 : proximidade.y - 10;
    tooltip.style.left = `${posicaoX}px`;
    tooltip.style.top = `${posicaoY}px`;
    tooltip.classList.toggle("is-below", proximidade.y < 55);
}

// Registra mouse e toque nos canvases que possuem tooltip.
function configurarInteracaoGraficos() {
    canvases.forEach((canvas) => {
        const tooltip = canvas.parentElement.querySelector(".tooltip-grafico");

        if (!tooltip) {
            return;
        }

        canvas.addEventListener("pointermove", atualizarTooltipGrafico);
        canvas.addEventListener("pointerdown", (evento) => {
            if (evento.pointerType === "touch") {
                atualizarTooltipGrafico(evento);
            }
        });
        canvas.addEventListener("pointerleave", (evento) => {
            if (evento.pointerType !== "touch") {
                tooltip.hidden = true;
            }
        });
        canvas.addEventListener("pointercancel", () => {
            tooltip.hidden = true;
        });
    });
}

function atualizarVisibilidadeFiltroPeriodo(painelSelecionado) {
    const filtroPeriodo = document.getElementById("filtroPeriodo");
    if (!filtroPeriodo) {
        return;
    }

    filtroPeriodo.hidden = painelSelecionado === "secaoHistorico";
}

// Alterna o painel selecionado e redesenha o canvas depois que ele fica visível.
function configurarSelecaoGraficos() {
    const botoes = document.querySelectorAll("[data-chart-target]");
    const paineis = document.querySelectorAll(".chart-panel");

    botoes.forEach((botao) => {
        botao.addEventListener("click", () => {
            const painelSelecionado = botao.dataset.chartTarget;

            botoes.forEach((item) => {
                const estaSelecionado = item === botao;
                item.classList.toggle("is-active", estaSelecionado);
                item.setAttribute("aria-pressed", String(estaSelecionado));
            });

            // Evita reexibir um tooltip antigo ao voltar para outro gráfico.
            document.querySelectorAll(".tooltip-grafico").forEach((tooltip) => {
                tooltip.hidden = true;
            });

            paineis.forEach((painel) => {
                painel.hidden = painel.id !== painelSelecionado;
            });

            atualizarVisibilidadeFiltroPeriodo(painelSelecionado);

            // O canvas precisa estar visível para medir sua largura antes de desenhar.
            const canvasesDoPainel = document.querySelectorAll(`#${painelSelecionado} canvas`);
            if (!API_CONFIG.baseUrl.trim() || dadosReaisCarregados || intervaloPeriodoAplicado) {
                canvasesDoPainel.forEach(criarGrafico);
                desenharGraficoEnergiaAcumulada();
            }
        });
    });

    // Aplica a seleção inicial da navegação aos painéis.
    const botaoInicial = document.querySelector("[data-chart-target].is-active") || botoes[0];
    if (botaoInicial) {
        const painelInicial = botaoInicial.dataset.chartTarget;
        paineis.forEach((painel) => {
            painel.hidden = painel.id !== painelInicial;
        });
        atualizarVisibilidadeFiltroPeriodo(painelInicial);
    }
}

// Sincroniza os seletores dos dois painéis e redesenha usando a grandeza escolhida.
function configurarSelecaoGrandeza() {
    const seletores = document.querySelectorAll(".seletor-grandeza");

    seletores.forEach((seletor) => {
        seletor.value = grandezaSelecionada;
        seletor.addEventListener("change", () => {
            grandezaSelecionada = seletor.value;
            seletores.forEach((outroSeletor) => {
                outroSeletor.value = grandezaSelecionada;
            });
            atualizarDiasGraficoDiario();
            desenharGraficos();
        });
    });
}

// Valida os campos usados pelas funções do histórico antes de exibi-los ou agregá-los.
function registroHistoricoValido(registro) {
    if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
        return false;
    }

    const dataValida = typeof registro.data === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(registro.data) &&
        Number.isFinite(Date.parse(`${registro.data}T00:00:00Z`)) &&
        new Date(`${registro.data}T00:00:00Z`).toISOString().slice(0, 10) === registro.data;
    const instanteLeituraValido = registro.instanteLeitura === undefined ||
        (typeof registro.instanteLeitura === "string" && Number.isFinite(Date.parse(registro.instanteLeitura)));

    return ["diario", "mensal", "resumo"].includes(registro.tipo) &&
        dataValida &&
        instanteLeituraValido &&
        typeof registro.grandeza === "string" &&
        typeof registro.chaveGrandeza === "string" &&
        typeof registro.unidade === "string" &&
        typeof registro.origem === "string" &&
        typeof registro.capturadoEm === "string" &&
        Number.isFinite(Date.parse(registro.capturadoEm)) &&
        typeof registro.valor === "number" &&
        Number.isFinite(registro.valor) &&
        registro.valor >= 0;
}

// Carrega os registros anteriores sem ocultar erros de leitura do armazenamento.
function carregarHistoricoSalvo() {
    avisoHistorico = "";
    try {
        const salvo = localStorage.getItem(CHAVE_HISTORICO);
        const registrosSalvos = salvo ? JSON.parse(salvo) : [];
        if (!Array.isArray(registrosSalvos)) {
            throw new Error("O histórico salvo não possui um formato válido.");
        }
        registrosHistorico = registrosSalvos.filter(registroHistoricoValido);
        const quantidadeIgnorada = registrosSalvos.length - registrosHistorico.length;
        if (quantidadeIgnorada) {
            avisoHistorico = `${quantidadeIgnorada.toLocaleString("pt-BR")} ${quantidadeIgnorada === 1 ? "registro inválido foi ignorado" : "registros inválidos foram ignorados"}.`;
        }

        const demoDesatualizada = registrosHistorico.some((registro) =>
            registro.origem === "Demonstração" && registro.valor === 0
        );
        const precisaAtualizarDemo = !API_CONFIG.baseUrl.trim() && (
            localStorage.getItem(CHAVE_VERSAO_DEMO) !== VERSAO_DEMO_HISTORICO ||
            demoDesatualizada ||
            !registrosHistorico.some((registro) => registro.origem === "Demonstração")
        );

        if (precisaAtualizarDemo || registrosHistorico.length === 0) {
            if (precisaAtualizarDemo) {
                registrosHistorico = registrosHistorico.filter((registro) => registro.origem !== "Demonstração");
            }
            registrosHistorico.push(...gerarDadosFicticiosHistorico());
            localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(registrosHistorico));
            if (!API_CONFIG.baseUrl.trim()) {
                localStorage.setItem(CHAVE_VERSAO_DEMO, VERSAO_DEMO_HISTORICO);
            }
            atualizarStatusHistorico(`${registrosHistorico.length.toLocaleString("pt-BR")} registros fictícios foram gerados ou corrigidos para os dias e meses disponíveis.`);
        } else {
            atualizarStatusHistorico(`${registrosHistorico.length.toLocaleString("pt-BR")} registros recuperados deste navegador.`);
        }

        if (!API_CONFIG.baseUrl.trim()) {
            atualizarSeriesDemoComHistorico();
        }
    } catch (erro) {
        registrosHistorico = gerarDadosFicticiosHistorico();
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(registrosHistorico));
        if (!API_CONFIG.baseUrl.trim()) {
            localStorage.setItem(CHAVE_VERSAO_DEMO, VERSAO_DEMO_HISTORICO);
            atualizarSeriesDemoComHistorico();
        }
        avisoHistorico = `Não foi possível ler o histórico salvo: ${erro.message}`;
        atualizarStatusHistorico(`${registrosHistorico.length.toLocaleString("pt-BR")} registros fictícios foram gerados após a falha de leitura.`);
    }

    atualizarControlesGraficosSensores();
    renderizarHistorico();
}

// Converte uma data local em formato ISO sem deslocar o dia por fuso horário.
function formatarDataHistorico(ano, mes, dia) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Guarda snapshots mensais e diários com a data consultada e a hora da captura.
function registrarHistorico(mes, ano, origem, atualizarInterface = true, estadoLeitura = estadoAtual) {
    const capturadoEm = new Date().toISOString();
    const hoje = new Date();
    const limiteDemo = formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const novosRegistros = [];

    Object.entries(seriesGrandezas).forEach(([chave, serie]) => {
        serie.mensal.forEach((valor, indice) => {
            if (!Number.isFinite(valor)) {
                return;
            }
            const data = formatarDataHistorico(ano, indice, 1);
            if (origem === "Demonstração" && data > limiteDemo) {
                return;
            }
            novosRegistros.push({
                tipo: "mensal",
                data,
                grandeza: serie.nome,
                chaveGrandeza: chave,
                valor,
                unidade: serie.unidade,
                capturadoEm,
                origem
            });
        });

        // Guarda o custo apenas para o mês consultado; não replica o resumo nos outros meses.
        novosRegistros.push({
            tipo: "resumo",
            data: formatarDataHistorico(ano, mes, 1),
            grandeza: "Custo total",
            chaveGrandeza: "custo",
            valor: resumoConsumo.totalCostBrl,
            unidade: "BRL",
            capturadoEm,
            origem
        });

        serie.diario.forEach((valor, indice) => {
            if (!Number.isFinite(valor)) {
                return;
            }
            const data = formatarDataHistorico(ano, mes, indice + 1);
            if (origem === "Demonstração" && data > limiteDemo) {
                return;
            }
            const instanteLeitura = estadoLeitura.atualizadoEm || capturadoEm;
            const dataInstanteLeitura = new Date(instanteLeitura);
            const dataLeitura = formatarDataHistorico(
                dataInstanteLeitura.getFullYear(),
                dataInstanteLeitura.getMonth(),
                dataInstanteLeitura.getDate()
            );
            novosRegistros.push({
                tipo: "diario",
                data,
                grandeza: serie.nome,
                chaveGrandeza: chave,
                valor,
                unidade: serie.unidade,
                capturadoEm,
                ...(data === dataLeitura ? { instanteLeitura } : {}),
                origem
            });
        });
    });

    // Salva a intensidade recebida com a data real da leitura para alimentar a série temporal.
    if (Number.isFinite(estadoLeitura.intensidadePercentual)) {
        const instanteLeitura = estadoLeitura.atualizadoEm || capturadoEm;
        const dataLeitura = new Date(instanteLeitura);
        novosRegistros.push({
            tipo: "diario",
            data: formatarDataHistorico(dataLeitura.getFullYear(), dataLeitura.getMonth(), dataLeitura.getDate()),
            grandeza: "Intensidade da iluminação",
            chaveGrandeza: "intensidade",
            valor: estadoLeitura.intensidadePercentual,
            unidade: "%",
            capturadoEm,
            instanteLeitura,
            origem
        });
    }

    // Salva cada leitura do LDR usando a data informada pelo dispositivo, quando disponível.
    if (Number.isFinite(estadoLeitura.luminosidadeLux)) {
        const instanteLeitura = estadoLeitura.atualizadoEm || capturadoEm;
        const dataLeitura = new Date(instanteLeitura);
        novosRegistros.push({
            tipo: "diario",
            data: formatarDataHistorico(dataLeitura.getFullYear(), dataLeitura.getMonth(), dataLeitura.getDate()),
            grandeza: "Luminosidade ambiente (LDR)",
            chaveGrandeza: "luminosidade",
            valor: estadoLeitura.luminosidadeLux,
            unidade: "lux",
            capturadoEm,
            instanteLeitura,
            origem
        });
    }

    // Atualiza a leitura mais recente do mesmo dia, métrica e origem sem duplicar a tabela.
    const criarChaveRegistro = (registro) => {
        const leituraPorHorario = registro.instanteLeitura || "";
        return `${registro.tipo}|${registro.data}|${registro.chaveGrandeza}|${registro.origem}|${leituraPorHorario}`;
    };
    const registrosPorChave = new Map(registrosHistorico
        .filter((registro) => !(registro.origem === "Demonstração" && registro.data > limiteDemo))
        .map((registro) => [criarChaveRegistro(registro), registro]));
    novosRegistros.forEach((registro) => {
        const chave = criarChaveRegistro(registro);
        registrosPorChave.set(chave, registro);
    });

    registrosHistorico = Array.from(registrosPorChave.values())
        .sort((primeiro, segundo) => segundo.capturadoEm.localeCompare(primeiro.capturadoEm))
        .slice(0, LIMITE_REGISTROS_HISTORICO);

    try {
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(registrosHistorico));
        atualizarStatusHistorico(`${registrosHistorico.length.toLocaleString("pt-BR")} registros guardados neste navegador.`);
    } catch (erro) {
        atualizarStatusHistorico(`Os dados foram carregados, mas não foi possível salvar o histórico: ${erro.message}`);
    }

    if (atualizarInterface) {
        atualizarMesesGraficoDiario();
        atualizarControlesGraficosSensores();
        renderizarHistorico();
        if (intervaloPeriodoAplicado) {
            atualizarIndicadores();
            desenharGraficos();
        }
    }
}

function inicializarFiltrosHistorico() {
    const filtroGrandeza = document.getElementById("filtroHistoricoGrandeza");
    const filtroData = document.getElementById("filtroHistoricoData");
    if (!filtroGrandeza || !filtroData) {
        return;
    }

    filtroGrandeza.value = "todas";
    filtroData.value = "todas";
    atualizarOpcoesFiltrosHistorico();
}

// Atualiza o texto de estado da área de histórico.
function atualizarStatusHistorico(mensagem) {
    const status = document.getElementById("statusHistorico");
    if (status) {
        status.textContent = avisoHistorico ? `${mensagem} ${avisoHistorico}` : mensagem;
    }
}

// Obtém a medição mensal mais recente para cada período disponível.
function obterConsumosMensaisHistoricos() {
    const porPeriodo = new Map();
    registrosHistorico
        .filter((registro) => registro.tipo === "mensal" && registro.chaveGrandeza === "consumo")
        .forEach((registro) => {
            const periodo = registro.data.slice(0, 7);
            const atual = porPeriodo.get(periodo);
            if (!atual || registro.capturadoEm > atual.capturadoEm) {
                porPeriodo.set(periodo, registro);
            }
        });

    return Array.from(porPeriodo.entries()).sort(([periodoA], [periodoB]) => periodoA.localeCompare(periodoB));
}

// Preenche os filtros com os períodos salvos e preserva escolhas ainda válidas.
function atualizarOpcoesComparacao(periodos) {
    const seletores = [
        document.getElementById("periodoComparacaoA"),
        document.getElementById("periodoComparacaoB")
    ];
    const valoresAnteriores = seletores.map((seletor) => seletor.value);

    seletores.forEach((seletor, indice) => {
        seletor.replaceChildren();
        periodos.forEach(([periodo]) => {
            const [ano, mes] = periodo.split("-").map(Number);
            const opcao = document.createElement("option");
            opcao.value = periodo;
            opcao.textContent = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric"
            });
            seletor.appendChild(opcao);
        });
    });

    seletores.forEach((seletor, indice) => {
        const periodoAnteriorExiste = periodos.some(([periodo]) => periodo === valoresAnteriores[indice]);
        const periodoInicial = periodos.length > 1
            ? periodos[periodos.length - 2 + indice][0]
            : periodos[0]?.[0];
        seletor.value = periodoAnteriorExiste ? valoresAnteriores[indice] : periodoInicial || "";
    });
}

// Mostra a diferença numérica e barras responsivas dos dois meses selecionados.
function renderizarComparacaoHistorico(periodos) {
    const periodoA = document.getElementById("periodoComparacaoA").value;
    const periodoB = document.getElementById("periodoComparacaoB").value;
    const resultado = document.getElementById("resultadoComparacao");
    const grafico = document.getElementById("graficoComparacao");
    const registroA = periodos.find(([periodo]) => periodo === periodoA)?.[1];
    const registroB = periodos.find(([periodo]) => periodo === periodoB)?.[1];
    grafico.replaceChildren();

    if (!registroA || !registroB) {
        resultado.textContent = "Carregue períodos diferentes para comparar o consumo mensal.";
        return;
    }

    if (periodoA === periodoB) {
        resultado.textContent = "Selecione dois períodos diferentes para ver a comparação.";
        return;
    }

    const diferenca = registroB.valor - registroA.valor;
    const variacao = registroA.valor === 0 ? null : (diferenca / registroA.valor) * 100;
    const direcao = diferenca > 0 ? "aumento" : diferenca < 0 ? "redução" : "sem alteração";
    const percentual = variacao === null
        ? ""
        : ` (${variacao > 0 ? "+" : ""}${variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`;
    resultado.textContent = `${direcao === "sem alteração" ? "Sem alteração" : `${direcao[0].toLocaleUpperCase("pt-BR")}${direcao.slice(1)}`} de ${Math.abs(diferenca).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh${percentual} no segundo período em relação ao primeiro.`;

    const maiorValor = Math.max(registroA.valor, registroB.valor);
    [
        [periodoA, registroA],
        [periodoB, registroB]
    ].forEach(([periodo, registro]) => {
        const linha = document.createElement("div");
        linha.className = "barra-comparacao";
        const rotulo = document.createElement("span");
        const [ano, mes] = periodo.split("-").map(Number);
        rotulo.textContent = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
            month: "short",
            year: "numeric"
        });

        const trilho = document.createElement("span");
        trilho.className = "barra-comparacao-trilho";
        const barra = document.createElement("span");
        barra.className = "barra-comparacao-valor";
        barra.style.width = `${maiorValor > 0 ? (registro.valor / maiorValor) * 100 : 0}%`;
        trilho.appendChild(barra);

        const valor = document.createElement("strong");
        valor.textContent = `${registro.valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`;
        linha.append(rotulo, trilho, valor);
        grafico.appendChild(linha);
    });
}

function atualizarOpcoesFiltrosHistorico() {
    const filtroGrandeza = document.getElementById("filtroHistoricoGrandeza");
    const filtroData = document.getElementById("filtroHistoricoData");

    if (!filtroGrandeza || !filtroData) {
        return;
    }

    const valoresGrandeza = [...new Set(registrosHistorico.map((registro) => registro.grandeza).filter(Boolean))].sort();
    const valoresData = [...new Set(registrosHistorico.map((registro) => registro.data.slice(0, 7)).filter(Boolean))].sort().reverse();
    const valorGrandezaAnterior = filtroGrandeza.value;
    const valorDataAnterior = filtroData.value;

    filtroGrandeza.replaceChildren();
    const opcaoTodasGrandezas = document.createElement("option");
    opcaoTodasGrandezas.value = "todas";
    opcaoTodasGrandezas.textContent = "Todas";
    filtroGrandeza.appendChild(opcaoTodasGrandezas);
    valoresGrandeza.forEach((grandeza) => {
        const opcao = document.createElement("option");
        opcao.value = grandeza;
        opcao.textContent = grandeza;
        filtroGrandeza.appendChild(opcao);
    });
    filtroGrandeza.value = valoresGrandeza.includes(valorGrandezaAnterior) ? valorGrandezaAnterior : "todas";

    filtroData.replaceChildren();
    const opcaoTodasDatas = document.createElement("option");
    opcaoTodasDatas.value = "todas";
    opcaoTodasDatas.textContent = "Todas";
    filtroData.appendChild(opcaoTodasDatas);
    valoresData.forEach((data) => {
        const opcao = document.createElement("option");
        const [ano, mes] = data.split("-").map(Number);
        opcao.value = data;
        opcao.textContent = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
        });
        filtroData.appendChild(opcao);
    });
    filtroData.value = valoresData.includes(valorDataAnterior) ? valorDataAnterior : "todas";
}

function obterRegistrosHistoricoFiltrados() {
    const filtroGrandeza = document.getElementById("filtroHistoricoGrandeza");
    const filtroData = document.getElementById("filtroHistoricoData");
    const grandezaSelecionada = filtroGrandeza?.value || "todas";
    const dataSelecionada = filtroData?.value || "todas";

    return [...registrosHistorico]
        .filter((registro) => grandezaSelecionada === "todas" || registro.grandeza === grandezaSelecionada)
        .filter((registro) => dataSelecionada === "todas" || registro.data.startsWith(dataSelecionada))
        .sort((primeiro, segundo) =>
            segundo.data.localeCompare(primeiro.data) ||
            segundo.capturadoEm.localeCompare(primeiro.capturadoEm)
        );
}

// Renderiza uma amostra recente e os dados de comparação a partir do histórico local.
function renderizarHistorico() {
    const tabela = document.getElementById("listaHistorico");
    if (!tabela) {
        return;
    }

    const periodos = obterConsumosMensaisHistoricos();
    const legenda = document.getElementById("legendaHistorico");
    atualizarOpcoesComparacao(periodos);
    atualizarOpcoesFiltrosHistorico();
    renderizarComparacaoHistorico(periodos);
    tabela.replaceChildren();

    const registrosFiltrados = obterRegistrosHistoricoFiltrados();
    const registrosRecentes = registrosFiltrados.slice(0, 50);
    const filtroGrandeza = document.getElementById("filtroHistoricoGrandeza")?.value || "todas";
    const filtroData = document.getElementById("filtroHistoricoData")?.value || "todas";
    const nomeFiltroGrandeza = filtroGrandeza === "todas" ? "todos os registros" : filtroGrandeza;
    const nomeFiltroData = filtroData === "todas" ? "todas as datas" : new Date(`${filtroData}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    legenda.textContent = registrosFiltrados.length > registrosRecentes.length
        ? `Registros mais recentes (${registrosRecentes.length.toLocaleString("pt-BR")} de ${registrosFiltrados.length.toLocaleString("pt-BR")}) · ${nomeFiltroGrandeza} · ${nomeFiltroData}`
        : `Registros mais recentes · ${nomeFiltroGrandeza} · ${nomeFiltroData}`;

    if (registrosRecentes.length === 0) {
        const linha = document.createElement("tr");
        const celula = document.createElement("td");
        celula.className = "historico-vazio";
        celula.colSpan = 5;
        celula.textContent = "Nenhum registro encontrado para os filtros selecionados.";
        linha.appendChild(celula);
        tabela.appendChild(linha);
        return;
    }

    registrosRecentes.forEach((registro) => {
        const linha = document.createElement("tr");
        const dataMedida = new Date(`${registro.data}T00:00:00`).toLocaleDateString("pt-BR");
        const dataCaptura = new Date(registro.capturadoEm).toLocaleString("pt-BR");
        const valores = [
            registro.tipo === "mensal" ? `Mês de ${dataMedida}` : dataMedida,
            registro.grandeza,
            `${registro.valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${registro.unidade}`,
            dataCaptura,
            registro.origem
        ];

        valores.forEach((valor) => {
            const celula = document.createElement("td");
            celula.textContent = valor;
            linha.appendChild(celula);
        });
        tabela.appendChild(linha);
    });

}

// Liga a alteração dos períodos à atualização da comparação.
function configurarComparacaoHistorico() {
    ["periodoComparacaoA", "periodoComparacaoB"].forEach((id) => {
        document.getElementById(id).addEventListener("change", () => {
            renderizarComparacaoHistorico(obterConsumosMensaisHistoricos());
        });
    });

    ["filtroHistoricoGrandeza", "filtroHistoricoData"].forEach((id) => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.addEventListener("change", () => {
                renderizarHistorico();
            });
        }
    });
}

function escaparTextoXml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function calcularCrc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function empacotarArquivoZip(arquivos) {
    const codificador = new TextEncoder();
    const partesLocais = [];
    const partesDiretorio = [];
    let deslocamento = 0;

    arquivos.forEach(({ nome, conteudo }) => {
        const nomeBytes = codificador.encode(nome);
        const dados = codificador.encode(conteudo);
        const crc32 = calcularCrc32(dados);
        const cabecalhoLocal = new Uint8Array(30 + nomeBytes.length);
        const vistaLocal = new DataView(cabecalhoLocal.buffer);
        vistaLocal.setUint32(0, 0x04034b50, true);
        vistaLocal.setUint16(4, 20, true);
        vistaLocal.setUint16(6, 0x0800, true);
        vistaLocal.setUint16(8, 0, true);
        vistaLocal.setUint32(14, crc32, true);
        vistaLocal.setUint32(18, dados.length, true);
        vistaLocal.setUint32(22, dados.length, true);
        vistaLocal.setUint16(26, nomeBytes.length, true);
        cabecalhoLocal.set(nomeBytes, 30);
        partesLocais.push(cabecalhoLocal, dados);

        const cabecalhoDiretorio = new Uint8Array(46 + nomeBytes.length);
        const vistaDiretorio = new DataView(cabecalhoDiretorio.buffer);
        vistaDiretorio.setUint32(0, 0x02014b50, true);
        vistaDiretorio.setUint16(4, 20, true);
        vistaDiretorio.setUint16(6, 20, true);
        vistaDiretorio.setUint16(8, 0x0800, true);
        vistaDiretorio.setUint16(10, 0, true);
        vistaDiretorio.setUint32(16, crc32, true);
        vistaDiretorio.setUint32(20, dados.length, true);
        vistaDiretorio.setUint32(24, dados.length, true);
        vistaDiretorio.setUint16(28, nomeBytes.length, true);
        vistaDiretorio.setUint32(42, deslocamento, true);
        cabecalhoDiretorio.set(nomeBytes, 46);
        partesDiretorio.push(cabecalhoDiretorio);
        deslocamento += cabecalhoLocal.length + dados.length;
    });

    const tamanhoDiretorio = partesDiretorio.reduce((total, parte) => total + parte.length, 0);
    const fimDiretorio = new Uint8Array(22);
    const vistaFim = new DataView(fimDiretorio.buffer);
    vistaFim.setUint32(0, 0x06054b50, true);
    vistaFim.setUint16(8, arquivos.length, true);
    vistaFim.setUint16(10, arquivos.length, true);
    vistaFim.setUint32(12, tamanhoDiretorio, true);
    vistaFim.setUint32(16, deslocamento, true);

    return new Blob([...partesLocais, ...partesDiretorio, fimDiretorio], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
}

function criarXmlFolhaExcel(registros, opcoes) {
    const colunas = opcoes.colunas;
    const linhas = [colunas];
    registros.forEach((registro) => linhas.push(opcoes.mapearRegistro(registro)));

    const gerarCelula = (valor, coluna, linha) => {
        const referencia = `${String.fromCharCode(64 + coluna)}${linha}`;
        const estilo = opcoes.estiloColuna?.[coluna - 1] || 0;
        const atributoEstilo = estilo ? ` s="${estilo}"` : "";
        if (typeof valor === "number" && Number.isFinite(valor)) {
            return `<c r="${referencia}"${atributoEstilo}><v>${valor}</v></c>`;
        }
        return `<c r="${referencia}" t="inlineStr"${atributoEstilo}><is><t xml:space="preserve">${escaparTextoXml(valor ?? "")}</t></is></c>`;
    };
    const xmlLinhas = linhas.map((valores, indice) =>
        `<row r="${indice + 1}">${valores.map((valor, coluna) => gerarCelula(valor, coluna + 1, indice + 1)).join("")}</row>`
    ).join("");
    const ultimaColuna = String.fromCharCode(64 + colunas.length);
    const largurasColunas = opcoes.larguras
        .map((largura, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="${largura}" customWidth="1"/>`)
        .join("");
    const protecao = `<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" selectLockedCells="0" selectUnlockedCells="0" sort="0" autoFilter="0"/>`;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${largurasColunas}</cols><sheetData>${xmlLinhas}</sheetData>${protecao}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`;
}

function criarXmlTabelaExcel(tabelaId, nome, quantidadeLinhas, colunas) {
    const ultimaColuna = String.fromCharCode(64 + colunas.length);
    const referencia = `A1:${ultimaColuna}${quantidadeLinhas + 1}`;
    const nomesColunas = colunas.map((coluna, indice) =>
        `<tableColumn id="${indice + 1}" name="${escaparTextoXml(coluna)}"/>`
    ).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${tabelaId}" name="${nome}" displayName="${nome}" ref="${referencia}" totalsRowShown="0"><autoFilter ref="${referencia}"/><tableColumns count="${colunas.length}">${nomesColunas}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
}

function serialDataExcel(data) {
    const [ano, mes, dia] = data.split("-").map(Number);
    return (Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86400000;
}

function serialDataHoraExcel(instante) {
    const data = new Date(instante);
    const dia = serialDataExcel(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`);
    const segundos = data.getHours() * 3600 + data.getMinutes() * 60 + data.getSeconds();
    return dia + segundos / 86400;
}

function criarPastaTrabalhoHistorico() {
    const colunas = ["Ano", "Data do período", "Periodicidade", "Grandeza", "Valor", "Unidade", "Data e hora da coleta", "Origem"];
    const tipoRegistro = { diario: "Diário", mensal: "Mensal", resumo: "Resumo" };
    const ordenarRegistros = (registros) => [...registros].sort((primeiro, segundo) =>
        segundo.data.localeCompare(primeiro.data) ||
        (tipoRegistro[primeiro.tipo] || primeiro.tipo).localeCompare(tipoRegistro[segundo.tipo] || segundo.tipo) ||
        primeiro.grandeza.localeCompare(segundo.grandeza) ||
        segundo.capturadoEm.localeCompare(primeiro.capturadoEm)
    );
    const mapearRegistro = (registro) => [
        Number(registro.data.slice(0, 4)),
        serialDataExcel(registro.data),
        tipoRegistro[registro.tipo] || registro.tipo,
        registro.grandeza,
        registro.valor,
        registro.unidade,
        serialDataHoraExcel(registro.capturadoEm),
        registro.origem
    ];
    const larguras = [10, 16, 16, 22, 16, 12, 24, 18];
    const arquivos = [];
    const folhas = [{
        nome: "Todos os dados",
        tabela: "TabelaHistoricoCompleto",
        registros: ordenarRegistros(registrosHistorico)
    }];
    const anos = [...new Set(registrosHistorico.map((registro) => Number(registro.data.slice(0, 4))))].sort((a, b) => b - a);
    anos.forEach((ano) => {
        folhas.push({
            nome: String(ano),
            tabela: `TabelaHistorico${ano}`,
            registros: ordenarRegistros(registrosHistorico.filter((registro) => registro.data.startsWith(`${ano}-`)))
        });
    });

    const workbookSheets = [];
    const workbookRelationships = [];
    const contentTypes = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>'];
    const estilosColunas = [0, 2, 0, 0, 3, 0, 4, 0];

    folhas.forEach((folha, indice) => {
        const numero = indice + 1;
        const relId = `rId${numero}`;
        const tabelaRelId = "rId1";
        workbookSheets.push(`<sheet name="${escaparTextoXml(folha.nome)}" sheetId="${numero}" r:id="${relId}"/>`);
        workbookRelationships.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${numero}.xml"/>`);
        contentTypes.push(`<Override PartName="/xl/worksheets/sheet${numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
        contentTypes.push(`<Override PartName="/xl/tables/table${numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
        arquivos.push({
            nome: `xl/worksheets/sheet${numero}.xml`,
            conteudo: criarXmlFolhaExcel(folha.registros, {
                colunas,
                larguras,
                estiloColuna: estilosColunas,
                mapearRegistro
            })
        });
        arquivos.push({
            nome: `xl/worksheets/_rels/sheet${numero}.xml.rels`,
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${tabelaRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${numero}.xml"/></Relationships>`
        });
        arquivos.push({
            nome: `xl/tables/table${numero}.xml`,
            conteudo: criarXmlTabelaExcel(numero, folha.tabela, folha.registros.length, colunas)
        });
    });

    contentTypes.push('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>');
    contentTypes.push('<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>');
    arquivos.unshift(
        {
            nome: "[Content_Types].xml",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${contentTypes.join("")}</Types>`
        },
        {
            nome: "_rels/.rels",
            conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
        },
        {
            nome: "xl/workbook.xml",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${workbookSheets.join("")}</sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'Todos os dados'!$1:$1</definedName></definedNames><calcPr calcId="191029"/></workbook>`
        },
        {
            nome: "xl/_rels/workbook.xml.rels",
            conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships.join("")}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
        },
        {
            nome: "xl/styles.xml",
            conteudo: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
        }
    );

    return empacotarArquivoZip(arquivos);
}

// Exporta o histórico em tabelas Excel formatadas e protegidas contra edição acidental.
function exportarHistorico() {
    const status = document.getElementById("statusExportacao");
    if (registrosHistorico.length === 0) {
        status.textContent = "Não há registros históricos para exportar.";
        return;
    }

    try {
        const arquivo = criarPastaTrabalhoHistorico();
        const enderecoArquivo = URL.createObjectURL(arquivo);
        const linkDownload = document.createElement("a");
        const hoje = new Date();
        const doisDigitos = (valor) => String(valor).padStart(2, "0");
        const dataArquivo = `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;

        linkDownload.href = enderecoArquivo;
        linkDownload.download = `historico-consumo-${dataArquivo}.xlsx`;
        document.body.appendChild(linkDownload);
        linkDownload.click();
        linkDownload.remove();
        window.setTimeout(() => URL.revokeObjectURL(enderecoArquivo), 1000);
        status.textContent = `${registrosHistorico.length.toLocaleString("pt-BR")} registros exportados em planilha protegida.`;
    } catch (erro) {
        console.error("Não foi possível gerar a planilha do histórico.", erro);
        status.textContent = `Não foi possível gerar a planilha: ${erro.message}`;
    }
}

// Liga o comando da barra lateral à geração do arquivo CSV.
function configurarExportacaoHistorico() {
    const botaoExportar = document.getElementById("btnExportarHistorico");
    if (botaoExportar) {
        botaoExportar.addEventListener("click", exportarHistorico);
    }
}

// Valida tamanho e valores das séries recebidas para o período consultado.
function validarSerieApi(serie, tamanhoEsperado, nomeSerie) {
    if (!Array.isArray(serie) || serie.length !== tamanhoEsperado) {
        throw new Error(`A série ${nomeSerie} deve conter ${tamanhoEsperado} valores.`);
    }

    return serie.map((valor) => {
        const numero = Number(valor);
        if (!Number.isFinite(numero) || numero < 0) {
            throw new Error(`A série ${nomeSerie} contém um valor inválido.`);
        }
        return numero;
    });
}

// Valida uma leitura atual opcional sem transformar valores ausentes em zeros.
function validarLeituraAtual(valor, nomeCampo, maximo = Infinity) {
    if (valor === undefined || valor === null) {
        return null;
    }

    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0 || numero > maximo) {
        throw new Error(`A leitura atual ${nomeCampo} contém um valor inválido.`);
    }
    return numero;
}

// Normaliza os sensores e estados atuais, que são opcionais para compatibilidade da API.
function normalizarEstadoAtual(resposta) {
    const atual = resposta.currentState ?? {};
    if (typeof atual !== "object" || Array.isArray(atual)) {
        throw new Error("O campo currentState deve ser um objeto.");
    }

    const validarEstadoBooleano = (valor, nomeCampo) => {
        if (valor === undefined || valor === null) {
            return null;
        }
        if (typeof valor !== "boolean") {
            throw new Error(`O estado atual ${nomeCampo} deve ser booleano.`);
        }
        return valor;
    };

    let atualizadoEm = null;
    let origemHorario = "";
    if (atual.lastUpdatedAt !== undefined && atual.lastUpdatedAt !== null) {
        if (typeof atual.lastUpdatedAt !== "string" || !Number.isFinite(Date.parse(atual.lastUpdatedAt))) {
            throw new Error("O horário lastUpdatedAt do estado atual é inválido.");
        }
        atualizadoEm = new Date(atual.lastUpdatedAt).toISOString();
        origemHorario = "Atualizado pelo dispositivo";
    } else {
        atualizadoEm = new Date().toISOString();
        origemHorario = "Consulta recebida pelo dashboard";
    }

    return {
        luminosidadeLux: validarLeituraAtual(atual.ambientLightLux, "ambientLightLux"),
        presencaDetectada: validarEstadoBooleano(atual.presenceDetected, "presenceDetected"),
        intensidadePercentual: validarLeituraAtual(atual.lightingIntensityPercent, "lightingIntensityPercent", 100),
        potenciaWatts: validarLeituraAtual(atual.powerWatts, "powerWatts"),
        iluminacaoLigada: validarEstadoBooleano(atual.lightingOn, "lightingOn"),
        esp32Conectado: validarEstadoBooleano(atual.esp32Connected, "esp32Connected"),
        atualizadoEm,
        origemHorario
    };
}

// Converte a resposta da API para o formato consumido pelos gráficos e indicadores.
function normalizarRespostaApi(resposta, mes, ano) {
    if (!resposta || typeof resposta !== "object" || !resposta.summary) {
        throw new Error("Resposta da API fora do formato documentado.");
    }

    const diasDoMes = new Date(ano, mes + 1, 0).getDate();
    const resumo = {
        totalCostBrl: Number(resposta.summary.totalCostBrl),
        dailyConsumptionKwh: Number(resposta.summary.dailyConsumptionKwh),
        monthlyConsumptionKwh: Number(resposta.summary.monthlyConsumptionKwh),
        dailyChangePercent: Number(resposta.summary.dailyChangePercent ?? 0),
        monthlyChangePercent: Number(resposta.summary.monthlyChangePercent ?? 0)
    };

    Object.values(resumo).forEach((valor) => {
        if (!Number.isFinite(valor)) {
            throw new Error("O resumo da API contém um valor inválido.");
        }
    });

    const medidas = resposta.measurements;
    if (!medidas || !medidas.voltage || !medidas.current || !medidas.power) {
        throw new Error("A API deve enviar voltage, current e power em measurements.");
    }

    return {
        resumo,
        estadoAtual: normalizarEstadoAtual(resposta),
        metricas: {
            consumo: {
                nome: "Consumo",
                unidade: "kWh",
                mensal: validarSerieApi(resposta.monthlyConsumptionKwh, 12, "monthlyConsumptionKwh"),
                diario: validarSerieApi(resposta.dailyConsumptionKwh, diasDoMes, "dailyConsumptionKwh")
            },
            tensao: {
                nome: "Tensão",
                unidade: "V",
                mensal: validarSerieApi(medidas.voltage.monthly, 12, "measurements.voltage.monthly"),
                diario: validarSerieApi(medidas.voltage.daily, diasDoMes, "measurements.voltage.daily")
            },
            corrente: {
                nome: "Corrente",
                unidade: "A",
                mensal: validarSerieApi(medidas.current.monthly, 12, "measurements.current.monthly"),
                diario: validarSerieApi(medidas.current.daily, diasDoMes, "measurements.current.daily")
            },
            potencia: {
                nome: "Potência",
                unidade: "W",
                mensal: validarSerieApi(medidas.power.monthly, 12, "measurements.power.monthly"),
                diario: validarSerieApi(medidas.power.daily, diasDoMes, "measurements.power.daily")
            }
        },
        anos: Array.isArray(resposta.availableYears) ? resposta.availableYears : []
    };
}

// Atualiza os cards atuais e informa a origem do horário exibido.
function atualizarEstadoAtual() {
    const formatarNumero = (valor, casas = 1) => valor === null
        ? "Não informado"
        : valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
    const formatarBooleano = (valor) => valor === null
        ? "Não informado"
        : valor ? "Detectada" : "Não detectada";
    const luminosidade = document.getElementById("valorLuminosidadeAtual");
    const presenca = document.getElementById("valorPresencaAtual");
    const intensidade = document.getElementById("valorIntensidadeAtual");
    const consumo = document.getElementById("valorConsumoAtual");
    const atualizacao = document.getElementById("ultimaAtualizacaoAtual");
    const detalhePresenca = document.getElementById("detalhePresencaAtual");

    luminosidade.textContent = estadoAtual.luminosidadeLux === null
        ? "Não informado"
        : `${formatarNumero(estadoAtual.luminosidadeLux)} lux`;
    presenca.textContent = formatarBooleano(estadoAtual.presencaDetectada);
    intensidade.textContent = estadoAtual.intensidadePercentual === null
        ? "Não informado"
        : `${formatarNumero(estadoAtual.intensidadePercentual, 0)}%`;
        const nivelIluminacao = document.getElementById("nivelIluminacao");
        const statusIluminacao = document.getElementById("statusIluminacao");
        if (estadoAtual.intensidadePercentual !== null) {
            const intensidadeAtual = Math.max(
                0,
                Math.min(100, estadoAtual.intensidadePercentual)
            );
            if (nivelIluminacao) {
                nivelIluminacao.style.width = `${intensidadeAtual}%`;
            }
            if (statusIluminacao) {
                if (intensidadeAtual === 0) {
                    statusIluminacao.textContent = "Iluminação desligada";
                } else if (intensidadeAtual < 30) {
                    statusIluminacao.textContent = "Iluminação baixa";
                } else if (intensidadeAtual < 70) {
                    statusIluminacao.textContent = "Iluminação média";
                } else {
                    statusIluminacao.textContent = "Iluminação alta";
                }
            }
        } else {
            if (nivelIluminacao) {
                nivelIluminacao.style.width = "0%";
            }
            if (statusIluminacao) {
                statusIluminacao.textContent = "Aguardando leitura...";
            }
        }
    consumo.textContent = estadoAtual.potenciaWatts === null
        ? "Não informado"
        : `${formatarNumero(estadoAtual.potenciaWatts)} W`;
    detalhePresenca.textContent = estadoAtual.presencaDetectada === null
        ? "Leitura do sensor"
        : "Leitura do sensor de presença";

    const atualizarIndicador = (id, valor, ligado, desligado) => {
        const indicador = document.getElementById(id);
        indicador.className = "status-indicador";
        if (valor === null) {
            indicador.textContent = "Não informado";
            return;
        }
        indicador.textContent = valor ? ligado : desligado;
        indicador.classList.add(valor ? "is-on" : "is-off");
        if (id === "statusEsp32Atual") {
            indicador.classList.toggle("is-connected", valor);
            indicador.classList.toggle("is-disconnected", !valor);
        }
    };

    atualizarIndicador("statusIluminacaoAtual", estadoAtual.iluminacaoLigada, "Ligada", "Desligada");
    atualizarIndicador("statusEsp32Atual", estadoAtual.esp32Conectado, "Conectado", "Desconectado");

    if (estadoAtual.atualizadoEm) {
        const dataAtualizacao = new Date(estadoAtual.atualizadoEm);
        atualizacao.dateTime = dataAtualizacao.toISOString();
        atualizacao.textContent = `${estadoAtual.origemHorario}: ${dataAtualizacao.toLocaleString("pt-BR")}`;
    } else {
        atualizacao.removeAttribute("datetime");
        atualizacao.textContent = "Aguardando dados";
    }
}

// Preenche o painel atual com leituras claramente demonstrativas quando não há API.
function carregarEstadoDemonstrativo() {
    atualizarSeriesDemoComHistorico();
    estadoAtual = {
        luminosidadeLux: 320,
        presencaDetectada: false,
        intensidadePercentual: 65,
        potenciaWatts: 1140,
        iluminacaoLigada: true,
        esp32Conectado: true,
        atualizadoEm: new Date().toISOString(),
        origemHorario: "Demonstração atualizada"
    };
    registrarLeituraEnergia(estadoAtual);
    atualizarEstadoAtual();
}

// Retorna a leitura mais recente de cada data e grandeza dentro do intervalo aplicado.
function obterRegistrosDiariosFiltrados(chaveGrandeza, intervalo = intervaloPeriodoAplicado) {
    if (!intervalo) {
        return [];
    }

    const porData = new Map();
    registrosHistorico
        .filter((registro) =>
            registro.tipo === "diario" &&
            registro.chaveGrandeza === chaveGrandeza &&
            registro.data >= intervalo.inicio &&
            registro.data <= intervalo.fim
        )
        .forEach((registro) => {
            const existente = porData.get(registro.data);
            if (!existente || registro.capturadoEm > existente.capturadoEm) {
                porData.set(registro.data, registro);
            }
        });

    return Array.from(porData.values()).sort((primeiro, segundo) => primeiro.data.localeCompare(segundo.data));
}

// Retorna todas as amostras do sensor no intervalo, sem juntar as leituras do mesmo dia.
function obterLeiturasSensorNoIntervalo(chaveGrandeza) {
    if (!intervaloPeriodoAplicado) {
        return [];
    }

    return registrosHistorico
        .filter((registro) =>
            registro.tipo === "diario" &&
            registro.chaveGrandeza === chaveGrandeza &&
            registro.data >= intervaloPeriodoAplicado.inicio &&
            registro.data <= intervaloPeriodoAplicado.fim
        )
        .sort((primeiro, segundo) =>
            (primeiro.instanteLeitura || primeiro.capturadoEm)
                .localeCompare(segundo.instanteLeitura || segundo.capturadoEm)
        );
}

// Agrupa as amostras pela data e calcula a média diária sem inventar leituras ausentes.
function obterSerieSensorPorDia(chaveGrandeza) {
    const leiturasPorData = new Map();
    obterLeiturasSensorNoIntervalo(chaveGrandeza).forEach((registro) => {
        if (!leiturasPorData.has(registro.data)) {
            leiturasPorData.set(registro.data, []);
        }
        leiturasPorData.get(registro.data).push(registro);
    });

    return Array.from(leiturasPorData, ([data, leituras]) => {
        // Se há amostras com horário, elas representam o dia melhor que o resumo diário antigo.
        const amostrasHorarias = leituras.filter((registro) => registro.instanteLeitura);
        const valores = (amostrasHorarias.length ? amostrasHorarias : leituras)
            .map((registro) => registro.valor);
        return {
            data,
            periodo: data,
            valor: valores.reduce((soma, valor) => soma + valor, 0) / valores.length
        };
    });
}

// Retorna as amostras de uma data na ordem em que foram medidas.
function obterSerieSensorPorHora(chaveGrandeza, data) {
    if (!data) {
        return [];
    }

    return obterLeiturasSensorNoIntervalo(chaveGrandeza)
        .filter((registro) => registro.data === data && registro.instanteLeitura)
        .map((registro) => ({
            data: registro.data,
            periodo: registro.instanteLeitura,
            valor: registro.valor
        }))
        .sort((primeiro, segundo) => primeiro.periodo.localeCompare(segundo.periodo));
}

// Atualiza as datas disponíveis e mostra o seletor de dia somente no modo por horário.
function atualizarControlesGraficosSensores() {
    seletoresSensoresLuz.forEach(({ chave, modoId, dataId, controleDataId }) => {
        const modo = document.getElementById(modoId);
        const seletorData = document.getElementById(dataId);
        const controleData = document.getElementById(controleDataId);
        const dataAnterior = seletorData.value;
        const datas = [...new Set(
            obterLeiturasSensorNoIntervalo(chave)
                .filter((registro) => registro.instanteLeitura)
                .map((registro) => registro.data)
        )].sort();

        seletorData.replaceChildren();
        datas.forEach((data) => {
            const opcao = document.createElement("option");
            opcao.value = data;
            opcao.textContent = new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });
            seletorData.appendChild(opcao);
        });

        if (datas.includes(dataAnterior)) {
            seletorData.value = dataAnterior;
        } else if (datas.length) {
            seletorData.value = datas[datas.length - 1];
        }
        controleData.hidden = modo.value !== "horas";
        seletorData.disabled = datas.length === 0;
    });
}

// Liga os combos dos sensores aos gráficos e mantém as datas válidas no intervalo.
function configurarControlesGraficosSensores() {
    seletoresSensoresLuz.forEach(({ modoId, dataId, canvasId }) => {
        document.getElementById(modoId).addEventListener("change", () => {
            atualizarControlesGraficosSensores();
            criarGrafico(document.getElementById(canvasId));
        });
        document.getElementById(dataId).addEventListener("change", () => {
            criarGrafico(document.getElementById(canvasId));
        });
    });
    atualizarControlesGraficosSensores();
}

// Cria um ponto para cada mês do intervalo, sem remover meses que ainda não têm dados.
function obterSerieHistoricaAgrupada(chaveGrandeza) {
    const leiturasPorMes = new Map();
    registrosHistorico
        .filter((registro) =>
            registro.tipo === "mensal" &&
            registro.chaveGrandeza === chaveGrandeza
        )
        .forEach((registro) => {
            const periodo = registro.data.slice(0, 7);
            const primeiroDia = `${periodo}-01`;
            const [ano, mes] = periodo.split("-").map(Number);
            const ultimoDia = formatarDataHistorico(ano, mes - 1, new Date(ano, mes, 0).getDate());
            if (
                ultimoDia < intervaloPeriodoAplicado.inicio ||
                primeiroDia > intervaloPeriodoAplicado.fim
            ) {
                return;
            }

            const anterior = leiturasPorMes.get(periodo);
            if (!anterior || registro.capturadoEm > anterior.capturadoEm) {
                leiturasPorMes.set(periodo, registro);
            }
        });

    const inicio = new Date(`${intervaloPeriodoAplicado.inicio}T00:00:00`);
    const fim = new Date(`${intervaloPeriodoAplicado.fim}T00:00:00`);
    const primeiroMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const ultimoMes = new Date(fim.getFullYear(), fim.getMonth(), 1);
    const serieCompleta = [];

    // Percorre calendário mês a mês para manter todos os meses entre os limites visíveis.
    for (const cursor = new Date(primeiroMes); cursor <= ultimoMes; cursor.setMonth(cursor.getMonth() + 1)) {
        const periodo = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
        const leitura = leiturasPorMes.get(periodo);
        serieCompleta.push({
            periodo,
            valor: leitura ? leitura.valor : null
        });
    }

    return serieCompleta;
}

// Atualiza cards do resumo apenas com medições disponíveis no intervalo escolhido.
function atualizarIndicadoresFiltrados() {
    const intervalo = intervaloPeriodoAplicado;
    const consumoDiario = obterRegistrosDiariosFiltrados("consumo", intervalo);
    const somaConsumo = consumoDiario.reduce((total, registro) => total + registro.valor, 0);
    const mediaDiaria = consumoDiario.length ? somaConsumo / consumoDiario.length : null;
    const inicio = new Date(`${intervalo.inicio}T00:00:00`);
    const fim = new Date(`${intervalo.fim}T00:00:00`);
    const inicioUtc = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const fimUtc = Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate());
    const diasNoIntervalo = Math.floor((fimUtc - inicioUtc) / 86400000) + 1;

    // Só soma custos de meses inteiros dentro do período para evitar prorratear valores.
    const custosPorMes = new Map();
    registrosHistorico
        .filter((registro) => registro.tipo === "resumo" && registro.chaveGrandeza === "custo")
        .forEach((registro) => {
            const ano = Number(registro.data.slice(0, 4));
            const mes = Number(registro.data.slice(5, 7)) - 1;
            const inicioMes = formatarDataHistorico(ano, mes, 1);
            const fimMes = formatarDataHistorico(ano, mes, new Date(ano, mes + 1, 0).getDate());
            if (inicioMes < intervalo.inicio || fimMes > intervalo.fim) {
                return;
            }

            const periodo = registro.data.slice(0, 7);
            const existente = custosPorMes.get(periodo);
            if (!existente || registro.capturadoEm > existente.capturadoEm) {
                custosPorMes.set(periodo, registro);
            }
        });

    const custoTotal = Array.from(custosPorMes.values())
        .reduce((total, registro) => total + registro.valor, 0);
    const formatarConsumo = (valor) => valor === null
        ? "—"
        : `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`;

    document.getElementById("cardCustoTotal").textContent = custosPorMes.size
        ? custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "—";
    document.getElementById("variacaoCustoTotal").textContent = custosPorMes.size
        ? `${custosPorMes.size} ${custosPorMes.size === 1 ? "mês completo" : "meses completos"}`
        : "Sem mês completo com custo registrado";
    document.getElementById("cardConsumoDiario").textContent = formatarConsumo(mediaDiaria);
    document.getElementById("variacaoConsumoDiario").textContent = consumoDiario.length
        ? `Média de ${consumoDiario.length} ${consumoDiario.length === 1 ? "dia medido" : "dias medidos"}`
        : "Sem medições diárias";
    document.getElementById("cardConsumoMensal").textContent = formatarConsumo(consumoDiario.length ? somaConsumo : null);
    document.getElementById("variacaoConsumoMensal").textContent = consumoDiario.length
        ? `Soma dos dias medidos no intervalo`
        : "Sem medições diárias";

    const status = document.getElementById("statusFiltroPeriodo");
    if (consumoDiario.length) {
        const diasComDados = consumoDiario.length === 1 ? "1 dia" : `${consumoDiario.length} dias`;
        status.textContent = `${intervalo.inicio.split("-").reverse().join("/")} a ${intervalo.fim.split("-").reverse().join("/")} · dados disponíveis em ${diasComDados} de ${diasNoIntervalo}.`;
    } else {
        status.textContent = `Nenhuma medição diária disponível entre ${intervalo.inicio.split("-").reverse().join("/")} e ${intervalo.fim.split("-").reverse().join("/")}.`;
    }
}

// Preenche as datas dos atalhos; o usuário ainda aplica o novo intervalo pelo botão.
function preencherDatasAtalhoPeriodo(atalho) {
    const agora = new Date();
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    let inicio;

    if (atalho === "mes-atual") {
        inicio = new Date(fim.getFullYear(), fim.getMonth(), 1);
    } else if (atalho === "7" || atalho === "30" || atalho === "90") {
        inicio = new Date(fim);
        inicio.setDate(inicio.getDate() - Number(atalho) + 1);
    } else {
        return;
    }

    document.getElementById("dataInicioPeriodo").value = formatarDataHistorico(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    document.getElementById("dataFimPeriodo").value = formatarDataHistorico(fim.getFullYear(), fim.getMonth(), fim.getDate());
}

// Valida e aplica o intervalo às métricas, à comparação e aos gráficos históricos.
function aplicarFiltroPeriodo() {
    const inicio = document.getElementById("dataInicioPeriodo").value;
    const fim = document.getElementById("dataFimPeriodo").value;
    const status = document.getElementById("statusFiltroPeriodo");

    if (!inicio || !fim) {
        status.textContent = "Informe as duas datas para aplicar o filtro.";
        return;
    }
    if (inicio > fim) {
        status.textContent = "A data inicial precisa ser anterior ou igual à data final.";
        return;
    }
    const hoje = new Date();
    const hojeFormatado = formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    if (fim > hojeFormatado) {
        status.textContent = "A data final não pode estar no futuro.";
        return;
    }

    intervaloPeriodoAplicado = { inicio, fim };
    atualizarMesesGraficoDiario();
    atualizarControlesGraficosSensores();
    atualizarIndicadoresFiltrados();
    renderizarComparacaoHistorico(obterConsumosMensaisHistoricos());
    desenharGraficos();
    desenharGraficoEnergiaAcumulada();
    return true;
}

// Liga os atalhos e os campos personalizados ao mesmo intervalo aplicado.
function configurarFiltroPeriodo() {
    const atalho = document.getElementById("atalhoPeriodo");
    const dataInicio = document.getElementById("dataInicioPeriodo");
    const dataFim = document.getElementById("dataFimPeriodo");
    const hoje = new Date();
    const hojeFormatado = formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    preencherDatasAtalhoPeriodo("mes-atual");
    dataInicio.max = hojeFormatado;
    dataFim.max = hojeFormatado;
    atalho.addEventListener("change", () => {
        if (atalho.value !== "personalizado") {
            preencherDatasAtalhoPeriodo(atalho.value);
        }
    });
    [dataInicio, dataFim].forEach((campo) => {
        campo.addEventListener("change", () => {
            atalho.value = "personalizado";
        });
    });
    document.getElementById("btnAplicarPeriodo").addEventListener("click", () => {
        if (aplicarFiltroPeriodo()) {
            carregarDadosDashboard();
        }
    });
    document.getElementById("btnResetarPeriodo").addEventListener("click", () => {
        atalho.value = "mes-atual";
        preencherDatasAtalhoPeriodo("mes-atual");
        if (aplicarFiltroPeriodo()) {
            carregarDadosDashboard();
        }
    });
    document.getElementById("mesGraficoDiario").addEventListener("change", () => {
        const graficoDiario = document.getElementById("meuGrafico2");
        if (graficoDiario.clientWidth > 0) {
            criarGrafico(graficoDiario);
        }
    });
    document.getElementById("modoGraficoDiario").addEventListener("change", () => {
        atualizarMesesGraficoDiario();
        const graficoDiario = document.getElementById("meuGrafico2");
        if (graficoDiario.clientWidth > 0) {
            criarGrafico(graficoDiario);
        }
    });
    document.getElementById("dataGraficoDiario").addEventListener("change", () => {
        const graficoDiario = document.getElementById("meuGrafico2");
        if (graficoDiario.clientWidth > 0) {
            criarGrafico(graficoDiario);
        }
    });

    // Inicializa o estado aplicado com o mês atual para manter os cards sincronizados.
    intervaloPeriodoAplicado = {
        inicio: formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), 1),
        fim: formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    };
    atualizarMesesGraficoDiario();
}

// Atualiza os cards com formatação brasileira e variações recebidas pela API.
function atualizarIndicadores() {
    if (intervaloPeriodoAplicado) {
        atualizarIndicadoresFiltrados();
        return;
    }
    const formatarConsumo = (valor) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`;
    const formatarVariacao = (valor) => `${valor > 0 ? "+" : ""}${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% no período`;

    document.getElementById("cardCustoTotal").textContent = resumoConsumo.totalCostBrl.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
    document.getElementById("cardConsumoDiario").textContent = formatarConsumo(resumoConsumo.dailyConsumptionKwh);
    document.getElementById("cardConsumoMensal").textContent = formatarConsumo(resumoConsumo.monthlyConsumptionKwh);
    document.getElementById("variacaoConsumoDiario").textContent = formatarVariacao(resumoConsumo.dailyChangePercent);
    document.getElementById("variacaoConsumoMensal").textContent = formatarVariacao(resumoConsumo.monthlyChangePercent);
}

// Exibe o estado atual do serviço junto aos indicadores.
function atualizarStatusApi(mensagem, tipo = "") {
    const status = document.getElementById("statusApi");
    status.textContent = mensagem;
    status.className = `api-status${tipo ? ` is-${tipo}` : ""}`;
}

// Busca e valida os dados para o mês e ano selecionados.
async function carregarDadosDashboard() {
    const baseUrl = API_CONFIG.baseUrl.trim();
    const botaoExportar = document.getElementById("btnExportarHistorico");

    if (!baseUrl) {
        atualizarStatusApi("Exibindo dados de demonstração. Configure a URL em api-config.js para conectar a API.", "demo");
        carregarEstadoDemonstrativo();
        atualizarIndicadores();
        desenharGraficos();
        return;
    }

    if (requisicaoAtual) {
        requisicaoAtual.abort();
    }

    const controlador = new AbortController();
    requisicaoAtual = controlador;
    // Reúne os meses do intervalo para carregar também as séries diárias intermediárias.
    const primeiroDia = new Date(`${intervaloPeriodoAplicado.inicio}T00:00:00`);
    const ultimoDia = new Date(`${intervaloPeriodoAplicado.fim}T00:00:00`);
    const mesesDoPeriodo = [];
    for (
        const cursor = new Date(primeiroDia.getFullYear(), primeiroDia.getMonth(), 1);
        cursor <= ultimoDia;
        cursor.setMonth(cursor.getMonth() + 1)
    ) {
        mesesDoPeriodo.push({ ano: cursor.getFullYear(), mes: cursor.getMonth() });
    }
    const ultimoMes = mesesDoPeriodo[mesesDoPeriodo.length - 1];
    const mesesAConsultar = mesesDoPeriodo.filter(({ ano, mes }, indice) => {
        if (indice === mesesDoPeriodo.length - 1) {
            return true;
        }

        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const dadosDoMes = registrosHistorico.filter((registro) =>
            registro.tipo === "diario" &&
            registro.origem === "API" &&
            registro.data.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}-`)
        );
        const diasPorGrandeza = new Map();
        dadosDoMes.forEach((registro) => {
            if (!diasPorGrandeza.has(registro.chaveGrandeza)) {
                diasPorGrandeza.set(registro.chaveGrandeza, new Set());
            }
            diasPorGrandeza.get(registro.chaveGrandeza).add(registro.data);
        });

        return ["consumo", "tensao", "corrente", "potencia"]
            .some((chave) => (diasPorGrandeza.get(chave)?.size || 0) < diasNoMes);
    });
    const botaoAtualizar = document.getElementById("btnAtualizarDados");
    botaoAtualizar.disabled = true;
    atualizarStatusApi(`Carregando dados de ${mesesAConsultar.length} ${mesesAConsultar.length === 1 ? "mês" : "meses"} do intervalo...`, "loading");

    try {
        let dadosMesFinal = null;
        for (const [indice, { ano, mes }] of mesesAConsultar.entries()) {
            const temporizador = window.setTimeout(() => controlador.abort(), API_CONFIG.timeoutMs);
            try {
                const enderecoBase = `${baseUrl.replace(/\/+$/, "")}/`;
                const enderecoApi = new URL(API_CONFIG.dashboardPath.replace(/^\/+/, ""), enderecoBase);
                enderecoApi.searchParams.set("year", String(ano));
                enderecoApi.searchParams.set("month", String(mes + 1));

                // Inclui cookies de sessão se o backend autenticar a API dessa maneira.
                const respostaHttp = await fetch(enderecoApi, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                    cache: "no-store",
                    signal: controlador.signal
                });

                if (!respostaHttp.ok) {
                    throw new Error(`A API respondeu com HTTP ${respostaHttp.status} ao consultar ${String(mes + 1).padStart(2, "0")}/${ano}.`);
                }

                const dados = normalizarRespostaApi(await respostaHttp.json(), mes, ano);
                Object.assign(seriesGrandezas, dados.metricas);
                resumoConsumo = dados.resumo;
                registrarHistorico(mes, ano, "API", false, dados.estadoAtual);
                if (ano === ultimoMes.ano && mes === ultimoMes.mes) {
                    dadosMesFinal = dados;
                }
            } finally {
                window.clearTimeout(temporizador);
            }

            atualizarStatusApi(`Carregando dados históricos: ${indice + 1} de ${mesesAConsultar.length} meses...`, "loading");
        }

        if (!dadosMesFinal) {
            throw new Error("Não foi possível carregar os dados do mês final do intervalo.");
        }

        Object.assign(seriesGrandezas, dadosMesFinal.metricas);
        dadosConsumoMensal = dadosMesFinal.metricas.consumo.mensal;
        dadosConsumoDiario = dadosMesFinal.metricas.consumo.diario;
        resumoConsumo = dadosMesFinal.resumo;
        estadoAtual = dadosMesFinal.estadoAtual;
        registrarLeituraEnergia(estadoAtual);
        dadosReaisCarregados = true;
        periodoDadosCarregados = ultimoMes;
        atualizarEstadoAtual();
        atualizarIndicadores();
        atualizarMesesGraficoDiario();
        atualizarControlesGraficosSensores();
        desenharGraficos();
        botaoExportar.disabled = false;
        atualizarStatusApi(`Dados do intervalo atualizados às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`, "success");
    } catch (erro) {
        atualizarIndicadores();
        desenharGraficos();
        if (erro.name !== "AbortError") {
            const periodoAnterior = periodoDadosCarregados
                ? ` Último período válido: ${String(periodoDadosCarregados.mes + 1).padStart(2, "0")}/${periodoDadosCarregados.ano}.`
                : " Nenhum dado real foi carregado ainda.";
            atualizarStatusApi(`${erro.message}${periodoAnterior} Confira a URL e o contrato descrito em API.md.`, "error");
        } else if (requisicaoAtual === controlador) {
            atualizarStatusApi("A API demorou para responder. Tente atualizar novamente.", "error");
        }
    } finally {
        if (requisicaoAtual === controlador) {
            requisicaoAtual = null;
            botaoAtualizar.disabled = false;
            botaoExportar.disabled = registrosHistorico.length === 0;
        }
    }
}

function desenharGraficos() {
    // Atualiza todos os canvases, inclusive após mudar o período ou redimensionar a tela.
    document.querySelectorAll(".tooltip-grafico").forEach((tooltip) => {
        tooltip.hidden = true;
    });

    // Não mostra séries de demonstração quando a API está configurada e ainda carrega.
    if (API_CONFIG.baseUrl.trim() && !dadosReaisCarregados && !intervaloPeriodoAplicado) {
        return;
    }

    canvases.forEach((canvas) => {
        if (canvas.clientWidth > 0) {
            criarGrafico(canvas);
        }
    });
}

// Prepara os filtros antes do primeiro desenho para que já usem o período atual.
document.addEventListener("DOMContentLoaded", () => {
    configurarFiltroPeriodo();
    configurarInteracaoGraficos();
    configurarSelecaoGraficos();
    configurarSelecaoGrandeza();
    configurarControlesGraficosSensores();
    configurarExportacaoHistorico();
    configurarComparacaoHistorico();
    inicializarFiltrosHistorico();
    carregarEnergiaAcumulada();
    carregarHistoricoSalvo();
    aplicarFiltroPeriodo();
    document.getElementById("btnAtualizarDados").addEventListener("click", carregarDadosDashboard);
    carregarDadosDashboard();
    // Consulta a API periodicamente para acompanhar o consumo sem depender de atualização manual.
    window.setInterval(() => {
        if (!document.hidden) {
            carregarDadosDashboard();
        }
    }, 60_000);
});
window.addEventListener("resize", () => {
    desenharGraficos();
    desenharGraficoEnergiaAcumulada();
});