// The town map, the walking character and all the map "juice", in Phaser.
// World coordinates are the map image's own pixels, so map.json points can
// be used directly.
import Phaser from 'phaser';
import { normalizeAngle } from '../engine/engine.js';
import { sfx } from '../audio/sfx.js';
import { FRAME } from '../avatar/compositor.js';

// angle -> sheet row (0 up, 1 left, 2 down, 3 right); same bands as the old game
function dirRow(angle) {
  const deg = ((angle * 180 / Math.PI) % 360 + 360) % 360;
  if (deg >= 315 || deg < 45) return 3;
  if (deg < 135) return 2;
  if (deg < 225) return 1;
  return 0;
}

class TownScene extends Phaser.Scene {
  constructor(ctl) { super('town'); this.ctl = ctl; }

  preload() {
    this.load.image('map', this.ctl.pack.imageUrl);
  }

  create() {
    const { W, H, R } = this.ctl;
    this.cameras.main.setBackgroundColor('#bfe6dc');
    this.map = this.add.image(0, 0, 'map').setOrigin(0, 0);
    this.mw = this.map.width; this.mh = this.map.height;
    this.fit = Math.min(W / this.mw, H / this.mh) * R * 0.98;
    const cam = this.cameras.main;
    cam.setBounds(-40, -40, this.mw + 80, this.mh + 80);
    cam.setZoom(this.fit);
    cam.centerOn(this.mw / 2, this.mh / 2);
    this.makeTextures();

    this.routeG = this.add.graphics().setDepth(4);
    this.marker = this.add.container(0, 0).setDepth(6).setVisible(false);
    const ring = this.add.image(0, 0, 'ring').setScale(1.2);
    const pin = this.add.image(0, -44, 'pin');
    this.marker.add([ring, pin]);
    this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 1100, repeat: -1 });
    this.tweens.add({ targets: pin, y: -58, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.dust = this.add.particles(0, 0, 'dot', {
      speed: { min: 8, max: 30 }, angle: { min: 180, max: 360 }, lifespan: 420,
      scale: { start: 0.9, end: 0 }, alpha: { start: 0.55, end: 0 }, tint: 0xd9cbb0, emitting: false,
    }).setDepth(7);
    this.confetti = this.add.particles(0, 0, 'confetti', {
      speed: { min: 160, max: 420 }, angle: { min: 200, max: 340 }, gravityY: 520, lifespan: 1600,
      rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1.2 },
      tint: [0xff5a5a, 0xffc93c, 0x4ad991, 0x4aa8ff, 0xb46bff, 0xff8fd0], emitting: false,
    }).setDepth(30);
    this.sparkle = this.add.particles(0, 0, 'star', {
      speed: { min: 40, max: 160 }, lifespan: 900, scale: { start: 0.9, end: 0 }, tint: 0xffe066, emitting: false,
    }).setDepth(31);

    for (const key of ['hero', 'asker']) {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addSpriteSheet(key, this.ctl.sheets[key], { frameWidth: FRAME, frameHeight: FRAME });
    }
    this.player = this.add.sprite(0, 0, 'hero', 18).setOrigin(0.5, 0.88).setDepth(10);
    this.asker = this.add.sprite(0, 0, 'asker', 18).setOrigin(0.5, 0.88).setDepth(9);
    this.shadowP = this.add.ellipse(0, 0, 30, 10, 0x000000, 0.18).setDepth(8);
    this.shadowA = this.add.ellipse(0, 0, 30, 10, 0x000000, 0.18).setDepth(8);
    this.makeAnims('hero'); this.makeAnims('asker');
    this.trail = [];
    this.facing = 0;
    this.ready = true;
    this.ctl._ready?.();
  }

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillCircle(8, 8, 8); g.generateTexture('dot', 16, 16); g.clear();
    g.fillStyle(0xffffff).fillRect(0, 0, 10, 6); g.generateTexture('confetti', 10, 6); g.clear();
    g.fillStyle(0xffffff);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 5 : 12, a = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    }
    g.closePath(); g.fillPath(); g.generateTexture('star', 24, 24); g.clear();
    g.lineStyle(6, 0xff3d7f, 1).strokeCircle(30, 30, 24); g.generateTexture('ring', 60, 60); g.clear();
    // map pin
    g.fillStyle(0x000000, 0.2).fillEllipse(24, 58, 18, 6);
    g.fillStyle(0xff3d7f).fillCircle(24, 20, 18);
    g.fillTriangle(9, 28, 39, 28, 24, 54);
    g.fillStyle(0xffffff).fillCircle(24, 20, 8);
    g.generateTexture('pin', 48, 64);
    g.destroy();
  }

  makeAnims(key) {
    for (let row = 0; row < 4; row++) {
      const k = `${key}-walk-${row}`;
      if (this.anims.exists(k)) this.anims.remove(k);
      this.anims.create({ key: k, frames: this.anims.generateFrameNumbers(key, { start: row * 9 + 1, end: row * 9 + 8 }), frameRate: 13, repeat: -1 });
    }
  }

  setSheet(key, canvas) {
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addSpriteSheet(key, canvas, { frameWidth: FRAME, frameHeight: FRAME });
    this.makeAnims(key);
    const spr = key === 'hero' ? this.player : this.asker;
    spr.setTexture(key, 18);
  }

  update(time, delta) {
    if (!this.ready) return;
    // The asker follows the player's trail a little behind.
    const p = this.player;
    const last = this.trail[this.trail.length - 1];
    if (this.recording && (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2)) this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 400) this.trail.shift();
    // Stand exactly 34px back along the trail, so the follower glides
    // smoothly instead of chasing and stopping every other frame.
    let dist = 0, target = this.trail[0];
    for (let i = this.trail.length - 1; i > 0; i--) {
      const seg = Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
      if (dist + seg >= 34) {
        const k = (34 - dist) / seg;
        target = { x: this.trail[i].x + (this.trail[i - 1].x - this.trail[i].x) * k, y: this.trail[i].y + (this.trail[i - 1].y - this.trail[i].y) * k };
        break;
      }
      dist += seg;
    }
    const a = this.asker;
    if (target && this.askerFollows) {
      const dx = target.x - a.x, dy = target.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.4) {
        a.x = target.x; a.y = target.y;
        this.askerRow = dirRow(Math.atan2(dy, dx));
        this.askerStill = 0;
        a.play(`asker-walk-${this.askerRow}`, true);
      } else if (++this.askerStill > 6 && a.anims.isPlaying) {
        a.stop();
        a.setFrame((this.askerRow ?? 2) * 9);
      }
    }
    this.shadowP.setPosition(p.x, p.y + 1);
    this.shadowA.setPosition(a.x, a.y + 1);
    a.setDepth(a.y < p.y ? 9 : 11);
  }

  face(angle) {
    this.facing = angle;
    const row = dirRow(angle);
    if (this.player.anims.isPlaying) this.player.play(`hero-walk-${row}`, true);
    else this.player.setFrame(row * 9);
  }
}

export class MapView {
  constructor(parent, pack, { width, height, renderScale = 1, hero, asker }) {
    this.pack = pack;
    this.sheets = { hero, asker };
    this.W = width; this.H = height; this.R = renderScale;
    this.speed = 1;
    this.readyP = new Promise(r => (this._ready = r));
    this.scene = new TownScene(this);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: Math.round(width * renderScale),
      height: Math.round(height * renderScale),
      zoom: 1 / renderScale,
      backgroundColor: '#bfe6dc',
      scene: this.scene,
      render: { antialias: true, pixelArt: false, roundPixels: false },
      audio: { noAudio: true },
      banner: false,
      input: { mouse: { preventDefaultWheel: false } },
    });
  }
  ready() { return this.readyP; }
  speedPx() { return 190 * this.speed; }
  destroy() { this.game.destroy(true); }

  setHero(canvas) { this.scene.setSheet('hero', canvas); }
  setAsker(canvas) { this.scene.setSheet('asker', canvas); }

  // Place everyone at the start.
  reset(startId, destId, { marker = false, angle = 0 } = {}) {
    const s = this.scene, g = this.pack.graph;
    const sp = g.point(startId), dp = g.point(destId);
    s.tweens.killTweensOf(s.player);
    s.player.stop();
    s.player.setPosition(sp.x, sp.y).setScale(1.15).setAngle(0).setAlpha(1);
    s.face(angle);
    // asker stands just behind
    s.asker.setPosition(sp.x - Math.cos(angle) * 30, sp.y - Math.sin(angle) * 30).setScale(1.15);
    s.asker.stop(); s.asker.setFrame(dirRow(angle) * 9);
    s.askerRow = dirRow(angle); s.askerStill = 0;
    s.trail = [{ x: s.asker.x, y: s.asker.y }, { x: sp.x, y: sp.y }];
    s.askerFollows = true;
    s.marker.setPosition(dp.x, dp.y).setVisible(marker);
    s.routeG.clear();
    this.clearBubbles();
    this.overview(0);
    s.player.setScale(0.1);
    s.tweens.add({ targets: s.player, scale: 1.15, duration: 350, ease: 'Back.out' });
  }

  overview(ms = 700) {
    const s = this.scene, cam = s.cameras.main;
    cam.stopFollow();
    if (!ms) { cam.panEffect.reset(); cam.zoomEffect.reset(); cam.setZoom(s.fit); cam.centerOn(s.mw / 2, s.mh / 2); return; }
    cam.pan(s.mw / 2, s.mh / 2, ms, 'Sine.easeInOut', true);
    cam.zoomTo(s.fit, ms, 'Sine.easeInOut', true);
  }
  followPlayer() {
    const s = this.scene, cam = s.cameras.main;
    cam.stopFollow();
    cam.pan(s.player.x, s.player.y, 500, 'Sine.easeInOut', true, (c, k) => { if (k === 1) cam.startFollow(s.player, true, 0.1, 0.1); });
    cam.zoomTo(Math.min(s.fit * 2.1, this.R * 2.4), 600, 'Sine.easeInOut', true);
  }
  focusOn(x, y, zoomMul = 2.3, ms = 700) {
    const s = this.scene, cam = s.cameras.main;
    cam.stopFollow();
    const z = Math.min(s.fit * zoomMul, this.R * 2.6);
    if (!ms) { cam.panEffect.reset(); cam.zoomEffect.reset(); cam.setZoom(z); cam.centerOn(x, y); return; }
    cam.pan(x, y, ms, 'Sine.easeInOut', true);
    cam.zoomTo(z, ms, 'Sine.easeInOut', true);
  }

  // ---- animation primitives ----
  tween(cfg) { return new Promise(r => this.scene.tweens.add({ ...cfg, onComplete: () => r() })); }
  delay(ms) { return new Promise(r => this.scene.time.delayedCall(ms / this.speed, r)); }

  async walk(path) {
    const s = this.scene, g = this.pack.graph;
    s.recording = true;
    for (let i = 1; i < path.length; i++) {
      const a = g.point(path[i - 1]), b = g.point(path[i]);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      s.facing = ang;
      s.player.play(`hero-walk-${dirRow(ang)}`, true);
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      let acc = 0, lx = s.player.x, ly = s.player.y;
      await this.tween({
        targets: s.player, x: b.x, y: b.y, duration: (dist / this.speedPx()) * 1000, ease: 'Linear',
        onUpdate: () => {
          acc += Math.hypot(s.player.x - lx, s.player.y - ly); lx = s.player.x; ly = s.player.y;
          if (acc > 26) { acc = 0; s.dust.emitParticleAt(s.player.x, s.player.y, 2); sfx.play('step'); }
        },
      });
      // draw the walked route
      s.routeG.lineStyle(7, 0xffffff, 0.75).lineBetween(a.x, a.y, b.x, b.y);
    }
    s.recording = false;
    s.player.stop();
    s.player.setFrame(dirRow(s.facing) * 9);
  }

  async turn(from, by) {
    const s = this.scene;
    sfx.play('turn');
    this.bubble(s.player, by < 0 ? '↰' : '↱', 700, '#2f6fe8');
    const o = { a: from };
    const hop = this.tween({ targets: s.player, y: s.player.y - 10, duration: 140 / this.speed, yoyo: true, ease: 'Quad.out' });
    await this.tween({ targets: o, a: from + by, duration: 420 / this.speed, ease: 'Sine.inOut', onUpdate: () => s.face(o.a) });
    await hop;
    s.face(normalizeAngle(from + by));
  }

  async bump() {
    const s = this.scene;
    sfx.play('bump');
    const dx = Math.cos(s.facing) * 12, dy = Math.sin(s.facing) * 12;
    await this.tween({ targets: s.player, x: s.player.x + dx, y: s.player.y + dy, duration: 110, yoyo: true, ease: 'Quad.out' });
    s.cameras.main.shake(180, 0.004);
    this.bubble(s.player, '?', 1400, '#e8514a');
    this.bubble(s.asker, '?', 1400, '#888', 120);
  }

  async celebrate(destId) {
    const s = this.scene, p = this.pack.graph.point(destId);
    // The person who asked the way is the one who jumps for joy.
    s.askerFollows = false;
    s.asker.stop();
    s.asker.setFrame(2 * 9);
    this.focusOn(p.x, p.y, 2.2, 600);
    s.marker.setVisible(true).setPosition(p.x, p.y);
    s.marker.setScale(0.2);
    this.tween({ targets: s.marker, scale: 1, duration: 450, ease: 'Back.out' });
    s.confetti.explode(70, p.x, p.y - 30);
    s.sparkle.explode(20, p.x, p.y - 40);
    this.tween({ targets: s.asker, y: s.asker.y - 24, duration: 200, yoyo: true, repeat: 3, ease: 'Quad.out' });
    await this.delay(500);
    this.bubble(s.asker, '❤', 1800, '#ff3d7f');
    this.bubble(s.player, '★', 1800, '#f2b53a', 150);
    await this.delay(900);
  }

  async dizzy() {
    const s = this.scene;
    sfx.play('dizzy');
    this.bubble(s.player, '💫', 1600, '#9b6ad6');
    const o = { a: s.facing };
    await this.tween({ targets: o, a: s.facing + Math.PI * 6, duration: 1400, ease: 'Sine.inOut', onUpdate: () => s.face(o.a) });
    await this.tween({ targets: s.player, angle: 90, duration: 250, ease: 'Bounce.out' });
    await this.delay(700);
    s.player.setAngle(0);
  }

  // Little speech/emote bubble above a sprite.
  bubble(target, text, ms = 1200, color = '#333', delay = 0) {
    const s = this.scene;
    s.time.delayedCall(delay, () => {
      const c = s.add.container(target.x, target.y - 74).setDepth(40);
      const bg = s.add.graphics();
      bg.fillStyle(0xffffff, 1).fillRoundedRect(-24, -24, 48, 44, 14);
      bg.fillTriangle(-7, 18, 7, 18, 0, 28);
      bg.lineStyle(3, Phaser.Display.Color.HexStringToColor(color).color, 1).strokeRoundedRect(-24, -24, 48, 44, 14);
      const t = s.add.text(0, -2, text, { fontFamily: 'Fredoka, sans-serif', fontSize: '30px', color, fontStyle: 'bold' }).setOrigin(0.5);
      c.add([bg, t]);
      c.setScale(0);
      (this._bubbles = this._bubbles || []).push(c);
      s.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.out' });
      const follow = s.time.addEvent({ delay: 16, loop: true, callback: () => c.setPosition(target.x, target.y - 74) });
      s.time.delayedCall(ms, () => {
        s.tweens.add({ targets: c, scale: 0, alpha: 0, duration: 200, onComplete: () => { follow.remove(); c.destroy(); } });
      });
    });
  }
  clearBubbles() { (this._bubbles || []).forEach(b => b.active && b.destroy()); this._bubbles = []; }
}
