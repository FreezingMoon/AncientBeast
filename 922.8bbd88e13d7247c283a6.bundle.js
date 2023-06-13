"use strict";(self.webpackChunkancientbeast=self.webpackChunkancientbeast||[]).push([[922],{98922:(e,t,r)=>{r.r(t),r.d(t,{default:()=>g});var i=r(19755),a=r(21094),n=r(83355),s=r(23315),h=r(67790),c=r(71956);const g=function(e){e.abilities[37]=[{trigger:"onCreatureMove",require:function(t){return!!this.testRequirements()&&(null==t&&(t=this.creature.hexagons[0]),this.message="",t.trap&&"mud-bath"==t.trap.type?(e.UI.abilitiesButtons[0].changeState("noclick"),!0):(this.message="Not in a mud bath.",this.creature.effects.forEach((function(e){"mud-bath"==e.trigger&&e.deleteEffect()})),!1))},activate:function(){var t=i.extend({},this.effects[0]);if(this.isUpgraded())for(var r in t)({}).hasOwnProperty.call(t,r)&&(t[r]=2*t[r]);var a=new c.Q("Spa Goggles",this.creature,this.creature,"mud-bath",{alterations:t},e);this.creature.addEffect(a);var n,s="%CreatureName"+this.creature.id+"%'s ",h=!0;for(var g in t)({}).hasOwnProperty.call(t,g)&&(h||(s+="and "),s+=g+" ",h=!1,n=t[g]);s+="+"+n,e.log(s)}},{trigger:"onQuery",_targetTeam:n.S.Enemy,require:function(){return!!this.testRequirements()&&!!this.atLeastOneTarget(this.creature.adjacentHexes(1),{team:this._targetTeam})},query:function(){var t=this,r=this.creature;e.grid.queryDirection({fnOnConfirm:function(){t.animation.apply(t,arguments)},flipped:r.player.flipped,team:this._targetTeam,id:r.id,requireCreature:!0,x:r.x,y:r.y,sourceCreature:r,stopOnCreature:!1,distance:1})},activate:function(t,r){var i=this;i.end(),e.Phaser.camera.shake(.01,100,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var n=h.Z$(t).creature,s=new a.h(i.creature,i.damages,1,[],e);if(!n.takeDamage(s).kill){var c=e.grid.getHexLine(n.x,n.y,r.direction,n.flipped);c.splice(0,1);for(var g=null,u=0;u<c.length&&c[u].isWalkable(n.size,n.id,!0)&&(g=c[u],this.isUpgraded());u++){for(var o=!0,d=0;d<n.size;d++){var f=e.grid.hexes[g.y][g.x-d];if(!f.trap||"mud-bath"!==f.trap.type){o=!1;break}}if(!o)break}null!==g&&n.moveTo(g,{callback:function(){e.activeCreature.queryMove()},ignoreMovementPoint:!0,ignorePath:!0,overrideSpeed:800,animation:"push"})}}},{trigger:"onQuery",_targetTeam:n.S.Enemy,require:function(){if(!this.testRequirements())return!1;var t=s.IA,r=s.hi,i=this.creature,a=h.B0(e.grid.getHexMap(i.x,i.y-2,0,!1,t),!0,!0,i.id,i.team).concat(h.B0(e.grid.getHexMap(i.x,i.y,0,!1,r),!0,!0,i.id,i.team),h.B0(e.grid.getHexMap(i.x,i.y,0,!1,t),!0,!0,i.id,i.team),h.B0(e.grid.getHexMap(i.x,i.y-2,0,!0,t),!0,!0,i.id,i.team),h.B0(e.grid.getHexMap(i.x,i.y,0,!0,r),!0,!0,i.id,i.team),h.B0(e.grid.getHexMap(i.x,i.y,0,!0,t),!0,!0,i.id,i.team));return!!this.atLeastOneTarget(a,{team:this._targetTeam})},query:function(){var t=s.IA,r=s.hi,i=this,a=this.creature,n=[e.grid.getHexMap(a.x,a.y-2,0,!1,t),e.grid.getHexMap(a.x,a.y,0,!1,r),e.grid.getHexMap(a.x,a.y,0,!1,t),e.grid.getHexMap(a.x,a.y-2,0,!0,t),e.grid.getHexMap(a.x,a.y,0,!0,r),e.grid.getHexMap(a.x,a.y,0,!0,t)];n.forEach((function(e){h.B0(e,!0,!0,a.id)})),e.grid.queryChoice({fnOnConfirm:function(){i.animation.apply(i,arguments)},team:this._targetTeam,requireCreature:1,id:a.id,flipped:a.flipped,choices:n})},activate:function(t){var r=this;r.end(),e.Phaser.camera.shake(.01,60,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var i=h.Z$(t).creature;if(this.isUpgraded()){var n=new c.Q("Ground Ball",r.creature,i,"onDamage",{alterations:{meditation:-1}},e);i.addEffect(n),e.log("%CreatureName"+i.id+"%'s meditation is lowered by 1")}var s=new a.h(r.creature,r.damages,1,[],e);i.takeDamage(s)}},{trigger:"onQuery",_energyNormal:30,_energySelfUpgraded:10,require:function(){return this.isUpgraded()?(this.requirements={energy:this._energySelfUpgraded},this.costs={energy:this._energySelfUpgraded}):(this.requirements={energy:this._energyNormal},this.costs={energy:this._energyNormal}),this.testRequirements()},query:function(){var t=this,r=this.creature,i=[];this.isUpgraded()&&this.creature.energy<this._energyNormal||(i=e.grid.getFlyingRange(r.x,r.y,50,1,0)),i.push(e.grid.hexes[r.y][r.x]),e.grid.queryHexes({fnOnCancel:function(){e.activeCreature.queryMove()},fnOnConfirm:function(){t.animation.apply(t,arguments)},hexes:i,hideNonTarget:!0})},activate:function(t){var r=this,i=this.creature,a=t.x===i.x&&t.y===i.y;this.isUpgraded()&&a?(this.requirements={energy:this._energySelfUpgraded},this.costs={energy:this._energySelfUpgraded}):(this.requirements={energy:this._energyNormal},this.costs={energy:this._energyNormal}),r.end();var n=[new c.Q("Slow Down",r.creature,t,"onStepIn",{requireFn:function(){return!!this.trap.hex.creature&&"A1"!=this.trap.hex.creature.type},effectFn:function(e,t){t.remainingMove--}},e)];t.createTrap("mud-bath",n,r.creature.player),e.soundsys.playSFX("sounds/mudbath"),a&&e.onCreatureMove(i,t)}}]}},71956:(e,t,r)=>{r.d(t,{Q:()=>a});var i=r(18394);class a{constructor(e,t,r,i,a,n){this.effectFn=()=>{},this.requireFn=e=>!0,this.alterations={},this.turnLifetime=0,this.deleteTrigger="onStartOfRound",this.stackable=!0,this.specialHint=void 0,this.deleteOnOwnerDeath=!1,this._trap=void 0,this.attacker=void 0,this.id=n.effectId++,this.game=n,this.name=e,this.owner=t,this.target=r,this.trigger=i,this.creationTurn=n.turn;for(const e of Object.keys(a))e in this&&(this[e]=a[e]);n.effects.push(this)}animation(...e){e?this.activate(...e):this.activate()}activate(e){if(!this.requireFn(e))return!1;e instanceof i.j&&e.addEffect(this),this.effectFn(this,e)}deleteEffect(){if("effects"in this.target){const e=this.target.effects.indexOf(this);this.target.effects[e]?this.target.effects.splice(e,1):console.warn("Failed to find effect on target.",this)}const e=this.game.effects.indexOf(this);this.game.effects[e]?this.game.effects.splice(e,1):console.warn("Failed to find effect on game.",this),"updateAlteration"in this.target&&this.target.updateAlteration()}get trap(){return this._trap}set trap(e){this._trap=e}}}}]);