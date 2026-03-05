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
const timerDisplay = document.getElementById('timer-display');
const bestDisplay = document.getElementById('best-display');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');

// Configurações do Jogo
const CONFIG = {
    totalLaps: 5,
    trackCenterX: 500,
    trackCenterY: 400,
    outerRX: 450,
    outerRY: 340,
    innerRX: 280,
    innerRY: 180,
    friction: 0.98,
    turnSpeed: 0.05,
    acceleration: 0.2,
    maxSpeed: 6.5,
};

let gameState = 'START';
let cars = [];
let player = null;
let keys = {};
let startTime = 0;
let currentTime = 0;
let bestTime = localStorage.getItem('bestTimeOval') || Infinity;

// Atualizar HUD do recorde
bestDisplay.innerText = bestTime === Infinity ? "Melhor: --" : `Melhor: ${parseFloat(bestTime).toFixed(2)}s`;

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
        this.width = 40;
        this.height = 20;
        this.laps = 0;
        this.checkpointPassed = false;
        this.targetAngle = 0;
        this.aiOffset = Math.random() * 80 - 40;
        this.aiSpeedFac = 0.88 + Math.random() * 0.22;
        this.finished = false;
    }

    update() {
        if (this.finished) return;

        if (this.isPlayer) {
            this.handleInput();
        } else {
            this.handleAI();
        }

        this.speed *= CONFIG.friction;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        this.checkCollisions();
        this.checkCheckpoints();
    }

    handleInput() {
        if (keys['w']) this.speed += CONFIG.acceleration;
        if (keys['s']) this.speed -= CONFIG.acceleration * 0.5;

        if (keys['a']) this.angle += CONFIG.turnSpeed * (Math.abs(this.speed) > 0.5 ? 1 : Math.abs(this.speed) / 0.5);
        if (keys['d']) this.angle -= CONFIG.turnSpeed * (Math.abs(this.speed) > 0.5 ? 1 : Math.abs(this.speed) / 0.5);

        if (this.speed > CONFIG.maxSpeed) this.speed = CONFIG.maxSpeed;
        if (this.speed < -CONFIG.maxSpeed / 2) this.speed = -CONFIG.maxSpeed / 2;
    }

    handleAI() {
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;
        const currentAngle = Math.atan2(dy, dx);

        const targetAngle = currentAngle + 0.5;

        const rx = (CONFIG.outerRX + CONFIG.innerRX) / 2 + this.aiOffset;
        const ry = (CONFIG.outerRY + CONFIG.innerRY) / 2 + this.aiOffset * 0.6;

        const targetX = CONFIG.trackCenterX + Math.cos(targetAngle) * rx;
        const targetY = CONFIG.trackCenterY + Math.sin(targetAngle) * ry;

        const angleToTarget = Math.atan2(targetY - this.y, targetX - this.x);

        let diff = angleToTarget - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const maxAISteer = CONFIG.turnSpeed * 0.85;
        if (diff > maxAISteer) diff = maxAISteer;
        if (diff < -maxAISteer) diff = -maxAISteer;

        this.angle += diff;

        const targetSpeed = CONFIG.maxSpeed * 0.92 * this.aiSpeedFac;
        if (this.speed < targetSpeed) {
            this.speed += CONFIG.acceleration * 0.7;
        } else {
            this.speed *= 0.99;
        }
    }

    checkCollisions() {
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;

        const dOuter = (dx * dx) / (CONFIG.outerRX * CONFIG.outerRX) + (dy * dy) / (CONFIG.outerRY * CONFIG.outerRY);
        const dInner = (dx * dx) / (CONFIG.innerRX * CONFIG.innerRX) + (dy * dy) / (CONFIG.innerRY * CONFIG.innerRY);

        const isNearPit = dx > 300 && dx < 480 && dy > -150 && dy < 150;

        if (!isNearPit && (dOuter > 1 || dInner < 1)) {
            this.speed *= 0.85;
            if (dOuter > 1.05 || dInner < 0.95) {
                this.speed *= 0.8;
            }
        }
    }

    checkCheckpoints() {
        const dx = this.x - CONFIG.trackCenterX;
        const dy = this.y - CONFIG.trackCenterY;

        if (dx < -300) {
            this.checkpointPassed = true;
        }

        if (this.checkpointPassed && dx > 300 && Math.abs(dy) < 80) {
            this.laps++;
            this.checkpointPassed = false;

            if (this.isPlayer) {
                lapDisplay.innerText = `Volta: ${this.laps} / ${CONFIG.totalLaps}`;
                if (this.laps >= CONFIG.totalLaps) {
                    this.finished = true;
                    endGame(true);
                }
            } else {
                if (this.laps >= CONFIG.totalLaps) {
                    this.finished = true;
                }
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.width / 2 + 3, -this.height / 2 + 3, this.width, this.height);

        ctx.fillStyle = '#111';
        ctx.fillRect(-this.width / 2 + 4, -this.height / 2 - 3, 10, 7);
        ctx.fillRect(-this.width / 2 + 4, this.height / 2 - 4, 10, 7);
        ctx.fillRect(this.width / 2 - 14, -this.height / 2 - 1, 7, 5);
        ctx.fillRect(this.width / 2 - 14, this.height / 2 - 4, 7, 5);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2 - 5, -4);
        ctx.lineTo(0, -7);
        ctx.lineTo(-this.width / 2, -8);
        ctx.lineTo(-this.width / 2, 8);
        ctx.lineTo(0, 7);
        ctx.lineTo(this.width / 2 - 5, 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.fillRect(this.width / 2 - 4, -this.height / 2 - 2, 4, this.height + 4);
        ctx.fillRect(-this.width / 2 - 2, -this.height / 2 - 3, 6, this.height + 6);

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-2, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-6, -1, 4, 2);

        ctx.restore();
    }
}

function drawCrowd(x, y, w, h) {
    ctx.fillStyle = '#444';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const cols = Math.floor(w / 10);
    const rows = Math.floor(h / 12);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const moveY = Math.sin(Date.now() / 200 + i) * 2;
            const colors = ['#f00', '#0f0', '#0af', '#ff0', '#fff'];
            ctx.fillStyle = colors[(i + j) % colors.length];
            ctx.beginPath();
            ctx.arc(x + 5 + i * 10, y + 6 + j * 12 + moveY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawTrack() {
    ctx.fillStyle = '#1e3d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawCrowd(200, 20, 600, 40);
    drawCrowd(200, 740, 600, 40);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.outerRX + 5, CONFIG.outerRY + 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    const grd = ctx.createRadialGradient(CONFIG.trackCenterX, CONFIG.trackCenterY, 200, CONFIG.trackCenterX, CONFIG.trackCenterY, 500);
    grd.addColorStop(0, "#333");
    grd.addColorStop(1, "#222");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.outerRX, CONFIG.outerRY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#444';
    ctx.fillRect(CONFIG.trackCenterX + 350, CONFIG.trackCenterY - 150, 100, 300);
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(CONFIG.trackCenterX + 350, CONFIG.trackCenterY - 150, 100, 300);
    ctx.setLineDash([]);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("PIT LANE", CONFIG.trackCenterX + 400, CONFIG.trackCenterY);

    ctx.fillStyle = '#1e3d1a';
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, CONFIG.innerRX, CONFIG.innerRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.setLineDash([20, 30]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(CONFIG.trackCenterX, CONFIG.trackCenterY, (CONFIG.outerRX + CONFIG.innerRX) / 2, (CONFIG.outerRY + CONFIG.innerRY) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const finishX = CONFIG.trackCenterX + CONFIG.innerRX;
    const finishWidth = CONFIG.outerRX - CONFIG.innerRX;
    const finishY = CONFIG.trackCenterY - 10;

    ctx.fillStyle = '#fff';
    ctx.fillRect(finishX, finishY, finishWidth, 20);
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
        let angA = Math.atan2(a.y - CONFIG.trackCenterY, a.x - CONFIG.trackCenterX);
        let angB = Math.atan2(b.y - CONFIG.trackCenterY, b.x - CONFIG.trackCenterX);
        if (angA < 0) angA += Math.PI * 2;
        if (angB < 0) angB += Math.PI * 2;
        return angA - angB;
    });

    const playerPos = sortedCars.indexOf(player) + 1;
    posDisplay.innerText = `Posição: ${playerPos}º`;

    const npcs = cars.filter(c => !c.isPlayer);
    const allNpcsFinished = npcs.every(n => n.finished);

    if (allNpcsFinished && !player.finished) {
        endGame(false);
    }
}

function updateTimer() {
    if (gameState === 'RACING') {
        currentTime = (Date.now() - startTime) / 1000;
        timerDisplay.innerText = `Tempo: ${currentTime.toFixed(2)}s`;
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTrack();

    if (gameState === 'RACING') {
        updateTimer();
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

function initGame() {
    const startX = CONFIG.trackCenterX + 350;
    cars = [
        new Car(startX, CONFIG.trackCenterY, '#ff3e3e', true),
        new Car(startX + 40, CONFIG.trackCenterY + 40, '#3e86ff', false),
        new Car(startX - 40, CONFIG.trackCenterY - 40, '#00ff88', false),
        new Car(startX + 60, CONFIG.trackCenterY - 80, '#ffcc00', false),
    ];

    cars.forEach(c => {
        c.angle = Math.PI / 2;
        c.speed = 0;
        c.laps = 0;
        c.checkpointPassed = false;
        c.finished = false;
    });

    player = cars[0];
    gameState = 'RACING';
    startTime = Date.now();
    overlay.classList.add('hidden');
    lapDisplay.innerText = `Volta: 0 / ${CONFIG.totalLaps}`;
}

function endGame(win) {
    gameState = 'FINISH';
    overlay.classList.remove('hidden');

    if (win) {
        overlayTitle.innerText = 'Você Ganhou!';
        overlayMsg.innerText = `Tempo Final: ${currentTime.toFixed(2)}s`;

        if (currentTime < bestTime) {
            bestTime = currentTime;
            localStorage.setItem('bestTimeOval', bestTime);
            bestDisplay.innerText = `Melhor: ${bestTime.toFixed(2)}s`;
            overlayMsg.innerText += ' \n NOVO RECORDE!';
        }
    } else {
        overlayTitle.innerText = 'Você Perdeu!';
        overlayMsg.innerText = 'Todos os oponentes terminaram antes de você!';
    }

    startBtn.innerText = 'Reiniciar';
}

startBtn.addEventListener('click', initGame);
gameLoop();
lapDisplay.innerText = `Volta: 0 / ${CONFIG.totalLaps}`;
