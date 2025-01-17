const inputMessage = document.getElementById('inputMessage');
const messages = document.getElementById('messages');

window.addEventListener('keydown', event => {
    if (event.which === 13) {
        sendMessage();
    }
    if (event.which === 32) {
        if (document.activeElement === inputMessage) {
            inputMessage.value = inputMessage.value + ' ';
        }
    }
});

function sendMessage() {
    let message = inputMessage.value;
    if (message) {
        inputMessage.value = '';
        $.ajax({
            type: 'POST',
            url: '/submit-chatline',
            data: {
                message,
                refreshToken: getCookie('refreshJwt')
            },
            success: function(data) {},
            error: function(xhr) {
                console.log(xhr);
            }
        })
    }
}

function addMessageElement(el) {
    messages.append(el);
    messages.lastChild.scrollIntoView();
}

class BootScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'BootScene',
            active: true
        });
    }

    preload() {
        // map tiles
        this.load.image('tiles', 'assets/map/spritesheet-extruded.png');
        // map in json format
        this.load.tilemapTiledJSON('map', 'assets/map/map.json');
        // our two characters
        this.load.spritesheet('player', 'assets/RPG_assets.png', {
            frameWidth: 16,
            frameHeight: 16
        });

        this.load.image('golem', 'assets/images/coppergolem.png');
        this.load.image('ent', 'assets/images/dark-ent.png');
        this.load.image('demon', 'assets/images/demon.png');
        this.load.image('worm', 'assets/images/giant-worm.png');
        this.load.image('wolf', 'assets/images/wolf.png');
        this.load.image('sword', 'assets/images/attack-icon.png');
    }

    create() {
        this.scene.start('WorldScene');
    }
}

class WorldScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'WorldScene'
        });
    }

    create() {
        this.socket = io();
        this.otherPlayers = this.physics.add.group();

        // create map
        this.createMap();

        // create player animations
        this.createAnimations();

        // user input
        this.cursors = this.input.keyboard.createCursorKeys();

        // create enemies
        this.createEnemies();

        // listen for web socket events
        this.socket.on('currentPlayers', function(players) {
            Object.keys(players).forEach(function(id) {
                if (players[id].playerId === this.socket.id) {
                    this.createPlayer(players[id]);
                } else {
                    this.addOtherPlayers(players[id]);
                }
            }.bind(this));
        }.bind(this));

        this.socket.on('newPlayer', function(playerInfo) {
            this.addOtherPlayers(playerInfo);
        }.bind(this));

        this.socket.on('disconnect', function(playerId) {
            this.otherPlayers.getChildren().forEach(function(player) {
                if (playerId === player.playerId) {
                    player.destroy();
                }
            }.bind(this));
        }.bind(this));

        this.socket.on('playerMoved', function(playerInfo) {
            this.otherPlayers.getChildren().forEach(function(player) {
                if (playerInfo.playerId === player.playerId) {
                    player.flipX = playerInfo.flipX;
                    player.setPosition(playerInfo.x, playerInfo.y);
                }
            }.bind(this));
        }.bind(this));

        this.socket.on('new message', (data) => {
            const usernameSpan = document.createElement('span');
            const usernameText = document.createTextNode(data.username);
            usernameSpan.className = 'username';
            usernameSpan.appendChild(usernameText);

            const messageBodySpan = document.createElement('span');
            const messageBodyText = document.createTextNode(data.message);
            messageBodySpan.className = 'messageBody';
            messageBodySpan.appendChild(messageBodyText);

            const messageLi = document.createElement('li');
            messageLi.setAttribute('username', data.username);
            messageLi.append(usernameSpan);
            messageLi.append(messageBodySpan);

            addMessageElement(messageLi);
        });
    }

    createMap() {
        // create the map
        this.map = this.make.tilemap({
            key: 'map'
        });

        // first parameter is the name of the tilemap in tiled
        var tiles = this.map.addTilesetImage('spritesheet', 'tiles', 16, 16, 1, 2);

        // creating the layers
        this.map.createStaticLayer('Grass', tiles, 0, 0);
        this.map.createStaticLayer('Obstacles', tiles, 0, 0);

        // don't go out of the map
        this.physics.world.bounds.width = this.map.widthInPixels;
        this.physics.world.bounds.height = this.map.heightInPixels;
    }

    createAnimations() {
        //  animation with key 'left', we don't need left and right as we will use one and flip the sprite
        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('player', {
                frames: [1, 7, 1, 13]
            }),
            frameRate: 10,
            repeat: -1
        });

        // animation with key 'right'
        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('player', {
                frames: [1, 7, 1, 13]
            }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'up',
            frames: this.anims.generateFrameNumbers('player', {
                frames: [2, 8, 2, 14]
            }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'down',
            frames: this.anims.generateFrameNumbers('player', {
                frames: [0, 6, 0, 12]
            }),
            frameRate: 10,
            repeat: -1
        });
    }

    createPlayer(playerInfo) {
        // our player sprite created through the physics system
        this.player = this.add.sprite(0, 0, 'player', 6);

        this.container = this.add.container(playerInfo.x, playerInfo.y);
        this.container.setSize(16, 16);
        this.physics.world.enable(this.container);
        this.container.add(this.player);

        // add weapon
        this.weapon = this.add.sprite(10, 0, 'sword');
        this.weapon.setScale(0.5);
        this.weapon.setSize(8, 8);
        this.physics.world.enable(this.weapon);

        this.container.add(this.weapon);
        this.attacking = false;

        // update camera
        this.updateCamera();

        // don't go out of the map
        this.container.body.setCollideWorldBounds(true);

        this.physics.add.overlap(this.weapon, this.spawns, this.onMeetEnemy, false, this);
        this.physics.add.collider(this.container, this.spawns);
    }

    addOtherPlayers(playerInfo) {
        const otherPlayer = this.add.sprite(playerInfo.x, playerInfo.y, 'player', 9);
        otherPlayer.setTint(Math.random() * 0xffffff);
        otherPlayer.playerId = playerInfo.playerId;
        this.otherPlayers.add(otherPlayer);
    }

    updateCamera() {
        // limit camera to map
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(this.container);
        this.cameras.main.roundPixels = true; // avoid tile bleed
    }

    createEnemies() {
        // where the enemies will be
        this.spawns = this.physics.add.group({
            classType: Phaser.GameObjects.Sprite
        });
        for (var i = 0; i < 20; i++) {
            const location = this.getValidLocation();
            // parameters are x, y, width, height
            var enemy = this.spawns.create(location.x, location.y, this.getEnemySprite());
            enemy.body.setCollideWorldBounds(true);
            enemy.body.setImmovable();
        }

        // move enemies
        this.timedEvent = this.time.addEvent({
            delay: 3000,
            callback: this.moveEnemies,
            callbackScope: this,
            loop: true
        });
    }

    moveEnemies() {
        this.spawns.getChildren().forEach((enemy) => {
            const randNumber = Math.floor((Math.random() * 4) + 1);

            switch (randNumber) {
                case 1:
                    enemy.body.setVelocityX(50);
                    break;
                case 2:
                    enemy.body.setVelocityX(-50);
                    break;
                case 3:
                    enemy.body.setVelocityY(50);
                    break;
                case 4:
                    enemy.body.setVelocityY(50);
                    break;
                default:
                    enemy.body.setVelocityX(50);
            }
        });

        setTimeout(() => {
            this.spawns.setVelocityX(0);
            this.spawns.setVelocityY(0);
        }, 500);
    }

    getEnemySprite() {
        var sprites = ['golem', 'ent', 'demon', 'worm', 'wolf'];
        return sprites[Math.floor(Math.random() * sprites.length)];
    }

    getValidLocation() {
        var validLocation = false;
        var x, y;
        while (!validLocation) {
            x = Phaser.Math.RND.between(0, this.physics.world.bounds.width);
            y = Phaser.Math.RND.between(0, this.physics.world.bounds.height);

            var occupied = false;
            this.spawns.getChildren().forEach((child) => {
                if (child.getBounds().contains(x, y)) {
                    occupied = true;
                }
            });
            if (!occupied) validLocation = true;
        }
        return { x, y };
    }

    onMeetEnemy(player, enemy) {
        if (this.attacking) {
            const location = this.getValidLocation();
            enemy.x = location.x;
            enemy.y = location.y;
        }
    }

    update() {
        if (this.container) {
            this.container.body.setVelocity(0);

            // Horizontal movement
            if (this.cursors.left.isDown) {
                this.container.body.setVelocityX(-80);
            } else if (this.cursors.right.isDown) {
                this.container.body.setVelocityX(80);
            }

            // Vertical movement
            if (this.cursors.up.isDown) {
                this.container.body.setVelocityY(-80);
            } else if (this.cursors.down.isDown) {
                this.container.body.setVelocityY(80);
            }

            // Update the animation last and give left/right animations precedence over up/down animations
            if (this.cursors.left.isDown) {
                this.player.anims.play('left', true);
                this.player.flipX = true;

                this.weapon.flipX = true;
                this.weapon.setX(-10);
            } else if (this.cursors.right.isDown) {
                this.player.anims.play('right', true);
                this.player.flipX = false;

                this.weapon.flipX = false;
                this.weapon.setX(10);
            } else if (this.cursors.up.isDown) {
                this.player.anims.play('up', true);
            } else if (this.cursors.down.isDown) {
                this.player.anims.play('down', true);
            } else {
                this.player.anims.stop();
            }

            if (Phaser.Input.Keyboard.JustDown(this.cursors.space) && !this.attacking && document.activeElement !== inputMessage) {
                this.attacking = true;
                setTimeout(() => {
                    this.attacking = false;
                    this.weapon.angle = 0;
                }, 150);
            }

            if (this.attacking) {
                if (this.weapon.flipX) {
                    this.weapon.angle -= 10;
                } else {
                    this.weapon.angle += 10;
                }
            }

            // emit player movement
            var x = this.container.x;
            var y = this.container.y;
            var flipX = this.player.flipX;
            if (this.container.oldPosition && (x !== this.container.oldPosition.x || y !== this.container.oldPosition.y || flipX !== this.container.oldPosition.flipX)) {
                this.socket.emit('playerMovement', { x, y, flipX });
            }
            // save old position data
            this.container.oldPosition = {
                x: this.container.x,
                y: this.container.y,
                flipX: this.player.flipX
            };
        }
    }
}

var config = {
    type: Phaser.AUTO,
    parent: 'content',
    width: 320,
    height: 210,
    zoom: 3,
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                y: 0
            },
            debug: false // set to true to view zones
        }
    },
    scene: [
        BootScene,
        WorldScene
    ]
};
var game = new Phaser.Game(config);