var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Game = (function (_super) {
    __extends(Game, _super);
    function Game() {
        _super.call(this, 1920, 1080, Phaser.AUTO, null);

        this.state.add('preloadState', preload.State, false);
        this.state.add('loadState', load.State, false);
        this.state.add('battleState', battle.State, false);

        this.state.start('preloadState', false, false, 'battleState');
    }
    return Game;
})(Phaser.Game);

window.onload = function () {
    new Game();
};
var battle;
(function (battle) {
    var State = (function (_super) {
        __extends(State, _super);
        function State() {
            _super.apply(this, arguments);
        }
        State.prototype.create = function () {
            new battle.Background(this, 0, 0, 'background');
            new battle.Unit(this, 0, 0, 'unit');

            for (var y = 0; y < 11; y++) {
                if (y % 2) {
                    for (var x = 0; x < 15; x++) {
                        new battle.Tile(this, 285 + 90 * x, 380 + 62 * y, 'hex');
                    }
                } else {
                    for (var x = 0; x < 16; x++) {
                        new battle.Tile(this, 285 - 45 + 90 * x, 380 + 62 * y, 'hex');
                    }
                }
            }
        };
        return State;
    })(Phaser.State);
    battle.State = State;
})(battle || (battle = {}));
var battle;
(function (battle) {
    var Background = (function (_super) {
        __extends(Background, _super);
        function Background(state, x, y, name) {
            _super.call(this, state.game, x, y, name);
            this.state = state;

            state.game.add.existing(this);
        }
        return Background;
    })(Phaser.Sprite);
    battle.Background = Background;
})(battle || (battle = {}));
var battle;
(function (battle) {
    var Hero = (function (_super) {
        __extends(Hero, _super);
        function Hero(state, x, y, name) {
            _super.call(this, state.game, x, y, name);
            this.state = state;

            state.game.add.existing(this);
        }
        return Hero;
    })(Phaser.Sprite);
    battle.Hero = Hero;
})(battle || (battle = {}));
var battle;
(function (battle) {
    var Tile = (function (_super) {
        __extends(Tile, _super);
        function Tile(state, x, y, name) {
            _super.call(this, state.game, x, y, name);
            this.state = state;

            this.anchor.setTo(0.5);
            this.scale.y = 0.8;

            state.game.add.existing(this);
        }
        return Tile;
    })(Phaser.Sprite);
    battle.Tile = Tile;
})(battle || (battle = {}));
var battle;
(function (battle) {
    var Unit = (function (_super) {
        __extends(Unit, _super);
        function Unit(state, x, y, name) {
            _super.call(this, state.game, x, y, name);
            this.state = state;

            state.game.add.existing(this);
        }
        return Unit;
    })(Phaser.Sprite);
    battle.Unit = Unit;
})(battle || (battle = {}));
var game;
(function (game) {
    var State = (function (_super) {
        __extends(State, _super);
        function State() {
            _super.apply(this, arguments);
            this.enemyCountLeft = 0;
        }
        State.prototype.create = function () {
            this.map = [
                [2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 2, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0],
                [2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0],
                [0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0],
                [0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2],
                [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2],
                [2, 2, 2, 0, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0],
                [2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 2, 2, 2, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];

            this.startingPositions = [{ x: 14, y: 0 }, { x: 35, y: 0 }, { x: 47, y: 0 }, { x: 47, y: 15 }, { x: 47, y: 33 }, { x: 29, y: 33 }, { x: 12, y: 33 }];
            this.spawnPosition = [{ x: 14, y: -1 }, { x: 35, y: -1 }, { x: 48, y: -1 }, { x: 48, y: 15 }, { x: 48, y: 34 }, { x: 29, y: 34 }, { x: 12, y: 34 }];

            this.waves = [
                {
                    start: this.startingPositions[6],
                    spawn: this.spawnPosition[6],
                    enemyCount: 20,
                    health: 100,
                    timer: 2,
                    speed: 1200
                },
                {
                    start: this.startingPositions[1],
                    spawn: this.spawnPosition[1],
                    enemyCount: 30,
                    health: 120,
                    timer: 1.5,
                    speed: 1000
                },
                {
                    start: this.startingPositions[3],
                    spawn: this.spawnPosition[3],
                    enemyCount: 50,
                    health: 150,
                    timer: 1.2,
                    speed: 900
                },
                {
                    start: this.startingPositions[5],
                    spawn: this.spawnPosition[5],
                    enemyCount: 70,
                    health: 200,
                    timer: 1,
                    speed: 800
                },
                {
                    start: this.startingPositions[2],
                    spawn: this.spawnPosition[2],
                    enemyCount: 80,
                    health: 300,
                    timer: 0.9,
                    speed: 700
                },
                {
                    start: this.startingPositions[4],
                    spawn: this.spawnPosition[4],
                    enemyCount: 100,
                    health: 420,
                    timer: 0.8,
                    speed: 600
                },
                {
                    start: this.startingPositions[1],
                    spawn: this.spawnPosition[1],
                    enemyCount: 110,
                    health: 500,
                    timer: 0.7,
                    speed: 550
                },
                {
                    start: this.startingPositions[4],
                    spawn: this.spawnPosition[4],
                    enemyCount: 130,
                    health: 600,
                    timer: 0.5,
                    speed: 500
                },
                {
                    start: this.startingPositions[6],
                    spawn: this.spawnPosition[6],
                    enemyCount: 150,
                    health: 750,
                    timer: 0.4,
                    speed: 450
                }
            ];

            this.nextWaveNumber = 0;

            this.enemies = [];

            this.energy = 700;

            this.events = {
                destroyPath: new Phaser.Signal()
            };

            this.music = this.add.audio('main');
            this.music.loop = true;
            this.music.play();

            new game.MusicSwitch(this, { x: 300, y: this.world.height - 50, name: 'soundOn' });

            this.dunk = this.add.audio('dunk');
            this.dunk.volume = 0.2;
            this.hit = this.add.audio('hit');
            this.hit.volume = 0.5;
            this.nope = this.add.audio('nope');
            this.nope.volume = 0.2;

            this.game.stage.backgroundColor = 'e2a179';

            this.game.add.sprite(0, 0, 'base');
            this.game.add.sprite(250, 720, 'dragtobuild');
            new game.BaseTurret(this, { x: 290, y: 460, name: 'wall', price: 0, group: this.buildingSort });
            new game.BaseTurret(this, { x: 290, y: 550, name: 'wall', price: 0, group: this.buildingSort });

            new game.Start(this, { x: 5, y: 380, name: 'start' });

            new game.Button(this, { x: 5, y: 830, name: 'wall' });
            new game.Button(this, { x: 205, y: 830, name: 'turret' });
            new game.Button(this, { x: 5, y: 890, name: 'freezer' });
            new game.Button(this, { x: 205, y: 890, name: 'howitzer' });
            new game.Button(this, { x: 5, y: 950, name: 'tesla' });
            new game.Button(this, { x: 205, y: 950, name: 'nuker' });

            this.sortGroup = this.game.add.group();
            this.buildingSort = this.game.add.group();
            this.sortGroup.add(new game.Wall(this, { x: 15, y: 826, name: 'wall', price: 30, group: this.sortGroup }));
            this.buildingSort.add(new game.Turret(this, { x: 215, y: 810, name: 'turret', price: 100, group: this.buildingSort }));
            this.buildingSort.add(new game.Freezer(this, { x: 15, y: 870, name: 'freezer', price: 400, group: this.buildingSort }));
            this.buildingSort.add(new game.Howitzer(this, { x: 215, y: 870, name: 'howitzer', price: 500, group: this.buildingSort }));
            this.buildingSort.add(new game.Tesla(this, { x: 15, y: 930, name: 'tesla', price: 800, group: this.buildingSort }));
            this.buildingSort.add(new game.Nuker(this, { x: 215, y: 930, name: 'nuker', price: 1500, group: this.buildingSort }));

            this.energyText = this.add.text(10, this.world.height - 35, 'Your energy: ' + this.energy, {});

            for (var i = 0; i < 34; i++) {
                this.sortGroup.add(new game.HillsLayer(this, { x: 400, y: 32 * i, atlas: 'hills', name: 'hills_' + i + '.png' }));
            }

            var wave = this.waves[this.nextWaveNumber];

            var grid = new PF.Grid(48, 34, this.map);
            var finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
            var path = finder.findPath(wave.start.x, wave.start.y, 0, 18, grid);

            this.markPath(path);
        };

        State.prototype.update = function () {
            this.sortGroup.sort('y', Phaser.Group.SORT_ASCENDING);
            this.buildingSort.sort('y', Phaser.Group.SORT_ASCENDING);
        };

        State.prototype.startWave = function (id) {
            var _this = this;
            if (this.enemyCountLeft > 0) {
                if (this.music.isPlaying) {
                    this.nope.play();
                }
                return;
            }

            this.events.destroyPath.dispatch();
            this.enemyCountLeft = this.waves[this.nextWaveNumber].enemyCount;

            var wave = this.waves[id];

            var grid = new PF.Grid(48, 34, this.map);
            var finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
            var path;
            path = finder.findPath(wave.start.x, wave.start.y, 0, 18, grid);
            var pathCopy = [];

            this.game.time.events.repeat(Phaser.Timer.SECOND * wave.timer, wave.enemyCount, function () {
                pathCopy = path.slice(0);
                var enemy = new game.Enemy(_this, { xId: wave.spawn.x, yId: wave.spawn.y, name: 'enemy', path: pathCopy, health: wave.health, speed: wave.speed });
                _this.enemies.push(enemy);
                _this.sortGroup.add(enemy);
            }, this);
        };

        State.prototype.markPath = function (path) {
            var _this = this;
            path.forEach(function (tile) {
                _this.sortGroup.add(new game.Marker(_this, { xId: tile[0], yId: tile[1], name: 'marker' }));
            });
        };

        State.prototype.changeEnergy = function (amount) {
            this.energy += amount;
            this.energyText.setText('Your energy: ' + this.energy);
        };

        State.prototype.recalculate = function (building, xId, yId, id) {
            this.events.destroyPath.dispatch();

            var wave = this.waves[this.nextWaveNumber];

            var grid = new PF.Grid(48, 34, this.map);
            var finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
            var path = [];
            path = finder.findPath(wave.start.x, wave.start.y, 0, 18, grid);

            if (!path.length || this.enemyCountLeft > 0) {
                this.map[yId][xId] = 0;
                building.blocksPath();
                return;
            }

            this.markPath(path);
        };

        State.prototype.waveCounter = function () {
            this.enemyCountLeft--;
            if (this.enemyCountLeft == 0) {
                this.nextWaveNumber++;

                if (this.nextWaveNumber == 9) {
                    this.game.state.start('textState', true, true, "You won! Due to time limit, take this text line as a big flashy victory screen");
                    return;
                }

                var wave = this.waves[this.nextWaveNumber];

                var grid = new PF.Grid(48, 34, this.map);
                var finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
                var path = finder.findPath(wave.start.x, wave.start.y, 0, 18, grid);

                this.markPath(path);
            }
        };
        return State;
    })(Phaser.State);
    game.State = State;
})(game || (game = {}));
var game;
(function (game) {
    var Background = (function (_super) {
        __extends(Background, _super);
        function Background(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name);
            this.state = state;

            state.game.add.existing(this);
        }
        return Background;
    })(Phaser.Sprite);
    game.Background = Background;
})(game || (game = {}));
var game;
(function (game) {
    var Building = (function (_super) {
        __extends(Building, _super);
        function Building(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name);
            this.state = state;
            this.data = data;

            state.game.add.existing(this);

            this.inputEnabled = true;
            this.input.enableDrag(true, true);

            this.events.onDragStart.add(this.dragStarted, this);
            this.events.onDragStop.add(this.dragStopped, this);
            this.input.enableSnap(32, 32, true, true, 400);
        }
        Building.prototype.update = function () {
            if (this.followCircle) {
                this.circle.x = this.x + 16;
                this.circle.y = this.y + 32;
            }
        };

        Building.prototype.dragStarted = function () {
            if (this.state.energy < this.data.price) {
                if (this.state.music.isPlaying) {
                    this.state.nope.play();
                }
                this.rebuild();
                this.destroy();
                return;
            }

            this.circle = this.state.game.add.graphics(this.x + 16, this.y + 32);

            this.circle.lineStyle(1, 0xff0000);
            this.circle.drawCircle(0, 0, this.range * 2);

            this.followCircle = true;

            this.state.changeEnergy(-this.data.price);
        };

        Building.prototype.dragStopped = function () {
            this.circle.destroy();

            this.rebuild();

            var xId = Math.round((this.x - 400) / 32);
            var yId = Math.round((this.y) / 32);

            this.inputEnabled = false;
            this.repurpose(xId, yId);
        };

        Building.prototype.repurpose = function (xId, yId) {
            yId++;

            if (typeof this.state.map[yId][xId] == 'undefined' || this.state.map[yId][xId] !== 2) {
                this.state.changeEnergy(this.data.price);
                if (this.state.music.isPlaying) {
                    this.state.nope.play();
                }
                this.destroy();

                return;
            }

            if (this.state.music.isPlaying) {
                this.state.dunk.play();
            }

            this.state.map[yId][xId] = 5;
        };

        Building.prototype.rebuild = function () {
            this.data.group.add(new Building(this.state, this.data));
        };
        return Building;
    })(Phaser.Sprite);
    game.Building = Building;
})(game || (game = {}));
var game;
(function (game) {
    var BaseTurret = (function (_super) {
        __extends(BaseTurret, _super);
        function BaseTurret(state, data) {
            var _this = this;
            _super.call(this, state, data);
            this.state = state;
            this.data = data;
            this.fireRate = 0.5;
            this.range = 300;
            this.dmg = 50;

            state.game.add.existing(this);

            this.rangeSq = this.range * this.range;

            this.alpha = 0;
            this.inputEnabled = false;

            this.game.time.events.loop(Phaser.Timer.SECOND * this.fireRate, function () {
                if (_this.inputEnabled == false) {
                    for (var i = 0; i < _this.state.enemies.length; i++) {
                        var enemy = _this.state.enemies[i];
                        if (enemy.game) {
                            var deltax = enemy.x - _this.x + 16;
                            var deltay = enemy.y - _this.y + 32;
                            var distanceSq = deltax * deltax + deltay * deltay;
                            if (distanceSq < _this.rangeSq) {
                                if (_this.state.music.isPlaying) {
                                    _this.state.hit.play();
                                }

                                enemy.dmg(_this.dmg);
                                break;
                            }
                        }
                    }
                }
            }, this);
        }
        BaseTurret.prototype.rebuild = function () {
            this.data.group.add(new game.Turret(this.state, this.data));
        };
        return BaseTurret;
    })(game.Building);
    game.BaseTurret = BaseTurret;
})(game || (game = {}));
var game;
(function (game) {
    var Freezer = (function (_super) {
        __extends(Freezer, _super);
        function Freezer(state, data) {
            var _this = this;
            _super.call(this, state, data);
            this.state = state;
            this.data = data;
            this.fireRate = 0.5;
            this.range = 100;
            this.dmg = 5;

            state.game.add.existing(this);

            this.rangeSq = this.range * this.range;

            this.game.time.events.loop(Phaser.Timer.SECOND * this.fireRate, function () {
                if (_this.inputEnabled == false) {
                    for (var i = 0; i < _this.state.enemies.length; i++) {
                        var enemy = _this.state.enemies[i];
                        if (enemy.game) {
                            var deltax = enemy.x - _this.x + 16;
                            var deltay = enemy.y - _this.y + 32;
                            var distanceSq = deltax * deltax + deltay * deltay;
                            if (distanceSq < _this.rangeSq) {
                                enemy.dmg(_this.dmg);
                                enemy.slow();
                                break;
                            }
                        }
                    }
                }
            }, this);
        }
        Freezer.prototype.rebuild = function () {
            this.data.group.add(new Freezer(this.state, this.data));
        };
        return Freezer;
    })(game.Building);
    game.Freezer = Freezer;
})(game || (game = {}));
var game;
(function (game) {
    var Howitzer = (function (_super) {
        __extends(Howitzer, _super);
        function Howitzer(state, data) {
            var _this = this;
            _super.call(this, state, data);
            this.state = state;
            this.data = data;
            this.fireRate = 2;
            this.range = 250;
            this.dmg = 60;

            state.game.add.existing(this);

            this.rangeSq = this.range * this.range;

            this.game.time.events.loop(Phaser.Timer.SECOND * this.fireRate, function () {
                if (_this.inputEnabled == false) {
                    for (var i = 0; i < _this.state.enemies.length; i++) {
                        var enemy = _this.state.enemies[i];
                        if (enemy.game) {
                            var deltax = enemy.x - _this.x + 16;
                            var deltay = enemy.y - _this.y + 32;
                            var distanceSq = deltax * deltax + deltay * deltay;
                            if (distanceSq < _this.rangeSq) {
                                if (_this.state.music.isPlaying) {
                                    _this.state.hit.play();
                                }

                                enemy.dmg(_this.dmg);
                                break;
                            }
                        }
                    }
                }
            }, this);
        }
        Howitzer.prototype.rebuild = function () {
            this.data.group.add(new Howitzer(this.state, this.data));
        };
        return Howitzer;
    })(game.Building);
    game.Howitzer = Howitzer;
})(game || (game = {}));
var game;
(function (game) {
    var Nuker = (function (_super) {
        __extends(Nuker, _super);
        function Nuker(state, data) {
            var _this = this;
            _super.call(this, state, data);
            this.state = state;
            this.data = data;
            this.fireRate = 3;
            this.range = 500;
            this.dmg = 400;

            state.game.add.existing(this);

            this.rangeSq = this.range * this.range;

            this.game.time.events.loop(Phaser.Timer.SECOND * this.fireRate, function () {
                if (_this.inputEnabled == false) {
                    for (var i = 0; i < _this.state.enemies.length; i++) {
                        var enemy = _this.state.enemies[i];
                        if (enemy.game) {
                            var deltax = enemy.x - _this.x + 16;
                            var deltay = enemy.y - _this.y + 32;
                            var distanceSq = deltax * deltax + deltay * deltay;
                            if (distanceSq < _this.rangeSq) {
                                if (_this.state.music.isPlaying) {
                                    _this.state.hit.play();
                                }

                                enemy.dmg(_this.dmg);
                                break;
                            }
                        }
                    }
                }
            }, this);
        }
        Nuker.prototype.rebuild = function () {
            this.data.group.add(new Nuker(this.state, this.data));
        };
        return Nuker;
    })(game.Building);
    game.Nuker = Nuker;
})(game || (game = {}));
var game;
(function (game) {
    var Tesla = (function (_super) {
        __extends(Tesla, _super);
        function Tesla(state, data) {
            var _this = this;
            _super.call(this, state, data);
            this.state = state;
            this.data = data;
            this.fireRate = 0.2;
            this.range = 100;
            this.dmg = 20;

            state.game.add.existing(this);

            this.rangeSq = this.range * this.range;

            this.game.time.events.loop(Phaser.Timer.SECOND * this.fireRate, function () {
                if (_this.inputEnabled == false) {
                    for (var i = 0; i < _this.state.enemies.length; i++) {
                        var enemy = _this.state.enemies[i];
                        if (enemy.game) {
                            var deltax = enemy.x - _this.x + 16;
                            var deltay = enemy.y - _this.y + 32;
                            var distanceSq = deltax * deltax + deltay * deltay;
                            if (distanceSq < _this.rangeSq) {
                                enemy.dmg(_this.dmg);
                                break;
                            }
                        }
                    }
                }
            }, this);
        }
        Tesla.prototype.rebuild = function () {
            this.data.group.add(new Tesla(this.state, this.data));
        };
        return Tesla;
    })(game.Building);
    game.Tesla = Tesla;
})(game || (game = {}));
var game;
(function (game) {
    var Turret = (function (_super) {
        __extends(Turret, _super);
        function Turret(state, data) {
            var _this = this;
            _super.call(this, state, data);
            this.state = state;
            this.data = data;
            this.fireRate = 1;
            this.range = 150;
            this.dmg = 25;

            state.game.add.existing(this);

            this.rangeSq = this.range * this.range;

            this.game.time.events.loop(Phaser.Timer.SECOND * this.fireRate, function () {
                if (_this.inputEnabled == false) {
                    for (var i = 0; i < _this.state.enemies.length; i++) {
                        var enemy = _this.state.enemies[i];
                        if (enemy.game) {
                            var deltax = enemy.x - _this.x + 16;
                            var deltay = enemy.y - _this.y + 32;
                            var distanceSq = deltax * deltax + deltay * deltay;
                            if (distanceSq < _this.rangeSq) {
                                if (_this.state.music.isPlaying) {
                                    _this.state.hit.play();
                                }

                                enemy.dmg(_this.dmg);
                                break;
                            }
                        }
                    }
                }
            }, this);
        }
        Turret.prototype.rebuild = function () {
            this.data.group.add(new Turret(this.state, this.data));
        };
        return Turret;
    })(game.Building);
    game.Turret = Turret;
})(game || (game = {}));
var game;
(function (game) {
    var Wall = (function (_super) {
        __extends(Wall, _super);
        function Wall(state, data) {
            _super.call(this, state, data);
            this.state = state;
            this.data = data;

            state.game.add.existing(this);
        }
        Wall.prototype.repurpose = function (xId, yId) {
            if (typeof this.state.map[yId][xId] == 'undefined' || this.state.map[yId][xId] == 2 || this.state.map[yId][xId] == 4) {
                this.state.changeEnergy(this.data.price);
                if (this.state.music.isPlaying) {
                    this.state.nope.play();
                }
                this.destroy();
                return;
            }

            this.state.map[yId][xId] = 4;

            if (this.state.music.isPlaying) {
                this.state.dunk.play();
            }

            this.y += 16;

            this.state.recalculate(this, xId, yId, 2);
        };

        Wall.prototype.rebuild = function () {
            this.data.group.add(new Wall(this.state, this.data));
        };

        Wall.prototype.blocksPath = function () {
            this.state.changeEnergy(this.data.price);
            this.destroy();
            if (this.state.music.isPlaying) {
                this.state.nope.play();
            }

            this.state.recalculate(0, 0, 0, 0);
        };
        return Wall;
    })(game.Building);
    game.Wall = Wall;
})(game || (game = {}));
var game;
(function (game) {
    var Button = (function (_super) {
        __extends(Button, _super);
        function Button(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name + 'Button');
            this.state = state;

            state.game.add.existing(this);
        }
        return Button;
    })(Phaser.Sprite);
    game.Button = Button;
})(game || (game = {}));
var game;
(function (game) {
    var Enemy = (function (_super) {
        __extends(Enemy, _super);
        function Enemy(state, data) {
            _super.call(this, state.game, data.xId * 32 + 400, data.yId * 32, data.name);
            this.state = state;
            this.data = data;
            this.bounty = 30;

            state.game.add.existing(this);

            this.health = data.health;
            this.speed = data.speed;

            this.animations.add('walk', [0, 1, 2, 1, 0]);
            this.animations.play('walk', 8, true);

            this.tint = Math.random() * 0xffffff;

            this.tweenAlongPath();
        }
        Enemy.prototype.tweenAlongPath = function () {
            if (!this.data.path.length) {
                this.finished();
                return;
            }

            var tile = this.data.path.shift();

            var x = 32 * tile[0] + 400;
            var y = 32 * tile[1];

            var tween = this.state.game.add.tween(this);

            tween.to({ y: y + 10, x: x }, this.speed, Phaser.Easing.Linear.None, true, 0, 0);
            tween.onComplete.add(this.tweenAlongPath, this);
        };

        Enemy.prototype.finished = function () {
            if (this.health > 0) {
                this.game.state.start('textState', true, true, "Your base was destroyed!");
            }
        };

        Enemy.prototype.dmg = function (amount) {
            this.health -= amount;
            new game.Explosion(this.state, { x: this.x, y: this.y, name: 'boom' });
            if (this.health <= 0) {
                this.state.changeEnergy(this.bounty);
                this.state.waveCounter();
                this.destroy();
            }
        };

        Enemy.prototype.slow = function () {
            var _this = this;
            this.speed = this.speed * 2;
            this.state.game.time.events.add(Phaser.Timer.SECOND * 3, function () {
                _this.speed = _this.data.speed * 2;
            }, this);
        };
        return Enemy;
    })(Phaser.Sprite);
    game.Enemy = Enemy;
})(game || (game = {}));
var game;
(function (game) {
    var Explosion = (function (_super) {
        __extends(Explosion, _super);
        function Explosion(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name);
            this.state = state;

            state.game.add.existing(this);

            this.alpha = 0;
            this.tweens = this.state.game.add.tween(this);

            this.tweenIn();
        }
        Explosion.prototype.tweenIn = function () {
            this.tweens.to({ alpha: 1 }, 200, Phaser.Easing.Quadratic.InOut).to({ alpha: 0 }, 500, Phaser.Easing.Quadratic.InOut);
            this.tweens.onComplete.add(this.tweenEnded, this);
            this.tweens.start();
        };

        Explosion.prototype.tweenEnded = function () {
            this.destroy();
        };
        return Explosion;
    })(Phaser.Sprite);
    game.Explosion = Explosion;
})(game || (game = {}));
var game;
(function (game) {
    var HillsLayer = (function (_super) {
        __extends(HillsLayer, _super);
        function HillsLayer(state, data) {
            _super.call(this, state.game, data.x, data.y - 0.01, data.atlas, data.name);
            this.state = state;

            state.game.add.existing(this);
        }
        return HillsLayer;
    })(Phaser.Sprite);
    game.HillsLayer = HillsLayer;
})(game || (game = {}));
var game;
(function (game) {
    var Marker = (function (_super) {
        __extends(Marker, _super);
        function Marker(state, data) {
            _super.call(this, state.game, data.xId * 32 + 400, data.yId * 32 + 16, data.name);
            this.state = state;

            state.game.add.existing(this);

            this.animations.add('glow', [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0]);
            this.animations.play('glow', 15, true);

            state.events.destroyPath.add(this.destroy, this);
        }
        return Marker;
    })(Phaser.Sprite);
    game.Marker = Marker;
})(game || (game = {}));
var game;
(function (game) {
    var MusicSwitch = (function (_super) {
        __extends(MusicSwitch, _super);
        function MusicSwitch(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name);
            this.state = state;

            state.game.add.existing(this);

            this.inputEnabled = true;

            this.scale.setTo(0.5);

            this.events.onInputUp.add(this.clicked, this);
        }
        MusicSwitch.prototype.clicked = function () {
            if (this.state.music.isPlaying) {
                this.state.music.pause();
                this.loadTexture('soundOff', {});
            } else {
                this.state.music.resume();
                this.loadTexture('soundOn', {});
            }
        };
        return MusicSwitch;
    })(Phaser.Sprite);
    game.MusicSwitch = MusicSwitch;
})(game || (game = {}));
var game;
(function (game) {
    var Start = (function (_super) {
        __extends(Start, _super);
        function Start(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name);
            this.state = state;

            state.game.add.existing(this);

            this.inputEnabled = true;

            this.events.onInputUp.add(this.clicked, this);
        }
        Start.prototype.clicked = function () {
            this.state.startWave(this.state.nextWaveNumber);
        };
        return Start;
    })(Phaser.Sprite);
    game.Start = Start;
})(game || (game = {}));
var load;
(function (load) {
    var State = (function (_super) {
        __extends(State, _super);
        function State() {
            _super.apply(this, arguments);
        }
        State.prototype.init = function (nextState) {
            this.nextState = nextState;
        };

        State.prototype.preload = function () {
            new load.Logo(this, { x: this.game.width / 2, y: this.game.height / 2, name: 'ugnis' });

            this.load.image('background', 'images/bg2.jpg');
            this.load.image('hex', 'images/hex.png');
            this.load.image('unit', 'images/CyberHound.png');
        };

        State.prototype.create = function () {
            this.game.state.start(this.nextState);
        };
        return State;
    })(Phaser.State);
    load.State = State;
})(load || (load = {}));
var preload;
(function (preload) {
    var State = (function (_super) {
        __extends(State, _super);
        function State() {
            _super.apply(this, arguments);
        }
        State.prototype.init = function (nextState) {
            this.nextState = nextState;
            this.game.scale.scaleMode = Phaser.ScaleManager.EXACT_FIT;
        };

        State.prototype.preload = function () {
            this.load.image('ugnis', 'images/ugnis.jpg');
        };

        State.prototype.create = function () {
            this.game.state.start('loadState', false, false, this.nextState);
        };
        return State;
    })(Phaser.State);
    preload.State = State;
})(preload || (preload = {}));
var load;
(function (load) {
    var Logo = (function (_super) {
        __extends(Logo, _super);
        function Logo(state, data) {
            _super.call(this, state.game, data.x, data.y, data.name);
            this.state = state;

            this.anchor.setTo(0.5);
            this.alpha = 0;

            state.game.add.existing(this);

            this.tween = state.game.add.tween(this);
            this.tweenIn();

            this.text = state.game.add.text(this.x, this.y + this.height / 2 + 20, 'LOADING:' + ' 0%', {});

            this.text.anchor.set(0.5, 0.5);
            this.text.align = 'center';

            this.text.font = 'Arial Black';
            this.text.fontSize = 50;
            this.text.fontWeight = 'bold';

            this.text.stroke = '#000000';
            this.text.strokeThickness = 6;
            this.text.fill = '#ffffff';

            state.game.load.onFileComplete.add(this.fileComplete, this);
        }
        Logo.prototype.tweenIn = function () {
            this.tween.to({ alpha: 1 }, 1500, Phaser.Easing.Quadratic.InOut, true, 0, -1, true);
        };

        Logo.prototype.fileComplete = function (progress) {
            this.text.setText('LOADING: ' + progress + '%');
        };
        return Logo;
    })(Phaser.Sprite);
    load.Logo = Logo;
})(load || (load = {}));
//# sourceMappingURL=game.js.map
