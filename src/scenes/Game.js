import { Scene } from "phaser";

export class Game extends Scene {
  constructor() {
    super("Game");
    this.player = null;
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
    this.score = 0;
    this.scoreText = null;
    this.enemySpawnTimer = null;
    this.canShoot = true;
  }

  create() {
    this.cameras.main.setBackgroundColor(0x111111);
    this.add.image(512, 384, "background").setAlpha(0.3);

    // Player setup
    this.player = this.physics.add
      .sprite(50, this.scale.height / 2, "player")
      .setOrigin(0.5)
      .setImmovable(true);
    this.player.setCollideWorldBounds(true);
    this.player.health = 100;
    this.playerHealthBar = this.add.graphics();
    this.updatePlayerHealthBar();

    // Score text
    this.scoreText = this.add.text(10, 10, "Score: 0", {
      fontSize: "20px",
      fill: "#fff",
    });

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.on("pointerdown", this.shootPlayer, this);

    // Enemy spawning
    this.enemySpawnTimer = this.time.addEvent({
      delay: 1200,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
    });
  }

  update() {
    this.updatePlayerMovement();
    this.updateProjectiles();
    this.updateEnemies();
    this.checkCollisions();
  }

  updatePlayerMovement() {
    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-250);
    } else if (this.cursors.down.isDown) {
      this.player.setVelocityY(250);
    } else {
      this.player.setVelocityY(0);
    }
  }

  shootPlayer() {
    if (this.canShoot) {
      const projectile = this.physics.add
        .sprite(
          this.player.x + this.player.width / 2,
          this.player.y,
          "projectile"
        )
        .setOrigin(0.5);
      projectile.setVelocityX(300);
      this.playerProjectiles.push(projectile);
      this.canShoot = false;
      this.time.delayedCall(150, () => (this.canShoot = true), [], this); // Delay for next shot
    }
  }

  updateProjectiles() {
    // Player projectiles
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.playerProjectiles[i];
      if (projectile.x > this.scale.width) {
        projectile.destroy();
        this.playerProjectiles.splice(i, 1);
      }
    }
    // Enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.enemyProjectiles[i];
      if (projectile.x < 0) {
        projectile.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  spawnEnemy() {
    const enemyY = Phaser.Math.FloatBetween(25, this.scale.height - 25);
    const rand = Math.random();
    let enemyType = "basic";

    if (rand < 0.5) {
      enemyType = "basic";
    } else if (rand < 0.75) {
      enemyType = "shooter";
    } else {
      enemyType = "zigZag";
    }

    const enemy = this.physics.add
      .sprite(this.scale.width, enemyY, `enemy_${enemyType}`)
      .setOrigin(0.5);
    enemy.type = enemyType;
    enemy.health =
      enemyType === "basic" ? 50 : enemyType === "shooter" ? 75 : 100;
    enemy.speed =
      enemyType === "basic" ? -100 : enemyType === "shooter" ? -75 : -90;
    enemy.projectileColor = "red";
    enemy.canShoot = true;
    enemy.lastShotTime = 0;
    enemy.shootInterval = 2500;
    enemy.initialY = enemyY;
    enemy.zigzagAmplitude = 30;
    enemy.zigzagFrequency = 0.02;
    enemy.setVelocityX(enemy.speed);

    this.enemies.push(enemy);
  }

  updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.x < -enemy.width / 2) {
        enemy.destroy();
        this.enemies.splice(i, 1);
      } else {
        // Enemy movement patterns
        if (enemy.type === "zigZag") {
          enemy.y =
            enemy.initialY +
            Math.sin((this.time.now + enemy.x) * enemy.zigzagFrequency) *
              enemy.zigzagAmplitude;
        }

        // Enemy shooting logic
        if (
          enemy.type === "shooter" &&
          enemy.canShoot &&
          this.time.now - enemy.lastShotTime > enemy.shootInterval
        ) {
          this.shootEnemy(enemy);
          enemy.lastShotTime = this.time.now;
        }
      }
    }
  }

  shootEnemy(enemy) {
    const projectile = this.physics.add
      .sprite(enemy.x - enemy.width / 2, enemy.y, "enemy_projectile")
      .setOrigin(0.5);
    projectile.setVelocityX(-200);
    this.enemyProjectiles.push(projectile);
  }

  checkCollisions() {
    this.physics.overlap(
      this.playerProjectiles,
      this.enemies,
      this.handleProjectileEnemyCollision,
      null,
      this
    );
    this.physics.overlap(
      this.enemyProjectiles,
      this.player,
      this.handleEnemyProjectilePlayerCollision,
      null,
      this
    );
    this.physics.overlap(
      this.player,
      this.enemies,
      this.handlePlayerEnemyCollision,
      null,
      this
    );
  }

  handleProjectileEnemyCollision(projectile, enemy) {
    projectile.destroy();
    this.playerProjectiles = this.playerProjectiles.filter(
      (p) => p !== projectile
    );

    enemy.health -= 25;
    if (enemy.health <= 0) {
      this.score +=
        enemy.type === "basic" ? 10 : enemy.type === "shooter" ? 20 : 30;
      this.scoreText.setText(`Score: ${this.score}`);
      this.createExplosion(enemy.x, enemy.y, enemy.texture.key);
      enemy.destroy();
      this.enemies = this.enemies.filter((e) => e !== enemy);
    }
    this.updateHealthBar(enemy);
  }

  handleEnemyProjectilePlayerCollision(projectile, player) {
    projectile.destroy();
    this.enemyProjectiles = this.enemyProjectiles.filter(
      (p) => p !== projectile
    );
    player.health -= 10;
    this.updatePlayerHealthBar();
    if (player.health <= 0) {
      this.gameOver();
    }
  }

  handlePlayerEnemyCollision(player, enemy) {
    enemy.destroy();
    this.enemies = this.enemies.filter((e) => e !== enemy);
    player.health -= 20;
    this.updatePlayerHealthBar();
    this.createExplosion(enemy.x, enemy.y, enemy.texture.key);
    if (player.health <= 0) {
      this.gameOver();
    }
  }

  createExplosion(x, y, key) {
    const particles = this.add.particles(key);
    particles.createEmitter({
      x: x,
      y: y,
      speed: { min: -50, max: 50 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 500, max: 1000 },
      quantity: 10,
      alpha: { start: 1, end: 0 },
      scale: { min: 0.2, max: 0.5 },
      rotate: { min: -180, max: 180 },
      blendMode: "ADD",
    });
    this.time.delayedCall(500, () => particles.destroy(), [], this);
  }

  updateHealthBar(enemy) {
    const healthBarWidth =
      (enemy.width + 10) *
      (enemy.health /
        (enemy.type === "basic" ? 50 : enemy.type === "shooter" ? 75 : 100));
  }

  updatePlayerHealthBar() {
    this.playerHealthBar.clear();
    this.playerHealthBar.fillStyle(0xaaaaaa, 1);
    this.playerHealthBar.fillRect(
      this.player.x - 15,
      this.player.y - 20,
      this.player.width + 30,
      5
    );

    this.playerHealthBar.fillStyle(0x00ff00, 1);
    this.playerHealthBar.fillRect(
      this.player.x - 15,
      this.player.y - 20,
      ((this.player.width + 30) * this.player.health) / 100,
      5
    );
  }

  gameOver() {
    this.enemySpawnTimer.remove();
    this.scene.start("GameOver", { score: this.score });
  }
}
