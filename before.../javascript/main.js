/*
www.AncientBeast.com
www.FreezingMoon.org
*/

var canvas = document.getElementById("AncientBeast");
var context = canvas.getContext('2d');
var FPS = 30;
setInterval(function() {
  update();
  draw();
}, 1000/FPS);

context.fillStyle = "black";
context.fillRect(0,0,800,600);

//center horizontally
var x = canvas.width / 2;

//header
var logo = new Image();
logo.src = "interface/logo.png";
logo.onload = function() { context.drawImage(logo, x, 30); };

//background

//main menu
context.shadowOffsetX = -2;
context.shadowOffsetY = 2;
context.shadowColor = "#333";
context.shadowBlur = .01;
context.fillStyle = "white";
context.font = "64px Bevelicious";
context.fillText("PLAY",x,300);
context.fillText("OPTIONS",x,400);
context.fillText("CREDITS",x,500);

//cursor
//var cursor = new Game.spr('interface/cursor.png', 64, 64, 59, 0),
//cursor.position(32, 32, 2);

//version
context.font = "14px Verdana";
context.fillText("build 110531",700,580);
