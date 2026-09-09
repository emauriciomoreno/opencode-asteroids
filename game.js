'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// Traza un polígono cerrado sobre ctx a partir de vértices [[x, y], ...]
function tracePoly(verts) {
  ctx.beginPath();
  ctx.moveTo(verts[0][0], verts[0][1]);
  for (let i = 1; i < verts.length; i++)
    ctx.lineTo(verts[i][0], verts[i][1]);
  ctx.closePath();
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;
    this.color  = '#fff';
    this.points = POINTS[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estrella fugaz ────────────────────────────────────────────────────────────
const STAR_SPEED  = 300;   // px/s: mucho más rápida que cualquier asteroide
const STAR_TTL    = 5;     // segundos antes de desvanecerse solo
const STAR_POINTS = 250;   // bono fijo por destruirla

class ShootingStar extends Asteroid {
  constructor(x, y) {
    super(x, y, 1);        // tamaño 1: pequeña y difícil de acertar
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * STAR_SPEED;
    this.vy = Math.sin(angle) * STAR_SPEED;
    this.ttl    = STAR_TTL;
    this.color  = '#fc0';
    this.points = STAR_POINTS;
  }

  update(dt) {
    if (this.dead) return;
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.dead = true;
      explode(this.x, this.y, 6, '#fc0');   // pufe dorado al desvanecerse
    }
  }

  split() { return []; }   // no se divide al ser destruida

  draw() {
    // Parpadeo cuando está por desvanecerse
    if (this.ttl < 1.5 && Math.floor(this.ttl * 8) % 2 === 0) return;

    // Estela detrás del movimiento
    ctx.strokeStyle = 'rgba(252, 204, 0, 0.5)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.15, this.y - this.vy * 0.15);
    ctx.stroke();

    super.draw();
  }
}

// ── PowerUps (Velocidad / Triple / Escudo) ────────────────────────────────────
const POWERUP_CHANCE   = 0.10;  // probabilidad de drop por asteroide destruido
const SPEEDUP_DURATION = 5;     // segundos de efecto Velocidad
const TRIPLE_DURATION  = 5;     // segundos de efecto Triple Disparo
const TRIPLE_SPREAD    = 0.12;  // rad: apertura del abanico de las 3 balas
const SHIELD_DURATION  = 6;     // segundos de efecto Escudo
const SHIELD_RADIUS    = 24;    // radio del escudo alrededor de la nave
const SHIELD_COST      = 2;     // segundos que consume cada impacto absorbido
const MAX_POWERUPS     = 2;     // tope de power-ups simultáneos en pantalla

// Config visual por tipo de power-up
const POWERUP_STYLES = {
  velocidad: { color: '#0ff' },
  triple:    { color: '#f80' },
  escudo:    { color: '#0f0' },
};

class PowerUp {
  constructor(x, y, type = 'velocidad') {
    this.type  = type;
    this.color = POWERUP_STYLES[type].color;
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(35, 60);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = 12;
    this.phase = rand(0, Math.PI * 2);   // fase del pulso visual
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.phase += dt * 5;
  }

  draw() {
    const pulse = 1 + Math.sin(this.phase) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    if (this.type === 'velocidad') {
      // Doble chevron ">>"
      for (const off of [-5, 4]) {
        ctx.beginPath();
        ctx.moveTo(off - 4, -7);
        ctx.lineTo(off + 3,  0);
        ctx.lineTo(off - 4,  7);
        ctx.stroke();
      }
    } else if (this.type === 'triple') {
      // Triple: tres trazos en abanico
      for (const a of [-0.45, 0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-6 + Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.stroke();
      }
    } else {
      // Escudo: burbuja de círculo con abertura
      ctx.beginPath();
      ctx.arc(0, 0, 8, -Math.PI * 0.65, Math.PI * 0.65);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Skins ─────────────────────────────────────────────────────────────────────
// Cada skin define silueta (verts), color de trazo, color de la llama,
// escala de tamaño y bono de puntos. La nariz se mantiene en x ≈ 20 × escala:
// tryShoot() origina las balas ahí (NOSE = 21 × escala).
const SKINS = [
  { nombre: 'Clásica', color: '#fff', llama: 'rgba(255, 130, 0, 0.85)',
    verts: [[20, 0], [-12, -9], [-7, 0], [-12, 9]], escala: 1, bonus: 1 },
  { nombre: 'Cazador', color: '#0f0', llama: 'rgba(0, 255, 130, 0.85)',
    verts: [[20, 0], [-10, -13], [-6, -4], [-9, 0], [-6, 4], [-10, 13]], escala: 1, bonus: 1 },
  { nombre: 'Dardo', color: '#f46', llama: 'rgba(255, 70, 110, 0.85)',
    verts: [[24, 0], [-10, -4], [-7, 0], [-10, 4]], escala: 1, bonus: 1 },
  { nombre: 'Colibrí', color: '#0ef', llama: 'rgba(130, 220, 255, 0.85)',
    verts: [[18, 0], [-8, -11], [-10, -4], [-5, 0], [-10, 4], [-8, 11]], escala: 1, bonus: 1 },
  // Titán: morada, el doble de grande que la Clásica (misma silueta ×2) y
  // otorga el doble de puntos a cambio de ser un blanco más fácil.
  { nombre: 'Titán', color: '#b6f', llama: 'rgba(220, 160, 255, 0.85)',
    verts: [[20, 0], [-12, -9], [-7, 0], [-12, 9]], escala: 2, bonus: 2 },
];

const SKIN_KEY = 'asteroids-skin';   // clave en localStorage
let skinIndex = 0;
let skinToast = 0;                   // segundos restantes del aviso "SKIN: …"

function saveSkin() {
  try { localStorage.setItem(SKIN_KEY, String(skinIndex)); } catch (e) {}
}

// Restaura la skin elegida; ignora valores corruptos o fuera de rango
try {
  const saved = parseInt(localStorage.getItem(SKIN_KEY), 10);
  if (Number.isInteger(saved)) skinIndex = wrap(saved, SKINS.length);
} catch (e) {}

function cycleSkin() {
  skinIndex = (skinIndex + 1) % SKINS.length;
  skinToast = 1.5;   // el aviso dura 1.5 s
  saveSkin();
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12 * SKINS[skinIndex].escala;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedTime     = 0;
    this.tripleTime    = 0;
    this.shieldTime    = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    // La skin puede cambiar en caliente (tecla C): radio siempre acorde a la escala
    this.radius = 12 * SKINS[skinIndex].escala;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedTime     > 0) this.speedTime     = Math.max(this.speedTime - dt, 0);
    if (this.tripleTime    > 0) this.tripleTime    = Math.max(this.tripleTime - dt, 0);
    if (this.shieldTime    > 0) this.shieldTime    = Math.max(this.shieldTime - dt, 0);

    const ROT   = 3.5;   // rad/s
    const THRUST = this.speedTime > 0 ? 520 : 260;  // px/s² (x2 con Velocidad)
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21 * SKINS[skinIndex].escala;   // origen de balas en la punta
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    // Triple activo: tres balas en abanico
    if (this.tripleTime > 0) {
      return [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD]
        .map(da => new Bullet(ox, oy, this.angle + da));
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const skin   = SKINS[skinIndex];
    const escala = skin.escala;
    if (escala !== 1) ctx.scale(escala, escala);   // silueta a tamaño de la skin
    // Contorno según power-up activo (Triple > Velocidad); si no, color de la skin
    ctx.strokeStyle = this.tripleTime > 0 ? POWERUP_STYLES.triple.color
                    : this.speedTime > 0 ? POWERUP_STYLES.velocidad.color
                    : skin.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta de la skin activa
    tracePoly(skin.verts);
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = skin.llama;
      ctx.stroke();
    }

    // Burbuja de escudo mientras dura el efecto (parpadea al finalizar)
    if (this.shieldTime > 0 &&
        !(this.shieldTime < 1.2 && Math.floor(this.shieldTime * 8) % 2 === 0)) {
      ctx.globalAlpha = 0.6 + 0.25 * Math.sin(this.shieldTime * 6);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth   = 1.5 / escala;   // compensa el escalado para verse uniforme
      ctx.beginPath();
      // En unidades locales: ctx.scale ya lo lleva a SHIELD_RADIUS × escala px,
      // el mismo radio que usa la colisión del escudo en update()
      ctx.arc(0, 0, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y, color = '#fff') {
    this.x  = x;
    this.y  = y;
    this.color = color;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.globalAlpha = this.ttl / this.life;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let starTimer;  // cuenta atrás para el próximo spawn de estrella fugaz

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  starTimer = rand(4, 8);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8, color = '#fff') {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

// Suma puntos aplicando el bono de la skin activa (x2 con la Titán)
function addScore(points) {
  score += points * SKINS[skinIndex].bonus;
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Rotación de skin con C (edge-detect), disponible en cualquier estado
  if (pressed('KeyC')) cycleSkin();
  if (skinToast > 0) skinToast = Math.max(skinToast - dt, 0);

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    asteroids = asteroids.filter(a => !a.dead);   // limpiar estrellas fugaces expiradas
    powerups.forEach(p => p.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        addScore(a.points);
        explode(a.x, a.y, a.size * 5, a instanceof ShootingStar ? '#fc0' : '#fff');
        newAsteroids.push(...a.split());
        // Drop de power-up: un tercio de probabilidad para cada tipo
        if (powerups.length < MAX_POWERUPS && Math.random() < POWERUP_CHANCE)
          powerups.push(new PowerUp(a.x, a.y, ['velocidad', 'triple', 'escudo'][randInt(0, 2)]));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    const shieldR = SHIELD_RADIUS * SKINS[skinIndex].escala;   // escudo a escala de la nave
    for (const a of asteroids) {
      if (ship.shieldTime > 0 && dist(ship, a) < shieldR + a.radius * 0.82) {
        // El escudo absorbe el impacto: destruye sin dividir y consume tiempo
        a.dead = true;
        addScore(a.points);
        ship.shieldTime = Math.max(ship.shieldTime - SHIELD_COST, 0);
        explode(a.x, a.y, a.size * 5, a instanceof ShootingStar ? '#fc0' : '#0f0');
      } else if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead);
  }

  // Nave vs power-up (reinicia el timer si ya estaba activo)
  for (const p of powerups) {
    if (!ship.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'triple')      ship.tripleTime = TRIPLE_DURATION;
      else if (p.type === 'escudo') ship.shieldTime = SHIELD_DURATION;
      else                          ship.speedTime  = SPEEDUP_DURATION;
      explode(p.x, p.y, 6, p.color);
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Spawn de la estrella fugaz (máx. 1 simultánea)
  starTimer -= dt;
  if (starTimer <= 0) {
    starTimer = rand(7, 12);
    if (!asteroids.some(a => a instanceof ShootingStar)) {
      let x, y;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - ship.x, y - ship.y) < 150);
      asteroids.push(new ShootingStar(x, y));
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const s = SKINS[skinIndex];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  // Los verts son a escala unitaria (el tamaño real lo aplica Ship.draw),
  // así que todos los iconos ocupan lo mismo en el HUD
  ctx.scale(0.45, 0.45);
  ctx.strokeStyle = s.color;
  ctx.lineWidth   = 2.7;   // ≈ 1.2 px efectivos tras el escalado
  ctx.lineJoin    = 'round';
  tracePoly(s.verts);
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicadores de power-ups (apilados mientras estén activos)
  let hudY = H - 14;
  if (ship.speedTime > 0) {
    ctx.fillStyle = POWERUP_STYLES.velocidad.color;
    ctx.textAlign = 'left';
    ctx.fillText(`VELOCIDAD ${ship.speedTime.toFixed(1)}s`, 14, hudY);
    hudY -= 18;
  }
  if (ship.tripleTime > 0) {
    ctx.fillStyle = POWERUP_STYLES.triple.color;
    ctx.textAlign = 'left';
    ctx.fillText(`TRIPLE ${ship.tripleTime.toFixed(1)}s`, 14, hudY);
    hudY -= 18;
  }
  if (ship.shieldTime > 0) {
    ctx.fillStyle = POWERUP_STYLES.escudo.color;
    ctx.textAlign = 'left';
    ctx.fillText(`ESCUDO ${ship.shieldTime.toFixed(1)}s`, 14, hudY);
  }

  // Aviso temporal al cambiar de skin (se desvanece al final)
  if (skinToast > 0) {
    const s = SKINS[skinIndex];
    ctx.globalAlpha = Math.min(skinToast / 0.5, 1);
    ctx.fillStyle = s.color;
    ctx.textAlign = 'center';
    ctx.fillText(`SKIN: ${s.nombre}${s.bonus > 1 ? ` (PUNTOS x${s.bonus})` : ''}`, W / 2, H - 14);
    ctx.globalAlpha = 1;
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  powerups.forEach(p => p.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
