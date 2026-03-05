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
        this.width = 30;
        this.height = 15;
        this.laps = 0;
        this.checkpointPassed = false;
        this.targetAngle = 0; // Para IA
        this.aiOffset = Math.random() * 40 - 20; // Variância no traçado da IA
        this.aiSpeedFac = 0.9 + Math.random() * 0.2; // Variância na velocidade da IA
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
        if (keys['a']) this.angle += CONFIG.turnSpeed;
        if (keys['d']) this.angle -= CONFIG.turnSpeed;

        if (this.speed > CONFIG.maxSpeed) this.speed = CONFIG.maxSpeed;
        if (this.speed < -CONFIG.maxSpeed / 2) this.speed = -CONFIG.maxSpeed / 2;
    }

    handleAI() {
        // IA segue um caminho elíptico
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;
        const currentAngle = Math.atan2(dy, dx);
        
        // Avançar o ângulo suavemente
        const nextAngle = currentAngle + 0.05;
        const rx = (CONFIG.outerRX + CONFIG.innerRX) / 2 + this.aiOffset;
        const ry = (CONFIG.outerRY + CONFIG.innerRY) / 2 + this.aiOffset * 0.5;
        
        const targetX = CONFIG.trackCenterX + Math.cos(nextAngle) * rx;
        const targetY = CONFIG.trackCenterY + Math.sin(nextAngle) * ry;
        
        const angleToTarget = Math.atan2(targetY - this.y, targetX - this.x);
        
        // Interpolação de ângulo
        let diff = angleToTarget - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        this.angle += diff * 0.1;
        this.speed += CONFIG.acceleration * this.aiSpeedFac * 0.8;
        
        if (this.speed > CONFIG.maxSpeed * 0.95 * this.aiSpeedFac) {
            this.speed = CONFIG.maxSpeed * 0.95 * this.aiSpeedFac;
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
            this.speed *= 0.8; // Reduz velocidade ao tocar na grama/muro
            
            // "Empurrar" de volta suavemente (opcional, mas evita trancar)
            if (dOuter > 1.05 || dInner < 0.95) {
                this.speed = 0;
            }
        }
    }

    checkCheckpoints() {
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;
        
        // Usamos quadrantes para checkpoints simples
        // Checkpoint 1: Metade da pista (lado esquerdo)
        if (dx < -200 && Math.abs(dy) < 100) {
            this.checkpointPassed = true;
        }
        
        // Linha de Partida/Chegada: Lado Direito (x > 0)
        // Se cruzar x = 200 indo para cima ou para baixo (dependendo do sentido)
        // Vamos usar uma verificação de zona
        if (this.checkpointPassed && dx > 200 && Math.abs(dy) < 100) {
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

        // Sombrinha
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.width/2 + 2, -this.height/2 + 2, this.width, this.height);

        // Corpo do Carro
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-this.width/2, -this.height/2, this.width, this.height, 4);
        ctx.fill();

        // Janelas/Detalhes para parecer um carro
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(2, -this.height/2 + 2, 8, this.height - 4);
        
        // Luzes
        ctx.fillStyle = 'yellow';
        ctx.fillRect(this.width/2 - 2, -this.height/2 + 2, 2, 3);
        ctx.fillRect(this.width/2 - 2, this.height/2 - 5, 2, 3);

        ctx.restore();
    }
}

function initGame() {
    cars = [
        new Car(550, 300, '#ff3e3e', true),   // Player
        new Car(550, 340, '#3e86ff', false),  // NPC 1
        new Car(550, 260, '#00ff88', false),  // NPC 2
        new Car(550, 220, '#ffcc00', false),  // NPC 3
    ];
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
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Borda Externa (Muro)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.outerRX, CONFIG.outerRY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pista (Asfalto)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.outerRX, CONFIG.outerRY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Borda Interna
    ctx.fillStyle = '#2d5a27';
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.innerRX, CONFIG.innerRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.stroke();

    // Linhas da Pista (Zebra)
    ctx.setLineDash([20, 20]);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, (CONFIG.outerRX + CONFIG.innerRX) / 2, (CONFIG.outerRY + CONFIG.innerRY) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Linha de Chegada
    ctx.fillStyle = '#fff';
    ctx.fillRect(500, 250, 10, 100);
    for(let i=0; i<10; i++) {
        ctx.fillStyle = i%2 === 0 ? '#000' : '#fff';
        ctx.fillRect(500, 250 + i*10, 10, 10);
    }
}

function updatePosicionamento() {
    // Ordenar carros pela distância percorrida (aproximado por voltas + ângulo)
    const sortedCars = [...cars].sort((a, b) => {
        if (a.laps !== b.laps) return b.laps - a.laps;
        
        // Ângulo em relação ao centro (invertido pois corremos sentido horário/anti-horário)
        const angA = Math.atan2(a.y - CONFIG.trackCenterY, a.x - CONFIG.trackCenterX);
        const angB = Math.atan2(b.y - CONFIG.trackCenterY, b.x - CONFIG.trackCenterX);
        
        // Na nossa pista, o ângulo cresce no sentido horário. 
        // A linha de chegada está à direita (0 rad aprox).
        return angA - angB; 
    });

    const playerPos = sortedCars.indexOf(player) + 1;
    posDisplay.innerText = `Posição: ${playerPos}º`;
    
    // NPC Finishing logic
    sortedCars.forEach(car => {
        if (!car.isPlayer && car.laps >= CONFIG.totalLaps && !car.finished) {
            car.finished = true;
            if (playerPos > 1 && sortedCars[0] !== player) {
                 // Se algum NPC terminou e o player está atrás, pode ser Game Over se o player não conseguir chegar em 1º
            }
        }
    });

    // Se o primeiro colocado terminar e não for o player, acabou pra ele na vida real
    if (sortedCars[0].finished && sortedCars[0] !== player && !player.finished) {
        endGame(false);
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
