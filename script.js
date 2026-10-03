const canvases = [
    document.getElementById("meuGrafico"),
    document.getElementById("meuGrafico2")
].filter(Boolean);
const dadosGraficos = new Map();
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dadosDemoMensais = [4200, 5100, 4800, 6200, 5900, 7100, 6800, 7900, 8300, 9100, 8700, 9800];
const dadosDemoDiarios = [
    320, 350, 295, 410, 375, 430, 390, 460, 425, 510,
    480, 445, 530, 495, 560, 520, 475, 590, 545, 610,
    575, 630, 590, 660, 620, 690, 645, 710, 675, 735, 700
];
const CHAVE_HISTORICO = "dashboardHistoricalReadings";
const LIMITE_REGISTROS_HISTORICO = 5000;
let registrosHistorico = [];
let avisoHistorico = "";
let intervaloPeriodoAplicado = null;

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

    // Oculta a escolha mensal quando o intervalo contém somente um mês.
    document.getElementById("controleMesGraficoDiario").hidden = meses.length <= 1;
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
    const serieSelecionada = seriesGrandezas[grandezaSelecionada];
    let dias = [];
    let valoresDiarios = serieSelecionada.diario;
    let labels;
    let valores;
    let pontosHistoricos = null;
    let mesSelecionado = null;
    let anoSelecionado = null;

    if (intervaloPeriodoAplicado) {
        // O gráfico diário mostra todos os dias do mês escolhido, com lacunas sem dados preservadas.
        const leituras = isGraficoDiario
            ? obterSerieDiariaMensal(grandezaSelecionada)
            : obterSerieHistoricaAgrupada(grandezaSelecionada);
        pontosHistoricos = leituras;
        labels = leituras.map((registro) => {
            const data = isGraficoDiario ? registro.data : `${registro.periodo}-01`;
            const [ano, mes, dia] = data.split("-").map(Number);
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
        ? isGraficoDiario ? Math.max(1, Math.ceil(labels.length / 8)) : 1
        : isGraficoDiario ? 5 : 1;

    // Reserva espaço para os eixos e calcula a escala vertical do gráfico.
    const margemEsquerda = 55;
    const margemDireita = 20;
    const margemSuperior = 38;
    const margemInferior = 45;
    const larguraGrafico = largura - margemEsquerda - margemDireita;
    const alturaGrafico = altura - margemSuperior - margemInferior;
    const maiorValor = Math.max(1, ...valores.filter(Number.isFinite));
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
        ctx.fillText("Sem medições nesta faixa de datas.", largura / 2, altura / 2);
        atualizarStatusGrafico(canvas.id, 0, labels.length);
        return;
    }

    // Guarda as coordenadas de cada dado para localizar o trecho sob o ponteiro.
    const pontos = valores.map((valor, index) => ({
        x: labels.length === 1
            ? margemEsquerda + larguraGrafico / 2
            : margemEsquerda + (larguraGrafico / (labels.length - 1)) * index,
        y: Number.isFinite(valor) ? margemSuperior + alturaGrafico - (valor / maiorValor) * alturaGrafico : null,
        valor,
        indice: index,
        dia: index + 1,
        periodo: pontosHistoricos ? (isGraficoDiario ? pontosHistoricos[index].data : pontosHistoricos[index].periodo) : null
    }));

    // Armazena os dados e a posição de cada canvas para alimentar seu tooltip.
    dadosGraficos.set(canvas.id, {
        pontos,
        tipo: intervaloPeriodoAplicado ? "intervalo" : isGraficoDiario ? "diario" : "mensal",
        grandeza: serieSelecionada.nome,
        unidade: serieSelecionada.unidade,
        mes: mesSelecionado,
        ano: anoSelecionado,
        periodicidade: isGraficoDiario ? "diario" : "mensal"
    });
    if (isGraficoDiario && intervaloPeriodoAplicado) {
        const limites = obterLimitesMesDiario();
        const diasComDados = valores.filter(Number.isFinite).length;
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
    if (intervaloPeriodoAplicado && !isGraficoDiario && labels.length > 8) {
        ctx.font = "8px Poppins, sans-serif";
    }
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

// Exibe o período e o consumo corretos para a série mensal ou diária.
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

    if (dadosGrafico.tipo === "intervalo" && dadosGrafico.periodicidade === "diario") {
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

            // O canvas precisa estar visível para medir sua largura antes de desenhar.
            const canvas = document.querySelector(`#${painelSelecionado} canvas`);
            if (canvas && (!API_CONFIG.baseUrl.trim() || dadosReaisCarregados || intervaloPeriodoAplicado)) {
                criarGrafico(canvas);
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

    return ["diario", "mensal", "resumo"].includes(registro.tipo) &&
        dataValida &&
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
        atualizarStatusHistorico(`${registrosHistorico.length.toLocaleString("pt-BR")} registros recuperados deste navegador.`);
    } catch (erro) {
        registrosHistorico = [];
        avisoHistorico = `Não foi possível ler o histórico salvo: ${erro.message}`;
        atualizarStatusHistorico("Nenhum registro anterior foi recuperado.");
    }

    renderizarHistorico();
}

// Converte uma data local em formato ISO sem deslocar o dia por fuso horário.
function formatarDataHistorico(ano, mes, dia) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Guarda snapshots mensais e diários com a data consultada e a hora da captura.
function registrarHistorico(mes, ano, origem, atualizarInterface = true) {
    const capturadoEm = new Date().toISOString();
    const hoje = new Date();
    const limiteDemo = formatarDataHistorico(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const novosRegistros = [];

    Object.entries(seriesGrandezas).forEach(([chave, serie]) => {
        serie.mensal.forEach((valor, indice) => {
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
            const data = formatarDataHistorico(ano, mes, indice + 1);
            if (origem === "Demonstração" && data > limiteDemo) {
                return;
            }
            novosRegistros.push({
                tipo: "diario",
                data,
                grandeza: serie.nome,
                chaveGrandeza: chave,
                valor,
                unidade: serie.unidade,
                capturadoEm,
                origem
            });
        });
    });

    // Atualiza a leitura mais recente do mesmo dia, métrica e origem sem duplicar a tabela.
    const registrosPorChave = new Map(registrosHistorico
        .filter((registro) => !(registro.origem === "Demonstração" && registro.data > limiteDemo))
        .map((registro) => [
            `${registro.tipo}|${registro.data}|${registro.chaveGrandeza}|${registro.origem}`,
            registro
        ]));
    novosRegistros.forEach((registro) => {
        const chave = `${registro.tipo}|${registro.data}|${registro.chaveGrandeza}|${registro.origem}`;
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
        renderizarHistorico();
        if (intervaloPeriodoAplicado) {
            atualizarIndicadores();
            desenharGraficos();
        }
    }
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
            const [ano, mes] = periodo.split("-").map(Number);
            const primeiroDia = formatarDataHistorico(ano, mes - 1, 1);
            const ultimoDia = formatarDataHistorico(ano, mes - 1, new Date(ano, mes, 0).getDate());
            if (intervaloPeriodoAplicado && (
                ultimoDia < intervaloPeriodoAplicado.inicio ||
                primeiroDia > intervaloPeriodoAplicado.fim
            )) {
                return;
            }
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

// Renderiza uma amostra recente e os dados de comparação a partir do histórico local.
function renderizarHistorico() {
    const tabela = document.getElementById("listaHistorico");
    if (!tabela) {
        return;
    }

    const periodos = obterConsumosMensaisHistoricos();
    const legenda = document.getElementById("legendaHistorico");
    atualizarOpcoesComparacao(periodos);
    renderizarComparacaoHistorico(periodos);
    tabela.replaceChildren();

    const registrosRecentes = [...registrosHistorico]
        .sort((primeiro, segundo) => segundo.capturadoEm.localeCompare(primeiro.capturadoEm))
        .slice(0, 50);
    legenda.textContent = registrosHistorico.length > registrosRecentes.length
        ? `Registros mais recentes (50 de ${registrosHistorico.length.toLocaleString("pt-BR")})`
        : "Registros mais recentes";

    if (registrosRecentes.length === 0) {
        const linha = document.createElement("tr");
        const celula = document.createElement("td");
        celula.className = "historico-vazio";
        celula.colSpan = 5;
        celula.textContent = "Nenhum registro guardado ainda. Atualize os dados para iniciar o histórico.";
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
}

// Exporta todos os registros guardados, incluindo os horários e a origem dos dados.
function exportarHistorico() {
    if (registrosHistorico.length === 0) {
        document.getElementById("statusExportacao").textContent = "Não há registros históricos para exportar.";
        return;
    }

    const linhas = [["Tipo", "Data do período", "Grandeza", "Valor", "Unidade", "Coletado em", "Origem"]];
    [...registrosHistorico]
        .sort((primeiro, segundo) => primeiro.data.localeCompare(segundo.data))
        .forEach((registro) => {
            linhas.push([
                registro.tipo,
                registro.data,
                registro.grandeza,
                String(registro.valor),
                registro.unidade,
                registro.capturadoEm,
                registro.origem
            ]);
        });

    // Usa ponto e vírgula e BOM para abrir acentos corretamente em planilhas locais.
    const conteudoCsv = `\uFEFF${linhas.map((linha) => linha.join(";")).join("\r\n")}`;
    const arquivo = new Blob([conteudoCsv], { type: "text/csv;charset=utf-8;" });
    const enderecoArquivo = URL.createObjectURL(arquivo);
    const linkDownload = document.createElement("a");
    const status = document.getElementById("statusExportacao");

    linkDownload.href = enderecoArquivo;
    linkDownload.download = "historico-consumo.csv";
    document.body.appendChild(linkDownload);
    linkDownload.click();
    linkDownload.remove();
    window.setTimeout(() => URL.revokeObjectURL(enderecoArquivo), 1000);
    status.textContent = "Histórico completo exportado em CSV.";
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
    atualizarIndicadoresFiltrados();
    renderizarComparacaoHistorico(obterConsumosMensaisHistoricos());
    desenharGraficos();
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
        const [anoSelecionado, mesSelecionado] = intervaloPeriodoAplicado.fim.split("-").map(Number);
        registrarHistorico(
            mesSelecionado - 1,
            anoSelecionado,
            "Demonstração"
        );
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
                registrarHistorico(mes, ano, "API", false);
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
        dadosReaisCarregados = true;
        periodoDadosCarregados = ultimoMes;
        atualizarEstadoAtual();
        atualizarIndicadores();
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
    configurarExportacaoHistorico();
    configurarComparacaoHistorico();
    carregarHistoricoSalvo();
    aplicarFiltroPeriodo();
    document.getElementById("btnAtualizarDados").addEventListener("click", carregarDadosDashboard);
    carregarDadosDashboard();
});
window.addEventListener("resize", desenharGraficos);