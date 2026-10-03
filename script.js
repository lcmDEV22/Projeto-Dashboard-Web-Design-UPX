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

// Configura os seletores do gráfico diário com o mês atual e anos próximos.
function configurarFiltrosDiarios() {
    const filtroMes = document.getElementById("filtroMesDiario");
    const filtroAno = document.getElementById("filtroAnoDiario");

    if (!filtroMes || !filtroAno) {
        return;
    }

    const anoAtual = new Date().getFullYear();

    nomesMeses.forEach((mes, index) => {
        const opcao = document.createElement("option");
        opcao.value = String(index);
        opcao.textContent = mes;
        filtroMes.appendChild(opcao);
    });

    // Oferece anos anteriores e o próximo para permitir comparar períodos.
    for (let ano = anoAtual - 10; ano <= anoAtual + 1; ano++) {
        const opcao = document.createElement("option");
        opcao.value = String(ano);
        opcao.textContent = String(ano);
        filtroAno.appendChild(opcao);
    }

    filtroMes.value = String(new Date().getMonth());
    filtroAno.value = String(anoAtual);
    filtroMes.addEventListener("change", atualizarDadosDashboard);
    filtroAno.addEventListener("change", atualizarDadosDashboard);
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

    const meses = nomesMeses.map((mes) => mes.slice(0, 3));
    const isGraficoDiario = canvas.id === "meuGrafico2";
    const serieSelecionada = seriesGrandezas[grandezaSelecionada];
    let dias = [];
    let valoresDiarios = serieSelecionada.diario;
    let mesSelecionado = null;
    let anoSelecionado = null;

    if (isGraficoDiario) {
        mesSelecionado = Number(document.getElementById("filtroMesDiario").value);
        anoSelecionado = Number(document.getElementById("filtroAnoDiario").value);

        // O dia zero do próximo mês informa quantos dias existem no mês selecionado.
        const quantidadeDias = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
        dias = Array.from({ length: quantidadeDias }, (_, index) => String(index + 1));
        valoresDiarios = serieSelecionada.diario.slice(0, quantidadeDias);
    }

    const labels = isGraficoDiario ? dias : meses;
    const valores = isGraficoDiario ? valoresDiarios : serieSelecionada.mensal;
    const intervaloRotulos = isGraficoDiario ? 5 : 1;

    // Reserva espaço para os eixos e calcula a escala vertical do gráfico.
    const margemEsquerda = 55;
    const margemDireita = 20;
    const margemSuperior = 38;
    const margemInferior = 45;
    const larguraGrafico = largura - margemEsquerda - margemDireita;
    const alturaGrafico = altura - margemSuperior - margemInferior;
    const maiorValor = Math.max(...valores);
    const quantidadeLinhas = 5;

    // Guarda as coordenadas de cada dado para localizar o trecho sob o ponteiro.
    const pontos = valores.map((valor, index) => ({
        x: margemEsquerda + (larguraGrafico / (labels.length - 1)) * index,
        y: margemSuperior + alturaGrafico - (valor / maiorValor) * alturaGrafico,
        valor,
        indice: index,
        dia: index + 1
    }));

    // Armazena os dados e a posição de cada canvas para alimentar seu tooltip.
    dadosGraficos.set(canvas.id, {
        pontos,
        tipo: isGraficoDiario ? "diario" : "mensal",
        grandeza: serieSelecionada.nome,
        unidade: serieSelecionada.unidade,
        mes: mesSelecionado,
        ano: anoSelecionado
    });

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
    const distancia = larguraGrafico / (labels.length - 1);
    ctx.textAlign = "center";
    labels.forEach((label, index) => {
        if (index % intervaloRotulos !== 0 && index !== labels.length - 1) {
            return;
        }
        ctx.fillText(label, margemEsquerda + distancia * index, altura - 15);
    });

    // Liga os pontos da série para formar a linha de consumo.
    ctx.beginPath();
    pontos.forEach((ponto, index) => {
        if (index === 0) {
            ctx.moveTo(ponto.x, ponto.y);
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
    if (!dadosGrafico || dadosGrafico.pontos.length < 2) {
        return null;
    }

    let resultado = null;

    for (let index = 0; index < dadosGrafico.pontos.length - 1; index++) {
        const inicio = dadosGrafico.pontos[index];
        const fim = dadosGrafico.pontos[index + 1];
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

    if (dadosGrafico.tipo === "diario") {
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
            if (canvas && (!API_CONFIG.baseUrl.trim() || dadosReaisCarregados)) {
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

// Carrega os registros anteriores sem ocultar erros de leitura do armazenamento.
function carregarHistoricoSalvo() {
    try {
        const salvo = localStorage.getItem(CHAVE_HISTORICO);
        registrosHistorico = salvo ? JSON.parse(salvo) : [];
        if (!Array.isArray(registrosHistorico)) {
            throw new Error("O histórico salvo não possui um formato válido.");
        }
        atualizarStatusHistorico(`${registrosHistorico.length.toLocaleString("pt-BR")} registros recuperados deste navegador.`);
    } catch (erro) {
        registrosHistorico = [];
        atualizarStatusHistorico(`Não foi possível ler o histórico deste navegador: ${erro.message}`);
    }

    renderizarHistorico();
}

// Converte uma data local em formato ISO sem deslocar o dia por fuso horário.
function formatarDataHistorico(ano, mes, dia) {
    return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Guarda snapshots mensais e diários com a data consultada e a hora da captura.
function registrarHistorico(mes, ano, origem) {
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

    renderizarHistorico();
}

// Atualiza o texto de estado da área de histórico.
function atualizarStatusHistorico(mensagem) {
    const status = document.getElementById("statusHistorico");
    if (status) {
        status.textContent = mensagem;
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

// Atualiza os cards com formatação brasileira e variações recebidas pela API.
function atualizarIndicadores() {
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

// Acrescenta os anos informados pela API sem remover os anos padrão do seletor.
function adicionarAnosDisponiveis(anos) {
    const filtroAno = document.getElementById("filtroAnoDiario");
    const anosExistentes = new Set(Array.from(filtroAno.options, (opcao) => Number(opcao.value)));

    anos.forEach((ano) => {
        const anoNumerico = Number(ano);
        if (!Number.isInteger(anoNumerico) || anosExistentes.has(anoNumerico)) {
            return;
        }

        const opcao = document.createElement("option");
        opcao.value = String(anoNumerico);
        opcao.textContent = String(anoNumerico);
        filtroAno.appendChild(opcao);
        anosExistentes.add(anoNumerico);
    });

    Array.from(filtroAno.options)
        .sort((primeiro, segundo) => Number(primeiro.value) - Number(segundo.value))
        .forEach((opcao) => filtroAno.appendChild(opcao));
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
        registrarHistorico(
            Number(document.getElementById("filtroMesDiario").value),
            Number(document.getElementById("filtroAnoDiario").value),
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
    const temporizador = window.setTimeout(() => controlador.abort(), API_CONFIG.timeoutMs);
    const mes = Number(document.getElementById("filtroMesDiario").value);
    const ano = Number(document.getElementById("filtroAnoDiario").value);
    const botaoAtualizar = document.getElementById("btnAtualizarDados");
    botaoAtualizar.disabled = true;
    atualizarStatusApi("Carregando dados do serviço...", "loading");

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
            throw new Error(`A API respondeu com HTTP ${respostaHttp.status}.`);
        }

        const resposta = await respostaHttp.json();
        const dados = normalizarRespostaApi(resposta, mes, ano);

        Object.assign(seriesGrandezas, dados.metricas);
        dadosConsumoMensal = dados.metricas.consumo.mensal;
        dadosConsumoDiario = dados.metricas.consumo.diario;
        resumoConsumo = dados.resumo;
        estadoAtual = dados.estadoAtual;
        dadosReaisCarregados = true;
        periodoDadosCarregados = { mes, ano };
        adicionarAnosDisponiveis(dados.anos);
        registrarHistorico(mes, ano, "API");
        atualizarEstadoAtual();
        atualizarIndicadores();
        desenharGraficos();
        botaoExportar.disabled = false;
        atualizarStatusApi(`Dados atualizados às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`, "success");
    } catch (erro) {
        if (erro.name !== "AbortError") {
            const periodoAnterior = periodoDadosCarregados
                ? ` Último período válido: ${String(periodoDadosCarregados.mes + 1).padStart(2, "0")}/${periodoDadosCarregados.ano}.`
                : " Nenhum dado real foi carregado ainda.";
            atualizarStatusApi(`${erro.message}${periodoAnterior} Confira a URL e o contrato descrito em API.md.`, "error");
        } else if (requisicaoAtual === controlador) {
            atualizarStatusApi("A API demorou para responder. Tente atualizar novamente.", "error");
        }
    } finally {
        window.clearTimeout(temporizador);
        if (requisicaoAtual === controlador) {
            requisicaoAtual = null;
            botaoAtualizar.disabled = false;
            botaoExportar.disabled = registrosHistorico.length === 0;
        }
    }
}

// Recarrega a API ao mudar o período ou redesenha o modo demonstrativo.
function atualizarDadosDashboard() {
    if (API_CONFIG.baseUrl.trim()) {
        carregarDadosDashboard();
    } else {
        registrarHistorico(
            Number(document.getElementById("filtroMesDiario").value),
            Number(document.getElementById("filtroAnoDiario").value),
            "Demonstração"
        );
        desenharGraficos();
    }
}

function desenharGraficos() {
    // Atualiza todos os canvases, inclusive após mudar o período ou redimensionar a tela.
    document.querySelectorAll(".tooltip-grafico").forEach((tooltip) => {
        tooltip.hidden = true;
    });

    // Não mostra séries de demonstração quando a API está configurada e ainda carrega.
    if (API_CONFIG.baseUrl.trim() && !dadosReaisCarregados) {
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
    configurarFiltrosDiarios();
    configurarInteracaoGraficos();
    configurarSelecaoGraficos();
    configurarSelecaoGrandeza();
    configurarExportacaoHistorico();
    configurarComparacaoHistorico();
    carregarHistoricoSalvo();
    document.getElementById("btnAtualizarDados").addEventListener("click", carregarDadosDashboard);
    carregarDadosDashboard();
});
window.addEventListener("resize", desenharGraficos);