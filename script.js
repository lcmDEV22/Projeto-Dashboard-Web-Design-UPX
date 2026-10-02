const canvases = [
    document.getElementById("meuGrafico"),
    document.getElementById("meuGrafico2")
].filter(Boolean);
const dadosGraficos = new Map();
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
    filtroMes.addEventListener("change", desenharGraficos);
    filtroAno.addEventListener("change", desenharGraficos);
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

    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const consumoMensal = [4200, 5100, 4800, 6200, 5900, 7100, 6800, 7900, 8300, 9100, 8700, 9800];
    // Série de exemplo diária; ela é limitada ao número de dias do período escolhido.
    const consumoDiario = [
        320, 350, 295, 410, 375, 430, 390, 460, 425, 510,
        480, 445, 530, 495, 560, 520, 475, 590, 545, 610,
        575, 630, 590, 660, 620, 690, 645, 710, 675, 735, 700
    ];
    const isGraficoDiario = canvas.id === "meuGrafico2";
    let dias = [];
    let valoresDiarios = consumoDiario;
    let mesSelecionado = null;
    let anoSelecionado = null;

    if (isGraficoDiario) {
        mesSelecionado = Number(document.getElementById("filtroMesDiario").value);
        anoSelecionado = Number(document.getElementById("filtroAnoDiario").value);

        // O dia zero do próximo mês informa quantos dias existem no mês selecionado.
        const quantidadeDias = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
        dias = Array.from({ length: quantidadeDias }, (_, index) => String(index + 1));
        valoresDiarios = consumoDiario.slice(0, quantidadeDias);
    }

    const labels = isGraficoDiario ? dias : meses;
    const valores = isGraficoDiario ? valoresDiarios : consumoMensal;
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
        mes: mesSelecionado,
        ano: anoSelecionado
    });

    ctx.clearRect(0, 0, largura, altura);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.fillStyle = "#777";
    ctx.font = "12px Poppins, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Valores em kWh", margemEsquerda, 16);

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

    tooltip.textContent = `${periodo}: ${ponto.valor.toLocaleString("pt-BR")} kWh`;
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

function desenharGraficos() {
    // Atualiza todos os canvases, inclusive após mudar o período ou redimensionar a tela.
    document.querySelectorAll(".tooltip-grafico").forEach((tooltip) => {
        tooltip.hidden = true;
    });
    canvases.forEach(criarGrafico);
}

// Prepara os filtros antes do primeiro desenho para que já usem o período atual.
document.addEventListener("DOMContentLoaded", () => {
    configurarFiltrosDiarios();
    configurarInteracaoGraficos();
    desenharGraficos();
});
window.addEventListener("resize", desenharGraficos);