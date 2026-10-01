const canvases = [
    document.getElementById("meuGrafico"),
    document.getElementById("meuGrafico2")
].filter(Boolean);

function criarGrafico(canvas) {
    const ctx = canvas.getContext("2d");
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    const proporcao = window.devicePixelRatio || 1;

    canvas.width = largura * proporcao;
    canvas.height = altura * proporcao;
    ctx.scale(proporcao, proporcao);

    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const consumoMensal = [4200, 5100, 4800, 6200, 5900, 7100, 6800, 7900, 8300, 9100, 8700, 9800];
    const dias = Array.from({ length: 31 }, (_, index) => String(index + 1));
    const consumoDiario = [
        320, 350, 295, 410, 375, 430, 390, 460, 425, 510,
        480, 445, 530, 495, 560, 520, 475, 590, 545, 610,
        575, 630, 590, 660, 620, 690, 645, 710, 675, 735, 700
    ];
    const isGraficoDiario = canvas.id === "meuGrafico2";
    const labels = isGraficoDiario ? dias : meses;
    const valores = isGraficoDiario ? consumoDiario : consumoMensal;
    const intervaloRotulos = isGraficoDiario ? 5 : 1;

    const margemEsquerda = 55;
    const margemDireita = 20;
    const margemSuperior = 38;
    const margemInferior = 45;
    const larguraGrafico = largura - margemEsquerda - margemDireita;
    const alturaGrafico = altura - margemSuperior - margemInferior;
    const maiorValor = Math.max(...valores);
    const quantidadeLinhas = 5;

    ctx.clearRect(0, 0, largura, altura);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.fillStyle = "#777";
    ctx.font = "12px Poppins, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Valores em kWh", margemEsquerda, 16);

    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    for (let i = 0; i <= quantidadeLinhas; i++) {
        const y = margemSuperior + (alturaGrafico / quantidadeLinhas) * i;
        ctx.beginPath();
        ctx.moveTo(margemEsquerda, y);
        ctx.lineTo(largura - margemDireita, y);
        ctx.stroke();
    }

    ctx.fillStyle = "#777";
    ctx.font = "12px Poppins, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= quantidadeLinhas; i++) {
        const valor = maiorValor - (maiorValor / quantidadeLinhas) * i;
        const y = margemSuperior + (alturaGrafico / quantidadeLinhas) * i;
        ctx.fillText(Math.round(valor).toLocaleString("pt-BR"), margemEsquerda - 8, y + 4);
    }

    const distancia = larguraGrafico / (labels.length - 1);
    ctx.textAlign = "center";
    labels.forEach((label, index) => {
        if (index % intervaloRotulos !== 0 && index !== labels.length - 1) {
            return;
        }
        ctx.fillText(label, margemEsquerda + distancia * index, altura - 15);
    });

    ctx.beginPath();
    valores.forEach((valor, index) => {
        const x = margemEsquerda + distancia * index;
        const y = margemSuperior + alturaGrafico - (valor / maiorValor) * alturaGrafico;
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    valores.forEach((valor, index) => {
        const x = margemEsquerda + distancia * index;
        const y = margemSuperior + alturaGrafico - (valor / maiorValor) * alturaGrafico;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function desenharGraficos() {
    canvases.forEach(criarGrafico);
}

document.addEventListener("DOMContentLoaded", desenharGraficos);
window.addEventListener("resize", desenharGraficos);