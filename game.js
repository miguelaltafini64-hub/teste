/**
 * Simples Oval Racing - Game Engine
 * 
 * Controles:
 * W: Acelerar
 * S: Frear/Ré
 * A: Virar para a Direita (Conforme GDD)
 * D: Virar para a Esquerda (Conforme GDD)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lapDisplay = document.getElementById('lap-display');
const posDisplay = document.getElementById('pos-display');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');

// Configurações do Jogo
const CONFIG = {
    totalLaps: 5,
    trackCenterX: 400,
    trackCenterY: 300,
    outerRX: 360,
    outerRY: 260,
    innerRX: 220,
    innerRY: 120,
    friction: 0.98,
    turnSpeed: 0.05,
    acceleration: 0.2,
    maxSpeed: 6,
};

let gameState = 'START'; // START, RACING, FINISH
let cars = [];
let player = null;
let keys = {};

// Gerenciamento de Inputs
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

class Car {
    constructor(x, y, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.speed = 0;
        this.color = color;
        this.isPlayer = isPlayer;
        this.width = 40; // F1 cars are longer
        this.height = 20;
        this.laps = 0;
        this.checkpointPassed = false;
        this.targetAngle = 0; // Para IA
        this.aiOffset = Math.random() * 60 - 30; // Variância no traçado da IA
        this.aiSpeedFac = 0.85 + Math.random() * 0.25; // Variância na velocidade da IA
        this.finished = false;
    }

    update() {
        if (this.finished) return;

        if (this.isPlayer) {
            this.handleInput();
        } else {
            this.handleAI();
        }

        // Aplicar Movimento
        this.speed *= CONFIG.friction;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        this.checkCollisions();
        this.checkCheckpoints();
    }

    handleInput() {
        if (keys['w']) this.speed += CONFIG.acceleration;
        if (keys['s']) this.speed -= CONFIG.acceleration * 0.5;

        // Conforme GDD do usuário: A = Direita, D = Esquerda
        if (keys['a']) this.angle += CONFIG.turnSpeed * (this.speed > 0.5 ? 1 : this.speed / 0.5);
        if (keys['d']) this.angle -= CONFIG.turnSpeed * (this.speed > 0.5 ? 1 : this.speed / 0.5);

        if (this.speed > CONFIG.maxSpeed) this.speed = CONFIG.maxSpeed;
        if (this.speed < -CONFIG.maxSpeed / 2) this.speed = -CONFIG.maxSpeed / 2;
    }

    handleAI() {
        // IA segue um caminho elíptico no centro da pista
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;
        const currentAngle = Math.atan2(dy, dx);

        // Avançar o ângulo suavemente no sentido horário
        // Reduzimos o passo para a IA não "voar"
        const nextAngle = currentAngle + 0.04;
        const rx = (CONFIG.outerRX + CONFIG.innerRX) / 2 + this.aiOffset;
        const ry = (CONFIG.outerRY + CONFIG.innerRY) / 2 + this.aiOffset * 0.7;

        const targetX = CONFIG.trackCenterX + Math.cos(nextAngle) * rx;
        const targetY = CONFIG.trackCenterY + Math.sin(nextAngle) * ry;

        const angleToTarget = Math.atan2(targetY - this.y, targetX - this.x);

        // Interpolação de ângulo
        let diff = angleToTarget - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        this.angle += diff * 0.12;
        this.speed += CONFIG.acceleration * this.aiSpeedFac * 0.75;

        if (this.speed > CONFIG.maxSpeed * 0.9 * this.aiSpeedFac) {
            this.speed = CONFIG.maxSpeed * 0.9 * this.aiSpeedFac;
        }
    }

    checkCollisions() {
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;

        // Distância normalizada em relação à elipse (x²/rx² + y²/ry² = 1)
        const dOuter = (dx * dx) / (CONFIG.outerRX * CONFIG.outerRX) + (dy * dy) / (CONFIG.outerRY * CONFIG.outerRY);
        const dInner = (dx * dx) / (CONFIG.innerRX * CONFIG.innerRX) + (dy * dy) / (CONFIG.innerRY * CONFIG.innerRY);

        // Se sair da borda externa ou entrar na interna
        if (dOuter > 1 || dInner < 1) {
            this.speed *= 0.92; // Grama reduz velocidade

            // "Empurrar" de volta suavemente (opcional, mas evita trancar)
            if (dOuter > 1.1 || dInner < 0.9) {
                this.speed *= 0.8;
            }
        }
    }

    checkCheckpoints() {
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;

        // Checkpoint 1: Lado esquerdo (para garantir que deram a volta)
        if (dx < -250 && Math.abs(dy) < 150) {
            this.checkpointPassed = true;
        }

        // Linha de Chegada: Lado Direito (x > 220)
        // Detectar passagem pela linha vertical em x ~ 290 do centro (total x ~ 690)
        if (this.checkpointPassed && dx > 250 && dy > -50 && dy < 50) {
            this.laps++;
            this.checkpointPassed = false;

            if (this.isPlayer) {
                lapDisplay.innerText = `Volta: ${this.laps} / ${CONFIG.totalLaps}`;
            }

            if (this.laps >= CONFIG.totalLaps) {
                this.finished = true;
                if (this.isPlayer) endGame(true);
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // --- Desenho Estilo Formula 1 ---

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.width / 2 + 3, -this.height / 2 + 3, this.width, this.height);

        // Pneus (4)
        ctx.fillStyle = '#111';
        // Traseiros
        ctx.fillRect(-this.width / 2 + 5, -this.height / 2 - 2, 8, 6);
        ctx.fillRect(-this.width / 2 + 5, this.height / 2 - 4, 8, 6);
        // Dianteiros
        ctx.fillRect(this.width / 2 - 12, -this.height / 2 - 1, 6, 5);
        ctx.fillRect(this.width / 2 - 12, this.height / 2 - 4, 6, 5);

        // Corpo Principal (Chassi)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Nariz pontudo
        ctx.moveTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2 - 10, -5);
        ctx.lineTo(-this.width / 2 + 5, -8);
        ctx.lineTo(-this.width / 2, -8);
        ctx.lineTo(-this.width / 2, 8);
        ctx.lineTo(-this.width / 2 + 5, 8);
        ctx.lineTo(this.width / 2 - 10, 5);
        ctx.closePath();
        ctx.fill();

        // Asa Dianteira
        ctx.fillStyle = '#222';
        ctx.fillRect(this.width / 2 - 5, -this.height / 2 - 1, 3, this.height + 2);

        // Asa Traseira
        ctx.fillStyle = '#222';
        ctx.fillRect(-this.width / 2, -this.height / 2 - 2, 4, this.height + 4);

        // Cockpit (Capacete do Piloto)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-2, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#555'; // Visor
        ctx.fillRect(0, -2, 2, 4);

        // Detalhes de brilho
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

function initGame() {
    // Reposicionando carros na largada (lado direito da pista)
    // No asfalto entre innerRX(220) e outerRX(360), centrado em ~290
    const startX = CONFIG.trackCenterX + 290;
    cars = [
        new Car(startX, 300, '#ff3e3e', true),   // Player (Red)
        new Car(startX, 340, '#3e86ff', false),  // NPC 1 (Blue)
        new Car(startX, 260, '#00ff88', false),  // NPC 2 (Green)
        new Car(startX, 220, '#ffcc00', false),  // NPC 3 (Yellow)
    ];
    // Ajustar o ângulo inicial para apontar para "baixo" no sentido horário
    cars.forEach(c => c.angle = Math.PI / 2);

    player = cars[0];
    gameState = 'RACING';
    overlay.classList.add('hidden');
}

function endGame(win) {
    gameState = 'FINISH';
    overlay.classList.remove('hidden');
    overlayTitle.innerText = win ? 'Você Ganhou!' : 'Game Over';
    overlayMsg.innerText = win ? 'Parabéns pela vitória!' : 'Tente novamente.';
    startBtn.innerText = 'Reiniciar';
}

function drawTrack() {
    // Fundo (Grama)
    ctx.fillStyle = '#1e3d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Borda Externa (Muro/Zebra)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.outerRX + 5, CONFIG.outerRY + 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pista (Asfalto Profissional)
    const grd = ctx.createRadialGradient(CONFIG.trackCenterX, CONFIG.trackCenterY, 150, CONFIG.trackCenterX, CONFIG.trackCenterY, 400);
    grd.addColorStop(0, "#333");
    grd.addColorStop(1, "#222");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.outerRX, CONFIG.outerRY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Borda Interna (Grama Central)
    ctx.fillStyle = '#1e3d1a';
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.innerRX, CONFIG.innerRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Linhas da Pista
    ctx.setLineDash([15, 25]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, (CONFIG.outerRX + CONFIG.innerRX) / 2, (CONFIG.outerRY + CONFIG.innerRY) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Linha de Chegada (Agora no Asfalto à Direita)
    // x entre trackCenterX + innerRX e trackCenterX + outerRX
    const finishX = CONFIG.trackCenterX + CONFIG.innerRX;
    const finishWidth = CONFIG.outerRX - CONFIG.innerRX;
    const finishY = CONFIG.trackCenterY - 10;

    ctx.fillStyle = '#fff';
    ctx.fillRect(finishX, finishY, finishWidth, 20);

    // Padrão Quadriculado na Linha
    const step = 14;
    for (let i = 0; i < finishWidth / step; i++) {
        for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? '#000' : '#fff';
            ctx.fillRect(finishX + i * step, finishY + j * 10, step, 10);
        }
    }
}

function updatePosicionamento() {
    const sortedCars = [...cars].sort((a, b) => {
        if (a.laps !== b.laps) return b.laps - a.laps;

        // Calcular progresso na volta baseada no ângulo relativo ao centro
        // A linha de chegada está à direita (ângulo 0). 
        // Como corremos no sentido horário, o ângulo aumenta: 0 -> PI/2 -> PI -> -PI/2 -> 0
        let angA = Math.atan2(a.y - CONFIG.trackCenterY, a.x - CONFIG.trackCenterX);
        let angB = Math.atan2(b.y - CONFIG.trackCenterY, b.x - CONFIG.trackCenterX);

        // Normalizar ângulos para 0 a 2PI
        if (angA < 0) angA += Math.PI * 2;
        if (angB < 0) angB += Math.PI * 2;

        return angA - angB;
    });

    const playerPos = sortedCars.indexOf(player) + 1;
    const suffix = ["º", "st", "nd", "rd", "th"]; // Simplificado para PT-BR
    posDisplay.innerText = `Posição: ${playerPos}º`;

    if (sortedCars[0].finished && sortedCars[0] !== player && !player.finished) {
        // Se o líder terminou e não é o player, e o player ainda não terminou
        // Poderia ser Game Over, mas vamos deixar o player terminar a dele.
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawTrack();

    if (gameState === 'RACING') {
        cars.forEach(car => {
            car.update();
            car.draw();
        });
        updatePosicionamento();
    } else {
        cars.forEach(car => car.draw());
    }

    requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', () => {
    initGame();
});

// Início
gameLoop();
lapDisplay.innerText = `Volta: 0 / ${CONFIG.totalLaps}`;
