import Phaser from 'phaser'
import { io, Socket } from 'socket.io-client'


const config = {
	type: Phaser.AUTO,
	parent: 'phaser-example',
	width: 800,
	height: 600,
	physics: {
		default: 'arcade',
		arcade: {
			debug: false,
			gravity: { y: 0 }
		}
	},
	scene: {
		preload: preload,
		create: create,
		update: update
	}
}

// @ts-ignore
new Phaser.Game(config)

interface Scene extends Phaser.Scene {
	socket: Socket,
	ship: Phaser.Types.Physics.Arcade.ImageWithDynamicBody & { prev?: { [key: string]: number } },
	otherPlayers: Phaser.Physics.Arcade.Group,
	cursors: Phaser.Types.Input.Keyboard.CursorKeys,
	blueScoreText: Phaser.GameObjects.Text,
	redScoreText: Phaser.GameObjects.Text,
	star: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
}

type PlayerObject = Phaser.GameObjects.GameObject
	& { playerId?: string }

type PlayerSprite = Phaser.GameObjects.Sprite
	& { playerId?: string }

function preload(this: Scene) {
	this.load.image('ship', 'assets/spaceShips_001.png')
	this.load.image('otherPlayer', 'assets/enemyBlack5.png')
	this.load.image('star', 'assets/star_gold.png')
}


function create(this: Scene) {
	this.socket = io('wss://161.35.192.46:3000')
	this.otherPlayers = this.physics.add.group()

	this.socket.on('currentPlayers', players => {
		Object.keys(players).forEach((id: string) => {
			if (players[id].playerId === this.socket.id) {
				addPlayer.call(this, players[id])
			}
			else addOtherPlayers.call(this, players[id])
		})
	})

	this.socket.on('newPlayer', (player: Player) => {
		addOtherPlayers.call(this, player)
	})

	this.socket.on('disconnected', (playerId: string) => {
		this.otherPlayers.getChildren()
			.forEach((otherPlayer: PlayerObject) => {
				if (playerId === otherPlayer.playerId) {
					otherPlayer.destroy()
				}
			})
	})

	this.cursors = this.input.keyboard!.createCursorKeys()

	this.socket.on('playerMoved', (player) => {
		this.otherPlayers.getChildren().forEach((otherPlayer: any) => {
			if (player.playerId === otherPlayer.playerId) {
				otherPlayer.setRotation(player.rotation)
				otherPlayer.setPosition(player.x, player.y)
			}
		})
	})

	this.blueScoreText = this.add.text(16, 16, '', { fontSize: '32px', color: '#0000FF' })
	this.redScoreText = this.add.text(584, 16, '', { fontSize: '32px', color: '#FF0000' })

	this.socket.on('scoreUpdate', (scores) => {
		this.blueScoreText.setText('Blue: ' + scores.blue)
		this.redScoreText.setText('Red: ' + scores.red)
	})

	this.socket.on('starLocation', (starLocation) => {
		if (this.star) this.star.destroy()
		this.star = this.physics.add.image(starLocation.x, starLocation.y, 'star')
		this.physics.add.overlap(this.ship, this.star, () => {
			this.socket.emit('starCollected')
		})
	})
}


enum Team {
	RED = 'red',
	BLUE = 'blue'
}

interface Player {
	rotation: number,
	x: number,
	y: number,
	playerId: string,
	team: Team
}

function addPlayer(this: Scene, player: Player) {
	this.ship = this.physics.add
		.image(player.x, player.y, 'ship')
		// .setOrigin(0.5, 0.5)
		.setScale(0.5)
	// .setDisplaySize(53, 40)
	if (player.team === Team.BLUE) {
		this.ship.setTint(0x0000ff)
	} else {
		this.ship.setTint(0xff0000)
	}
	this.ship.setDrag(100)
	this.ship.setAngularDrag(100)
	this.ship.setMaxVelocity(200)
}

function addOtherPlayers(this: Scene, player: Player) {
	const otherPlayer: PlayerSprite = this.add
		.sprite(player.x, player.y, 'otherPlayer')
		// .setOrigin(0.5, 0.5)
		// .setDisplaySize(53, 40)
		.setScale(0.5)
	if (player.team === Team.BLUE) {
		otherPlayer.setTint(0x0000ff)
	} else {
		otherPlayer.setTint(0xff0000)
	}
	otherPlayer.playerId = player.playerId
	this.otherPlayers.add(otherPlayer)
}


function update(this: Scene) {
	if (this.ship) {
		if (this.cursors.left.isDown) {
			this.ship.setAngularVelocity(-150)
		} else if (this.cursors.right.isDown) {
			this.ship.setAngularVelocity(150)
		} else {
			this.ship.setAngularVelocity(0)
		}

		if (this.cursors.up.isDown) {
			this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, this.ship.body.acceleration)
		} else {
			this.ship.setAcceleration(0)
		}

		this.physics.world.wrap(this.ship, 5)

		// pass ship movement to server
		if (this.ship.prev && (
			this.ship.x !== this.ship.prev.x ||
			this.ship.y !== this.ship.prev.y ||
			this.ship.rotation !== this.ship.prev.rotation
		)) {
			this.socket.emit('playerMovement', { x: this.ship.x, y: this.ship.y, rotation: this.ship.rotation })
		}
		// save previous position data
		this.ship.prev = {
			x: this.ship.x,
			y: this.ship.y,
			rotation: this.ship.rotation
		}
	}
}
