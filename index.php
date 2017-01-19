
<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2014  Valentin Anastase (a.k.a. Dread Knight)
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
 * https://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

$style = '
a.FM:hover { text-shadow: black 0.1em 0.1em 0.2em, blue 0 0 10px; }
.image { cursor: pointer; display: inline-block; padding-left: 10px; }
.small { width: 128px; height: 128px; }

#screenshot { display: inline-block; position: relative; vertical-align: top; margin: 10px; width: 390px; }
#screenshot img { position: absolute; z-index: 8; top: 0; padding: 0px; margin: 0px; border-color: grey !important; }
#screenshot IMG.active { z-index: 10; }
#screenshot IMG.last-active { z-index: 9; }

.abilities a { color: white; }
.abilities .ability .wrapper { height: 104px !important; padding-left: 107px !important; }
.abilities .icon, .contour { width: 104px !important; height: 104px !important; }
';
$stylesheet = 'units/cards.css';

require_once 'header.php'; 
?>

<div class="center">
	<!-- Featured Blog Article -->
	<div style="display: inline-block;" class="lighten">
		<a href="design"><img src="images/squares/design.jpg" style="width: 290px; height: 290px;" class="frame" alt="Game Design Document"><br>
		<div class="button" style="background-image: url(images/push_button.png);">Game Design Document</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="game"><img src="images/squares/play.jpg" style="width: 290px; height: 290px;" class="frame" alt="Play the Game"><br>
		<div class="button" style="background-image: url(images/push_button.png); ;">Play the Game for Free</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="contribute"><img src="images/squares/contribute.jpg" style="width: 290px; height: 290px;" class="frame" alt="Make Your Contribution"><br>
		<div class="button" style="background-image: url(images/push_button.png);">Make Your Contribution</div></a>
	</div>
</div>

<div class="div" id="intro">
<div style="width: 475px; text-align: justify; display: inline-block;">
<h3 class="indexheader"><a href="#intro">Intro</a></h3>
<p>
<b>Ancient Beast</b> is a turn based strategy indie game project, played against other people (or bots) in hotseat or online modes, featuring a wide variety of units to acquire and put to good use in order to defeat all your opponents in battle.<br>This project was carefully designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it as well!
</p><p>
Ancient Beast is <a href="https://mega.co.nz/#F!GAJAjAzL!AhBUayQndZbH_j2IL2B-nA" target="_blank">free</a> and <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a>, being developed by <a href="http://www.FreezingMoon.org" target="_blank" class="FM"><b>Freezing Moon</b></a> and community. It uses web technologies such as HTML, PHP, JavaScript and Node.js, so that it's playable from modern browsers without requiring plugins.</p></div>
<div class="lighten" id="screenshot"><a href="media/?type=screenshots#id=0">
<img src="images/thumbs/screenie1.png" class="image frame active" style="width: 400px; height: 225px;" alt="Screenshot 1">
<img src="images/thumbs/screenie2.png" class="image frame" style="opacity: 0; width: 400px; height: 225px;" alt="Screenshot 2">
<img src="images/thumbs/screenie3.png" class="image frame" style="opacity: 0; width: 400px; height: 225px;" alt="Screenshot 3">
<div class="center" style="padding-top: 235px;"><b>Check out some screenshots!</b></div></a></div>
</div>

<!-- Game Features -->
<div class="div center" id="features">
	<div class="center" style="display: inline-block; vertical-align: top;">
		<div id="artwork" class="card sideA" style="background-image: url(<?php echo $site_root; ?>images/cards/margin.png), url(<?php echo $site_root; ?>images/features/1.jpg);">
			<!-- Card Anchor -->
			<a href="#" title="Go to the next card" onClick="nextCard(); return false;"><div style="height: 100%;"></div></a>

			<!-- Display unit info -->
			<a href="#" class="name" style="color: white;" onClick="nextCard(); return false;"><div class="section info sinG">
					Check out the game features (<span id="position">1</span>/3)
			</div></a>
		</div></div>

	<!-- Side B -->
	<div class="card sideB" style="background-image: url(<?php echo $site_root; ?>images/cards/margin.png), url(<?php echo $site_root; ?>images/cards/G.jpg);">
		<div class="section abilities" onClick="nextCard();" style="cursor: pointer;">
	  		<!-- Display Abilities -->
			<div class="ability">
				<div id="first_icon" class="icon">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="first_title" class="underline"></h3>
						<span class="desc" id="desc"></span>
					</div>
				</div>
			</div>
			<div class="ability">
				<div id="second_icon" class="icon">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="second_title"></h3>
						<span class="desc" id="desc"></span>
					</div>
				</div>
			</div>
			<div class="ability">
				<div id="third_icon" class="icon">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="third_title"></h3>
						<span class="desc" id="desc"></span>
					</div>
				</div>
			</div>
			<div class="ability">
				<div id="fourth_icon" class="icon">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="fourth_title"></h3>
						<span class="desc" id="desc"></span>
					</div>
				</div>
			</div>
			<div class="ability">
				<div id="fifth_icon" class="icon">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="fifth_title"></h3>
						<span class="desc" id="desc"></span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Contribution Widget -->
<div class="div center" id="contribute">
	<!-- Left Side -->
	<div class="card sideB" style="background-image: url(<?php echo $site_root; ?>images/cards/margin.png), url(<?php echo $site_root; ?>images/cards/G.jpg);">
	  	<!-- Display main ways to contribute -->
		<div class="section abilities">

			<div class="ability">
				<a href="contribute/#donate">
				<div id="first_icon" class="icon" style="background-image: url(<?php echo $site_root; ?>images/contribute/donate.svg);">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="first_title" class="underline">Donate</h3>
						<span class="desc" id="desc">You can donate to the project directly via PayPal or Bitcoin and we also have nice Patreon and Bountysource pages.</span>
					</div>
				</div>
				</a>
			</div>

			<div class="ability">
				<a href="contribute/#artwork">
				<div id="second_icon" class="icon" style="background-image: url(<?php echo $site_root; ?>images/contribute/artwork.svg);">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="second_title" class="underline">Artwork</h3>
						<span class="desc" id="desc">You can donate existing artwork that you think it could nicely fit the project or offer your skills to create new stuff.</span>
					</div>
				</div>
				</a>
			</div>

			<div class="ability">
				<a href="contribute/#coding">
				<div id="third_icon" class="icon" style="background-image: url(<?php echo $site_root; ?>images/contribute/coding.svg);">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="third_title" class="underline">Coding</h3>
						<span class="desc" id="desc">We can always use an extra coding hand adding new functionality to the game or website and to squash bugs.</span>
					</div>
				</div>
				</a>
			</div>

			<div class="ability">
				<a href="contribute/#audio">
				<div id="fourth_icon" class="icon" style="background-image: url(<?php echo $site_root; ?>images/contribute/audio.svg);">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="fourth_title" class="underline">Audio</h3>
						<span class="desc" id="desc">Fast paced epic tracks can really set players in the mood for combat, while sound effects can empower abilities.</span>
					</div>
				</div>
				</a>
			</div>

			<div class="ability">
				<a href="contribute"> <!-- TODO: add custom link when category is added in the contribute page -->
				<div id="fifth_icon" class="icon" style="background-image: url(<?php echo $site_root; ?>images/contribute/writing.svg);">
					<div class="contour"></div>
				</div>
				<div class="wrapper">
					<div class="info">
						<h3 id="fifth_title" class="underline">Writing</h3>
						<span class="desc" id="desc">Create exciting stories about the crazy and dangerous adventures that your favorite project units could undergo.</span>
					</div>
				</div>
				</a>
			</div>

		</div>
	</div>

	<!-- Right Side -->
	<div class="center" style="display: inline-block; vertical-align: top;">
		<div id="artwork" class="card sideA" style="background-image: url(<?php echo $site_root; ?>images/cards/margin.png), url(<?php echo $site_root; ?>images/teamwork.jpg);">
			<!-- Card Anchor -->
			<a href="contribute" title="Check out the contribution page"><div style="height: 100%;"></div></a>
	
			<!-- Display unit info -->
			<a href="#" class="name" style="color: white;">
				<div class="section info sinL">
					Contribute to this project today!
				</div>
			</a>
		</div>
	</div>
</div>

<div class="div" id="plot">
	<img src="images/hand.png" class="image lighten" onClick="toggleSound();" style="cursor: pointer; width: 400px; height: 387px;" title="Click to play narrative" alt="Click to paly narrative">
	<audio id="narration" src="plot.ogg"></audio>

	<div style="width: 475px; text-align: justify; display: inline-block;">
		<h3 class="indexheader"><a href="#plot">Plot</a></h3>
		<p>
		It's the year 2653. In the last few centuries, technology advanced exponentially and everyone had a fair chance of playing God. With help from the <a href="http://reprap.org" target="_blank"><b>RepRap</b></a> project, a free desktop 3d printer, which gave anyone power to build their own weapon factory or genetic laboratory on their own property. Mechanic parts or genetic modifications turned from a fashion option into a requirement for daily survival.
		</p><p>
	Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield, split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here and only the strong ones will surpass it.
		</p>
		<div class="center"><audio id="narration" controls src="plot.ogg" style="width: 475px;"></audio></div>
		<br>
	</div>
</div>

<?php
include 'blog/subscribe.php';
include 'footer.php';
?>

<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>

<!-- Screenshot Thumbnail Slideshow -->
<script>
function nextSlide() {
	var x = $('#screenshot img:not(.active)');
	return $(x[Math.floor(Math.random() * x.length)]);
}

function slideSwitch() {
	var active = $('#screenshot img.active');
	if (active.length == 0)
 		active = nextSlide();
	var next = nextSlide();
	active.addClass('last-active');
	next.css({ opacity: 0.0 })
  	.addClass('active')
  	.animate({ opacity: 1.0 }, 1000, function() {
	active.removeClass('active last-active');
	});
}
$(function() { setInterval("slideSwitch()", 4000); });

// Toggle Plot Narration
function toggleSound() {
	var audioElem = document.getElementById('narration');
	if (audioElem.paused) audioElem.play();
	else audioElem.pause();
}

// Show next info card
var i = 0;
var total = 3;
function nextCard() {
	i = i%total+1;
	$("#position").html(i);
	$("#artwork").css("background", "url(images/cards/margin.png), url(images/features/" + i + ".jpg)");

	$("#first_icon").css("background", "url(images/features/" + i + "-1.svg)");
	$("#second_icon").css("background", "url(images/features/" + i + "-2.svg)");
	$("#third_icon").css("background", "url(images/features/" + i + "-3.svg)");
	$("#fourth_icon").css("background", "url(images/features/" + i + "-4.svg)");
	$("#fifth_icon").css("background", "url(images/features/" + i + "-5.svg)");
	switch(i) {
		case 1:
			$("#first_title").html("<u>Free Game</u>").next().html("We're putting a lot of love and effort into this game project using free tools, we want to give back something nice.");
			$("#second_title").html("<u>Fun Gameplay</u>").next().html("You can materialise and control a variety of units in order to do your bidding and defeat all your foes.");
			$("#third_title").html("<u>Easy to Learn</u>").next().html("Intimidated at first sight? No worries, everything is being explained during gameplay in a very non intrusive way.");
			$("#fourth_title").html("<u>Ultra Replayable</u>").next().html("There are basically an almost infinite combination of units and moves that can be done so no 2 battles are alike.");
			$("#fifth_title").html("<u>Hard to Master</u>").next().html("The game only relies on pure skill and never on dice throws, chances or other luck factors. It is always all up to you!");
		break;
		case 2:
			$("#first_title").html("<u>Awesome Units</u>").next().html("They come in lots of shapes and sizes, serving as the tools to fulfil your will. Each unit comes with unique abilities.");
			$("#second_title").html("<u>Town Building</u> - Coming Soon").next().html("You'll be going through a lot of fuss in order to acquire all those resources so that you can make various structures.");
			$("#third_title").html("<u>Online Multiplayer</u> - Coming Soon").next().html("You can challenge anyone in the world to a battle while you can also team up with your best friend in 2vs2 matches.");
			$("#fourth_title").html("<u>Challenging Bots</u> - Coming Soon").next().html("Want to play a practice match to polish up your skills or try out some new cool strategy you thought of? No problem.");
			$("#fifth_title").html("<u>Arcade Mode</u>").next().html("Having a few mates over in your living room? Enjoy playing together on your TV while also having a slice of pizza.");
		break;
		case 3:
			$("#first_title").html("<u>Light Weight</u>").next().html("Everything is carefully optimized so that you can enjoy playing on pretty much any device with a web browser.");
			$("#second_title").html("<u>Offline Game</u> - Coming Soon").next().html("You can download and play the game even at those times when you do not have an internet connection available.");
			$("#third_title").html("<u>Optional User</u>").next().html("Eager to play? Go right ahead, you can enjoy most of the game without even having to spend any time registering.");
			$("#fourth_title").html("<u>Input Methods</u> - Coming Soon").next().html("Given the way it was designed, you have the freedom to play this using most input methods you can think of.");
			$("#fifth_title").html("<u>Open Source</u>").next().html("This project is mostly a community effort, so you can contribute to it as well while having fun and learning.");


		break;
	}
}

// Auto-trigger the first page of features
$(function() { nextCard(); });
</script>
