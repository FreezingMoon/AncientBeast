/* Spritesheet animation viewer, using HTML5 and javascript
 * Developed by Henrik Aarnio (hjaarnio) for the Ancient Beast project
 * And developed further by Archiboldian Cartheniscope (archiboldian)
 * 
 * Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

//defining the global variables, these get values in init function

if(beastsprite_class_loaded==undefined){

var BeastSprite = (function() {
	
	var self = this;
	
	this.c = null;		//canvas object
	this.ctx = null;	//its 2d context for drawing to canvas
	
	this.imageFile = null;

	this.canvasWidth = null;
	this.canvasHeight = null;

	this.playing = null;	//boolean for the state of animation; read only, use start() and stop() for triggering
	
	this.tickingThing = null;	//object for controlling setTimeOut()
	
	this.tempImg = null;
	
	//the next ones get values from the fields in html page
	
	this.currentFrame = null;
	
	this.imageCount = null;
	
	this.framerate = null;
	this.framestep = null;
	
	this.spriteWidth = null;
	this.spriteHeight = null;
	
	this.offset = null;     //space between sprites on the sheet
	
	this.bgColor = null;
	
	this.rows = null;
	this.columns = null;
	
	//location of the image
	this.imageX = null;
	this.imageY = null;
	
	//sprite data in json format
	this.sprite_json = null;
		
	// constructor
	function BeastSprite(canvas_id){	//setting up useful stuff needed; explained where defined
		this.c = document.getElementById(canvas_id);
		this.ctx = this.c.getContext("2d");
		this.canvasWidth = this.c.width;
		this.canvasHeight = this.c.height;
		this.currentFrame = 0;
		
		this.ctx.fillStyle = this.bgColor;
		
		this.playing = false;
	};
	
	
	BeastSprite.prototype.tick = function() {	//the basic action done every frame
		self = this;
		this.tickingThing = setTimeout(function(){self.tick();}, parseInt(1000 / this.framerate));
		this.loop();
		this.draw();
	}

	BeastSprite.prototype.loop = function() {	//increase currentFrame
		this.currentFrame += this.framestep;
		if(this.currentFrame >= this.imageCount) {
			this.currentFrame = 0;
		}
	}
	
	BeastSprite.prototype.draw = function() {	//draws the correct frame to canvas
		//clear first
		this.ctx.save();
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.clearRect(0, 0, this.c.width, this.c.height);
		this.ctx.restore();
		
		//fill the canvas	
		this.ctx.fillStyle = this.bgColor;
		this.ctx.fillRect(0,0, this.canvasWidth, this.canvasHeight)
		
		{
			//calculates the column and row for this frame
			this.row = Math.floor(this.currentFrame / this.columns);
			this.column = this.currentFrame - this.columns * this.row;
			
			//takes right part of image and puts on canvas
			this.ctx.drawImage(this.tempImg, this.column * this.spriteWidth + (this.column*2 + 1) * this.offset,
				this.row * this.spriteHeight + (this.row*2 + 1) * this.offset,
				this.spriteWidth, this.spriteHeight, this.imageX, this.imageY, this.spriteWidth, this.spriteHeight);
		}
	}

	BeastSprite.prototype.update_json = function() {
		this.sprite_json = JSON.stringify({
				fps: this.framerate,
				bcol: this.bgColor,
				sprw: this.spriteWidth,
				sprh: this.spriteHeight,
				icnt: this.imageCount,
				step: this.framestep,
				rows: this.rows,
				cols: this.columns,
				ix: this.imageX,
				iy: this.imageY,
				off: this.offset,
				img: this.imageFile
		});
		this.changeCanvasSize();
	}
	
	BeastSprite.prototype.load_json = function(json_string){
		this.framerate = json_string.fps;
		this.bgColor = json_string.bcol;
		this.spriteWidth = json_string.sprw;
		this.spriteHeight = json_string.sprh;
		this.imageCount = json_string.icnt;
		this.framestep = json_string.step;
		this.rows = json_string.rows;
		this.columns = json_string.cols;
		this.imageX = json_string.ix;
		this.imageY = json_string.iy;
		this.offset = json_string.off;
		this.imageFile = json_string.img;
		this.update_json();
	}
	BeastSprite.prototype.load_json_string = function(json_string){
		this.load_json(JSON.parse(json_string));
	}
	BeastSprite.prototype.load_json_b64 = function(json_string_b64){
		this.load_json_string(Base64.decode(json_string_b64));
	}
	
	BeastSprite.prototype.changeCanvasSize = function(){
		if (this.spriteWidth < 890){
				this.c.width = this.spriteWidth;
		}else this.c.width = 890;
		if (this.spriteHeight < 890){
				this.c.height = this.spriteHeight;
		} else this.c.height = 890;
	}
	
	BeastSprite.prototype.loadImage = function(onload){		//should be pretty self explatory
		this.stop();
		this.ctx.clearRect(0, 0, this.c.width, this.c.height);
		this.tempImg = new Image();
		this.tempImg.src = this.imageFile;
		this.tempImg.onload = onload;
	}
	
	BeastSprite.prototype.loadImageURL = function(imgURL, onload){
		this.imageFile = imgURL;
		this.loadImage();
	}


	BeastSprite.prototype.play = function(){ //starts the animation
		this.stop();		//stop needed, otherwise would pile the ticking processes
		this.playing=true;
		this.tick();
	}

	BeastSprite.prototype.stop = function(){		//stops the animation
		clearInterval(this.tickingThing);
		this.playing=false;
	}
		
	return BeastSprite;
})();

}

var beastsprite_class_loaded = true;

