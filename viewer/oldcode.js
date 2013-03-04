/* Spritesheet animation viewer, using HTML5 and javascript
 * Developed by Henrik Aarnio (hjaarnio) for the Ancient Beast project
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

var c;		//canvas object
var ctx;	//its 2d context for drawing to canvas

var imageFile;
var defaultImageFile = "spritesheet.png"	//the source for default spritesheet

var canvasWidth;
var canvasHeight

var playing;	//boolean for the state of animation; read only, use start() and stop() for triggering

var tickingThing;	//object for controlling setTimeOut()

var tempImg;

//the next ones get values from the fields in html page

var currentFrame;

var imageCount;

var framerate;
var framestep;

var spriteWidth;
var spriteHeight;

var offset;	//space between sprites on the sheet

var bgColor;

var rows;
var columns;

	//location of the image
var imageX;
var imageY;

//sprite data in json format
var sprite_json;

function init() {	//setting up useful stuff needed; explained where defined
	c = document.getElementById("kanvas");
	ctx = c.getContext("2d");
	canvasWidth = c.width;
	canvasHeight = c.height;
	currentFrame = 0;

	ctx.fillStyle = bgColor;

	updateFields();
	
	playing = true;
}

function tick() {	//the basic action done every frame
	tickingThing = window.setTimeout("tick();", parseInt(1000 / framerate));
	loop();
	draw();
}

function loop() {	//increase currentFrame
	currentFrame += framestep;
	if(currentFrame >= imageCount) {
		currentFrame = 0;
	}
}

function draw() {	//draws the correct frame to canvas
	//clear first
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, c.width, c. height);
	ctx.restore();
	
	//fill the canvas	
	ctx.fillStyle = bgColor;
	ctx.fillRect(0,0, canvasWidth, canvasHeight)
	
	{
		//calculates the column and row for this frame
		row = Math.floor(currentFrame / columns);
		column = currentFrame - columns * row;
		
		//takes right part of image and puts on canvas
		ctx.drawImage(tempImg, column * spriteWidth + (column*2 + 1) * offset,
			 row * spriteHeight + (row*2 + 1) * offset,
			 spriteWidth, spriteHeight, imageX, imageY, spriteWidth, spriteHeight);
	}
}

function loadImage(){	//should be pretty self explatory
	tempImg = new Image();
	tempImg.src = imageFile;
	tempImg.onload = play();
}


function play(){ //starts the animation
	stop();	//stop needed, otherwise would pile the ticking processes
	playing=true;
	tick();
}

function stop(){	//stops the animation
	clearInterval(tickingThing);
	playing=false;
}

// function getImages() { //this function reads the image into a array of imageData objects
						  // it should not be needed, unless pixel-wise operations have to be done
// 
		// var tempCanv = document.createElement("canvas");
		// tempCanv.width = tempImg.width;
		// tempCanv.height = tempImg.height;
// 
		// tempCanv.getContext("2d").fillStyle = bgColor;
		// tempCanv.getContext("2d").fillRect(0, 0, tempCanv.width, tempCanv.height)
		// tempCanv.getContext("2d").drawImage(tempImg, 0, 0);
// 
		// //alert("have canvas: "+tempCanv+", "+tempCanv.getContext("2d"))
// 
		// //alert("rows: "+rows);
		// for( i = 0; i < imageCount; i++) {
			// row = Math.floor(i / columns);
			// column = i - i * row;
			// //alert("row: "+row+" column:"+column)
			// //alert(column*spriteWidth+", "+row*spriteHeight)
			// images[i] = tempCanv.getContext("2d").getImageData(column * spriteWidth, row * spriteHeight, spriteWidth, spriteHeight);
		// }
// 	
// }

function updateFields() {	//duh, updates the values defined in index.html
	framerate = parseInt(document.getElementById("textField0").value);
	bgColor = document.getElementById("textField1").value;
	spriteWidth = parseInt(document.getElementById("textField2").value);
	spriteHeight = parseInt(document.getElementById("textField3").value);
	imageCount = parseInt(document.getElementById("textField4").value);
	framestep = parseInt(document.getElementById("textField5").value);
	rows = parseInt(document.getElementById("textField6").value);
	columns = parseInt(document.getElementById("textField7").value);
	imageX = parseInt(document.getElementById("textField8").value);
	imageY = parseInt(document.getElementById("textField9").value);
	offset = parseInt(document.getElementById("textField10").value);
	
	sprite_json = JSON.stringify({
		fps: framerate,
		bcol: bgColor,
		sprw: spriteWidth,
		sprh: spriteHeight,
		icnt: imageCount,
		step: framestep,
		rows: rows,
		cols: columns,
		ix: imageX,
		iy: imageY,
		off: offset
	});
	
	document.getElementById("JSON_out").value = sprite_json;
	
	document.getElementById("download_link").innerHTML = '<a href="data:application/octet-stream;charset=utf-8;base64,'+Base64.encode(sprite_json)+'">Save</a>';
	document.getElementById("share_link").innerHTML = '<a href="'+site_root+"viewer/?s="+Base64.encode(sprite_json)+'" target="_blank" >Copy</a>';
	
	changeCanvasSize();

	imageFile = document.getElementById("textField11").value;
	if (imageFile == "sample"){
		imageFile = defaultImageFile;
	}
	loadImage();
}

function changeCanvasSize(){
	if (spriteWidth < 890){
		c.width = spriteWidth;
	}else c.width = 890;
	if (spriteHeight < 890){
		c.height = spriteHeight;
	} else c.height = 890;
}

function pauseButtonPressed(){
	if(playing){
		stop();
		document.getElementById("pauseButton").innerHTML="Play";
	} else{
		play();
		document.getElementById("pauseButton").innerHTML="Pause";
	}
}
