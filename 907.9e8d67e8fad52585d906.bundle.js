"use strict";(self.webpackChunkancientbeast=self.webpackChunkancientbeast||[]).push([[907],{70907:(e,t,r)=>{r.r(t),r.d(t,{default:()=>u});var i=r(19755),a=r(16255),n=r(83355),s=r(23315),c=r(67790);const u=function(e){e.abilities[12]=[{trigger:"onCreatureMove onOtherCreatureMove",require:function(e){if(!this.testRequirements())return!1;if(this.creature===this.game.activeCreature)return!1;if(!e.creature)return!1;var t=[];if(e.creature===this.creature)t=this._detectFrontHexesWithEnemy();else if((0,n.H)(e.creature,this.creature,n.S.Enemy)){var r=this._findEnemyHexInFront(e);r&&t.push(r)}return t.length&&this.timesUsedThisTurn<this._getUsesPerTurn()&&!this.creature.materializationSickness&&!this.creature.isFrozen()&&this._getHopHex()},activate:function(t){this.end(),e.Phaser.camera.shake(.01,55,!0,e.Phaser.camera.SHAKE_VERTICAL,!0),this.creature.moveTo(this._getHopHex(),{callback:function(){e.activeCreature.queryMove()},ignorePath:!0,ignoreMovementPoint:!0})},_getUsesPerTurn:function(){return this.isUpgraded()?2:1},_getHopHex:function(){var e,t=this._detectFrontHexesWithEnemy();if(t.find((function(e){return 1===e.direction}))||t.find((function(e){return 0===e.direction}))&&t.find((function(e){return 2===e.direction}))?e=this.creature.getHexMap(s.mT)[0]:t.find((function(e){return 0===e.direction}))?e=this.creature.getHexMap(s.EO)[0]:t.find((function(e){return 2===e.direction}))&&(e=this.creature.getHexMap(s.xb)[0]),void 0!==e&&e.isWalkable(this.creature.size,this.creature.id,!0)||(e=this.creature.getHexMap(s.mT)[0]),void 0===e||e.isWalkable(this.creature.size,this.creature.id,!0))return e},_findEnemyHexInFront:function(e){return this._detectFrontHexesWithEnemy().some((function(t){var r=t.hex;return e.creature===r.creature}))?e:void 0},_detectFrontHexesWithEnemy:function(){var e=this;return this.creature.getHexMap(s.IY).reduce((function(t,r,i){return r.creature&&(0,n.H)(r.creature,e.creature,n.S.Enemy)&&t.push({direction:i,hex:r}),t}),[])}},{trigger:"onQuery",_targetTeam:n.S.Enemy,require:function(){return!!this.testRequirements()&&!!this.atLeastOneTarget(this.creature.adjacentHexes(1),{team:this._targetTeam})},query:function(){var t=this,r=this.creature;e.grid.queryCreature({fnOnConfirm:function(){t.animation.apply(t,arguments)},team:this._targetTeam,id:r.id,flipped:r.player.flipped,hexes:r.adjacentHexes(1)})},activate:function(t){var r=this;r.end(),e.Phaser.camera.shake(.01,100,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var i=r.damages;if(this.isUpgraded()&&t.isFrozen())for(var n in i={pure:0},r.damages)({}).hasOwnProperty.call(r.damages,n)&&(i.pure+=r.damages[n]);var s=new a.h(r.creature,i,1,[],e);t.takeDamage(s)}},{trigger:"onQuery",directions:[1,1,1,1,1,1],_targetTeam:n.S.Both,require:function(){return!!this.testRequirements()&&!!this.testDirection({team:this._targetTeam,directions:this.directions})},query:function(){var t=this,r=this.creature;e.grid.queryDirection({fnOnConfirm:function(){t.animation.apply(t,arguments)},flipped:r.player.flipped,team:this._targetTeam,id:r.id,requireCreature:!0,x:r.x,y:r.y,directions:this.directions})},activate:function(t,r){this.end();var i=c.Z$(t).creature,a=5-(this.isUpgraded()&&i.isFrozen()?0:i.size),n=[];switch(r.direction){case 0:n=e.grid.getHexMap(i.x,i.y-8,0,i.flipped,s.pe).reverse();break;case 1:n=e.grid.getHexMap(i.x,i.y,0,i.flipped,s.hi);break;case 2:n=e.grid.getHexMap(i.x,i.y,0,i.flipped,s.m$);break;case 3:n=e.grid.getHexMap(i.x,i.y,-4,i.flipped,s.pe);break;case 4:n=e.grid.getHexMap(i.x,i.y,0,!i.flipped,s.hi);break;case 5:n=e.grid.getHexMap(i.x,i.y-8,-4,i.flipped,s.m$).reverse()}var u=i.hexagons[0];i.moveTo(u,{ignoreMovementPoint:!0,ignorePath:!0,callback:function(){e.activeCreature.queryMove()},animation:"push"}),e.Phaser.camera.shake(.01,400,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0),n=n.slice(0,a+1);for(var o=0;o<n.length&&n[o].isWalkable(i.size,i.id,!0);o++)u=n[o];i.moveTo(u,{ignoreMovementPoint:!0,ignorePath:!0,callback:function(){e.activeCreature.queryMove()},animation:"push"}),e.Phaser.camera.shake(.01,400,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0)}},{trigger:"onQuery",_targetTeam:n.S.Enemy,require:function(){return!!this.testRequirements()&&!!this.testDirection({team:this._targetTeam,directions:this.directions})},query:function(){var t=this,r=this.creature;e.grid.queryDirection({fnOnConfirm:function(){t.animation.apply(t,arguments)},flipped:r.player.flipped,team:this._targetTeam,id:r.id,requireCreature:!0,x:r.x,y:r.y,directions:[1,1,1,1,1,1]})},activate:function(t,r){var n=this;n.end(),e.Phaser.camera.shake(.01,90,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var s=t.find((function(e){return e.creature})).creature,c=e.animations.projectile(this,s,"effects_freezing-spit",t,r,52,-20),u=c[0],o=c[1],h=c[2];u.onComplete.add((function(){this.destroy();var t=i.extend({},n.damages);t.crush+=3*h;var r=new a.h(n.creature,t,1,[],e),c=s.takeDamage(r);n.isUpgraded()&&c.damageObj.melee&&s.freeze()}),o)}}]}}}]);