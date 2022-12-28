"use strict";(self.webpackChunkancientbeast=self.webpackChunkancientbeast||[]).push([[134],{40134:(e,t,r)=>{r.r(t),r.d(t,{default:()=>u});var a=r(16255),i=r(83355),n=r(23315),s=r(67790),c=r(68861);const u=function(e){e.abilities[3]=[{triggerFunc:function(){return this.isUpgraded()?"onUnderAttack onAttack":"onUnderAttack"},priority:10,require:function(e){return!!this.testRequirements()&&(!e||void 0===e.melee||e.melee&&!e.isFromTrap)},activate:function(t){var r=this,a=this.creature;if(t&&t.melee){var i=t.attacker===a?t.target:t.attacker,n={alterations:r.effects[0],creationTurn:e.turn-1,stackable:!0};r.end();var s=new c.Q(r.title,a,i,"",n,e);i.addEffect(s,void 0,"Contaminated"),e.log("%CreatureName"+i.id+"%'s regrowth is lowered by "+r.effects[0].regrowth),r.setUsed(!1)}}},{trigger:"onQuery",_targetTeam:i.S.Enemy,require:function(){return!!this.testRequirements()&&!!this.atLeastOneTarget(this.creature.getHexMap(n.y7),{team:this._targetTeam})},query:function(){var t=this.creature,r=this;e.grid.queryCreature({fnOnConfirm:function(){r.animation.apply(r,arguments)},team:this._targetTeam,id:t.id,flipped:t.flipped,hexes:t.getHexMap(n.y7)})},activate:function(t){var r=this;r.end(),e.Phaser.camera.shake(.01,65,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var i=new a.h(r.creature,r.damages,1,[],e),n=t.takeDamage(i);if(""===n.damageObj.status){var s=n.damages.total;if(this.isUpgraded()){var u=this.creature.stats.health-this.creature.health;if(u>0){var o=Math.min(s,u);s-=o,this.creature.heal(o,!1)}}s>0&&r.creature.addEffect(new c.Q(r.title,r.creature,r.creature,"",{turnLifetime:1,deleteTrigger:"onStartPhase",alterations:{regrowth:s}},e),"%CreatureName"+r.creature.id+"% gained "+s+" regrowth for now","Regrowth++")}r.creature.effects.forEach((function(e){"Frogger Bonus"==e.name&&e.deleteEffect()}))}},{trigger:"onQuery",require:function(){return this.creature.stats.moveable?this.testRequirements()&&this.creature.stats.moveable:(this.message=e.msg.abilities.notMoveable,!1)},fnOnSelect:function(e){this.creature.tracePosition({x:e.x,y:e.y,overlayClass:"creature moveto selected player"+this.creature.team})},query:function(){var t=this,r=this.creature,a=!this.isUpgraded()||this._isSecondLowJump(),i=this._getHexRange(a);e.grid.queryHexes({fnOnSelect:function(){t.fnOnSelect.apply(t,arguments)},fnOnConfirm:function(){arguments[0].x!=t.creature.x||arguments[0].y!=t.creature.y?t.animation.apply(t,arguments):t.query()},size:r.size,flipped:r.player.flipped,id:r.id,hexes:i,hexesDashed:[],hideNonTarget:!0})},activate:function(t){var r=this;if(r.end(!1,!0),this.isUpgraded()&&!this._isSecondLowJump()){for(var a=this._getHexRange(!0),i=!1,n=0;n<a.length;n++)a[n].x===t.x&&a[n].y===t.y&&(i=!0);i&&this.setUsed(!1)}r.creature.moveTo(t,{ignoreMovementPoint:!0,ignorePath:!0,callback:function(){e.Phaser.camera.shake(.03,90,!0,e.Phaser.camera.SHAKE_VERTICAL,!0),e.onStepIn(r.creature,r.creature.hexagons[0]);var t=setInterval((function(){e.freezedInput||(clearInterval(t),e.UI.selectAbility(-1),e.activeCreature.queryMove())}),100)}}),r.creature.addEffect(new c.Q("Offense Bonus",r.creature,r.creature,"onStepIn onEndPhase",{effectFn:function(e){e.deleteEffect()},alterations:r.effects[0]},e))},_getHexRange:function(t){var r=this.creature,a=e.grid.getHexMap(r.x,r.y,0,!1,n.hi);a=s.B0(a,!1,t,r.id);var i=e.grid.getHexMap(r.x,r.y,0,!0,n.hi);i=s.B0(i,!1,t,r.id);for(var c=a.concat(i).sort((function(e,t){return e.x-t.x})),u=0,o=0;o<c.length;o++)0===o||c[o-1].x+1===c[o].x?u++:(u<this.creature.size&&(c.splice(o-u,u),o-=u),u=1);return u<this.creature.size&&c.splice(c.length-u,u),c},_isSecondLowJump:function(){return 1===this.timesUsedThisTurn}},{trigger:"onQuery",_targetTeam:i.S.Enemy,require:function(){if(!this.testRequirements())return!1;var t=e.grid.getHexMap(this.creature.x-2,this.creature.y-2,0,!1,n.y7);return!!this.atLeastOneTarget(t,{team:this._targetTeam})},query:function(){var t=this,r=this.creature;e.grid.queryCreature({fnOnConfirm:function(){t.animation.apply(t,arguments)},team:this._targetTeam,id:r.id,flipped:r.flipped,hexes:e.grid.getHexMap(r.x-2,r.y-2,0,!1,n.y7)})},activate:function(t){var r=this;r.end(),e.Phaser.camera.shake(.03,100,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var i=new a.h(r.creature,r.damages,1,[],e),n=t.takeDamage(i);if(this.isUpgraded()&&!n.kill){var s=t.x-this.creature.x,c=t.y-this.creature.y,u=function(e,t,r){var a;return t>1&&(t=1),t<-1&&(t=-1),0===r?a=1===t?1:4:(e%2==0&&t<1&&t++,a=1===t?-1===r?0:2:1===r?3:5),a}(t.y,s,c),o=e.grid.getHexLine(t.x,t.y,u,t.flipped);o.length>=2&&o[1].isWalkable(t.size,t.id,!0)&&t.moveTo(o[1],{callback:function(){e.activeCreature.queryMove()},ignoreMovementPoint:!0,ignorePath:!0,overrideSpeed:500,animation:"push"})}r.creature.effects.forEach((function(e){"Offense Bonus"==e.name&&e.deleteEffect()}))}}]}},68861:(e,t,r)=>{r.d(t,{Q:()=>c});var a=r(15671),i=r(43144),n=r(19755),s=r(65482),c=function(){function e(t,r,i,s,c,u){(0,a.Z)(this,e),this.id=u.effectId++,this.game=u,this.name=t,this.owner=r,this.target=i,this.trigger=s,this.creationTurn=u.turn;var o=n.extend({requireFn:function(){return!0},effectFn:function(){},alterations:{},turnLifetime:0,deleteTrigger:"onStartOfRound",stackable:!0,noLog:!1,specialHint:void 0,deleteOnOwnerDeath:!1},c);n.extend(this,o),u.effects.push(this)}return(0,i.Z)(e,[{key:"animation",value:function(){this.activate.apply(this,arguments)}},{key:"activate",value:function(e){if(!this.requireFn(e))return!1;this.noLog||console.log("Effect "+this.name+" triggered"),e instanceof s.j&&e.addEffect(this),this.effectFn(this,e)}},{key:"deleteEffect",value:function(){var e=this.target.effects.indexOf(this);this.target.effects[e]?this.target.effects.splice(e,1):console.warn("Failed to find effect on target.",this);var t=this.game.effects.indexOf(this);this.game.effects[t]?this.game.effects.splice(t,1):console.warn("Failed to find effect on game.",this),this.target.updateAlteration()}}]),e}()}}]);