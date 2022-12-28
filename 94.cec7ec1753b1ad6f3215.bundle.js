"use strict";(self.webpackChunkancientbeast=self.webpackChunkancientbeast||[]).push([[94],{96094:(e,t,r)=>{r.r(t),r.d(t,{default:()=>u});var a=r(19755),i=r(16255),n=r(83355),s=r(23315),h=r(67790),c=r(65482);const u=function(e){e.abilities[31]=[{triggerFunc:function(){return this.isUpgraded()?"onStartPhase onEndPhase":"onStartPhase"},require:function(){return this.testRequirements()},activate:function(){var t=this.creature.getHexMap(s.dU);if(!(t.length<1)){var r=t[0].creature;if(r&&(0,n.H)(this.creature,r,n.S.Enemy)){this.end();var a=new i.h(this.creature,this.damages,1,[],e);r.takeDamage(a),e.Phaser.camera.shake(.01,123,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0),this.setUsed(!1)}}}},{trigger:"onQuery",_targetTeam:n.S.Enemy,require:function(){return!!this.testRequirements()&&!!this.atLeastOneTarget(this.creature.getHexMap(s.y7),{team:this._targetTeam})},query:function(){var t=this,r=this.creature;e.grid.queryCreature({fnOnConfirm:function(){t.animation.apply(t,arguments)},team:this._targetTeam,id:r.id,flipped:r.player.flipped,hexes:r.getHexMap(s.y7)})},activate:function(t){var r=this;r.end(),e.Phaser.camera.shake(.01,150,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var a=new i.h(r.creature,r.damages,1,[],e);if(t.takeDamage(a),this.isUpgraded()){var n=Math.min(8,t.energy);t.energy-=n,this.creature.recharge(n),e.log("%CreatureName"+this.creature.id+"% steals "+n+" energy from %CreatureName"+t.id+"%")}}},{trigger:"onQuery",require:function(){return this.isUpgraded()?(this.requirements={energy:30},this.costs={energy:30}):(this.requirements={energy:40},this.costs={energy:40}),this.testRequirements()},query:function(){var t=this,r=this.creature,a=s.hi,i=s.IA,c=[h.B0(e.grid.getHexMap(r.x,r.y-2,0,!1,i),!0,!0,r.id).concat(h.B0(e.grid.getHexMap(r.x,r.y,0,!1,a),!0,!0,r.id),h.B0(e.grid.getHexMap(r.x,r.y,0,!1,i),!0,!0,r.id)),h.B0(e.grid.getHexMap(r.x-1,r.y-2,0,!0,i),!0,!0,r.id).concat(h.B0(e.grid.getHexMap(r.x-1,r.y,0,!0,a),!0,!0,r.id),h.B0(e.grid.getHexMap(r.x-1,r.y,0,!0,i),!0,!0,r.id))];c[0].choiceId=0,c[1].choiceId=1,e.grid.queryChoice({fnOnCancel:function(){e.activeCreature.queryMove()},fnOnConfirm:function(){t.animation.apply(t,arguments)},team:n.S.Both,id:r.id,requireCreature:!1,choices:c})},activate:function(t){var r=this;r.end(),e.Phaser.camera.shake(.02,350,!0,e.Phaser.camera.SHAKE_HORIZONTAL,!0);var a,n=this.creature,u=s.hi,g=s.IA;a=0===t.choiceId?[h.B0(e.grid.getHexMap(n.x,n.y-2,0,!1,g),!0,!0,n.id),h.B0(e.grid.getHexMap(n.x,n.y,0,!1,u),!0,!0,n.id),h.B0(e.grid.getHexMap(n.x,n.y,0,!1,g),!0,!0,n.id)]:[h.B0(e.grid.getHexMap(n.x-1,n.y-2,0,!0,g),!0,!0,n.id),h.B0(e.grid.getHexMap(n.x-1,n.y,0,!0,u),!0,!0,n.id),h.B0(e.grid.getHexMap(n.x-1,n.y,0,!0,g),!0,!0,n.id)];for(var d=0;d<a.length;d++)if(0!==a[d].length&&a[d][a[d].length-1].creature instanceof c.j){var o=a[d][a[d].length-1].creature,m=new i.h(r.creature,r.damages,1,[],e);o.takeDamage(m)}else this.token+=1;this.token>0&&e.log("%CreatureName"+this.creature.id+"% missed "+this.token+" rocket(s)")}},{trigger:"onQuery",require:function(){return!(!this.testRequirements()||0===this.creature.abilities[2].token&&(this.message="No rocket launched.",1))},query:function(){var t=this,r=this.creature,a=e.grid.allhexes.slice(0);e.grid.queryCreature({fnOnConfirm:function(){t.animation.apply(t,arguments)},team:n.S.Enemy,id:r.id,flipped:r.player.flipped,hexes:a})},activate:function(t){this.end(),e.Phaser.camera.shake(.03,333,!0,e.Phaser.camera.SHAKE_VERTICAL,!0);var r=t,n=this.creature.abilities[2],s=n.token;this.isUpgraded()||(s=Math.min(s,2)),n.token-=s;var h=a.extend({},n.damages);for(var c in h)({}).hasOwnProperty.call(h,c)&&(h[c]*=s);e.log("%CreatureName"+this.creature.id+"% redirects "+s+" rocket(s)");var u=new i.h(this.creature,h,1,[],e);r.takeDamage(u)}}]}}}]);