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
            this.battleGround = [
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ];

            new battle.Background(this, 0, 0, 'background');

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

            new battle.Wolf(this, 0, 0, 'unit');
        };
        return State;
    })(Phaser.State);
    battle.State = State;
})(battle || (battle = {}));
var battle;
(function (battle) {
    var PathFinder = (function () {
        function PathFinder(unit, xId, yId, speed, size) {
            this.unit = unit;
            this.xId = xId;
            this.yId = yId;
            this.speed = speed;
            this.size = size;
            this.grid = unit.state.battleGround;

            this.generatePaths();
        }
        PathFinder.prototype.generatePaths = function () {
            var _this = this;
            this.gridCopy = [];

            for (var y = 0; y < this.grid.length; y++) {
                this.gridCopy.push(this.grid[y].slice());
            }

            this.fringes = [];
            this.fringes.push({ xId: this.xId, yId: this.yId, path: [] });
            this.newFringes = [];

            for (var dist = 0; dist < this.speed; dist++) {
                this.fringes.forEach(function (fringe) {
                    _this.checkAroundTile(fringe);
                });
                this.fringes = this.newFringes;
            }
        };

        PathFinder.prototype.checkAroundTile = function (fringe) {
            var _this = this;
            var tileToCheck;
            var x = fringe.xId;
            var y = fringe.yId;

            if (y % 2) {
                tileToCheck = [
                    { x: x, y: y - 1 }, { x: x + 1, y: y - 1 },
                    { x: x - 1, y: y }, { x: x + 1, y: y },
                    { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }
                ];
            } else {
                tileToCheck = [
                    { x: x - 1, y: y - 1 }, { x: x, y: y - 1 },
                    { x: x - 1, y: y }, { x: x + 1, y: y },
                    { x: x - 1, y: y + 1 }, { x: x, y: y + 1 }
                ];
            }

            tileToCheck.forEach(function (position) {
                if (position.y < 0 || position.y > _this.gridCopy.length - 1) {
                    return;
                }

                var row = _this.gridCopy[position.y];

                if (position.x < 0 || position.x > row.length - 1) {
                    return;
                }

                var path = _this.getPath(position.x, position.y);

                if (path) {
                    return;
                }

                var tile = row[position.x];

                if (tile === 0) {
                    var newPath = fringe.path.slice();
                    newPath.push(position);

                    var node = {
                        xId: position.x,
                        yId: position.y,
                        path: newPath
                    };

                    _this.gridCopy[position.y][position.x] = newPath;
                    _this.newFringes.push(node);
                }
            });
        };

        PathFinder.prototype.getPath = function (xId, yId) {
        };
        return PathFinder;
    })();
    battle.PathFinder = PathFinder;
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
        function Unit(state, name, xId, yId, speed, size) {
            _super.call(this, state.game, 0, 0, name);
            this.state = state;
            this.xId = xId;
            this.yId = yId;
            this.speed = speed;
            this.size = size;

            this.x = 200 + xId * 90;
            this.y = 400 + yId * 64;

            this.state.battleGround[yId][xId] = this;

            this.anchor.setTo(0, 1);

            this.pathFinder = new battle.PathFinder(this, xId, yId, speed, size);

            state.game.add.existing(this);
        }
        return Unit;
    })(Phaser.Sprite);
    battle.Unit = Unit;
})(battle || (battle = {}));
var battle;
(function (battle) {
    var Wolf = (function (_super) {
        __extends(Wolf, _super);
        function Wolf(state, xId, yId, name) {
            _super.call(this, state, name, xId, yId, 4, 1);

            this.inputEnabled = true;
            this.input.enableDrag(true);
        }
        return Wolf;
    })(battle.Unit);
    battle.Wolf = Wolf;
})(battle || (battle = {}));
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
