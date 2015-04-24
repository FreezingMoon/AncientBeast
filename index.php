<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
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
#screenshot IMG.last-active {z-index: 9; }
';
$stylesheet = 'units/cards.css';

require_once('header.php'); 
?>
<article>
<div class="center">
	<!-- Featured Blog Article -->
	<div style="display: inline-block;" class="lighten">
		<a href="blog/2013-06-15"><img src="blog/2013-06-15/thumb.jpg" class="frame"><br>
		<div class="button" style="background-image: url(images/push_button.png);">See the v0.2 Changelog</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="game"><img src="images/squares/contribute.jpg" class="frame"><br>
		<div class="button" style="background-image: url(images/push_button.png); ;">Play the Game for Free</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="contribute"><img src="images/squares/play.jpg" class="frame"><br>
		<div class="button" style="background-image: url(images/push_button.png);">Learn How to Contribute</div></a>
	</div>
</div>

<div class="div" id="intro">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#intro">Intro</a></h3>
<p>
<b>Ancient Beast</b> is a turn based strategy indie game project, played against other people (or bots) in hotseat or online modes, featuring a wide variety of units to acquire and put to good use in order to defeat all your opponents in battle.<br>This project was carefully designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it as well!
</p><p>
Ancient Beast is <a href="http://www.wuala.com/AncientBeast" target="_blank">free</a> and <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank">open source</a>, being developed by <a href="http://www.FreezingMoon.org" target="_blank" class="FM"><b>Freezing Moon</b></a> and community. It uses web technologies such as HTML, PHP, JavaScript and Node.js, so that it's playable from modern browsers without requiring plugins. Study the <a href="design"><b>Game Design Document</b></a> for more in depth info.</p></div>
<div class="lighten" id="screenshot"><a href="media/?type=screenshots#id=0">
<img src="images/screenie1.png" class="image frame" width=400px height=225px>
<img src="images/screenie2.png" class="image frame" width=400px height=225px>
<img src="images/screenie3.png" class="image frame" width=400px height=225px>
<div class="center" style="padding-top: 235px;"><b>Check out some screenshots!</b></div></a></div>
</div>

<!-- Game Features -->
<?php require_once("images/stats/index.php"); ?>

<script>
$(function(){	
	// Shows description of stats
	$(".stats").mouseenter(function() {
		var card = jQuery(this).parent().siblings().find(".stats_desc");
		jQuery(card).show();
	});
	// Shows description of masteries
	$(".masteries").mouseenter(function() {
		var card = jQuery(this).parent().siblings().find(".masteries_desc");
		jQuery(card).show();
	});
	// Hides the mini-tutorial
	$(".section").mouseleave(function() {
		var card = jQuery(this).parent().siblings().find(".card_info");
		jQuery(card).hide();
	});
nextCard();
});
// Show next info card
var i = 0;
var total = 5;
function nextCard() {
	i = i%total+1;
	$("#position").html(i);
	$("#artwork").css("background","url(images/cards/margin.png),url(images/features/"+i+".jpg)");

	$("#first_icon").css("background","url(images/features/"+i+"-1.svg)");
	$("#second_icon").css("background","url(images/features/"+i+"-2.svg)");
	$("#third_icon").css("background","url(images/features/"+i+"-3.svg)");
	$("#fourth_icon").css("background","url(images/features/"+i+"-4.svg)");
	switch(i) {
		case 1:
			$("#first_title").text("Fun Gameplay").next().html("You can materialise and control a variety of units in order to do your bidding and defeat all your foes.");
			$("#second_title").text("Easy to Learn").next().html("Intimidated at first sight? No worries, everything is being explained during gameplay in a very non intrusive way.");
			$("#third_title").text("Very Replayable").next().html("There are basically an almost infinite combination of units and moves that can be done so no 2 battles are alike.");
			$("#fourth_title").text("Hard to Master").next().html("The game only relies on pure skill and never on dice throws, chances or other luck factors. It's always all up to you!");
		break;
		case 2:
			$("#first_title").text("Browser Based").next().html("You don't have to bother yourself with downloading and installing the game or some problematic browser plug-in.");
			$("#second_title").text("Optional User").next().html("Eager to play? Go right ahead, you can enjoy most of the game without even having to spend any time registering.");
			$("#third_title").text("Open Source").next().html("This project is mostly a community effort, so you can contribute to it as well while having fun and learning.");
			$("#fourth_title").text("Everything Translated - Coming Soon").next().html("We don't like to marginalize anyone, so we're making an effort to have this project translated in many languages.");
		break;
		case 3:
			$("#first_title").text("Free to Play").next().html("We're putting a lot of love and effort into this game project using free tools, we want to give back something nice.");
			$("#second_title").text("Input Methods - Coming Soon").next().html("Given the way it was designed, you have the freedom to play this using most input methods you can think of.");
			$("#third_title").text("Light Weight").next().html("Everything is carefully optimized so that you can enjoy playing on pretty much any device with a web browser.");
			$("#fourth_title").text("Low Latency").next().html("There is very small internet traffic when playing online so that you can enjoy a proper match against anyone you want.");
		break;
		case 4:
			$("#first_title").text("Win Prizes - Coming Soon").next().html("Not only you can play it for free, but there are ways you can actually win stuff, such as achieving high scores.");
			$("#second_title").text("Arcade Mode").next().html("Having a few mates over in your living room? Enjoy playing together on your TV while also having a slice of pizza.");
			$("#third_title").text("Online Multiplayer - Coming Soon").next().html("You can challenge anyone in the world to a battle while you can also team up with your best friend in 2vs2 matches.");
			$("#fourth_title").text("Challenging Bots - Coming Soon").next().html("Want to play a practice match or two to polish up your skills or try out new strategy you thought of? No problem.");
		break;
		case 5:
			$("#first_title").text("Awesome Creatures").next().html("They come in lots of shapes and sizes, serving as the tools to fulfil your will. Each unit comes with unique abilities.");
			$("#second_title").text("Town Building - Coming Soon").next().html("You'll be going through a lot of fuss in order to acquire all those resources so that you can make various structures.");
			$("#third_title").text("Adventure Map - Coming Soon").next().html("Explore mysterious lands and seek out fame and glory while gathering various resources and collecting deadly units.");
			$("#fourth_title").text("Single Player - Coming Soon").next().html("Multiple campaigns that will keep you on your toes, testing out your various skillsets to the fullest and even beyond.");
		break;
	}
}

</script>

<div class="div center" id="features">
	<div class="center" style="display:inline-block; vertical-align: top;">
		<div id="artwork" class="card sideA" style="background-image: url('<?php echo $site_url; ?>images/cards/margin.png'), url('<?php echo $site_url; ?>images/features/1.jpg');">

			<!-- On hover mini tutorial -->
			<div class="card_info stats_desc"><br>
				<div><span class="icon health"></span> Health: The raw amount of damage points a creature can take before it dies.</div>
				<div><span class="icon regrowth"></span> Regrowth: Amount of health that gets restored at the beginning of every turn.</div>
				<div><span class="icon endurance"></span> Endurance :  Protects unit from fatigue, which disables regrowth and meditation.</div><br>
				<div><span class="icon energy"></span> Energy : Each unit ability requires a certain amount of energy to be used.</div>
				<div><span class="icon meditation"></span> Meditation : Energy restored each turn.</div>
				<div><span class="icon initiative"></span> Initiative : Units with higher amount of initiative points get to act their turn faster.</div><br>
				<div><span class="icon offense"></span> Offense : Influences the damage output done by all the creature's attack abilities.</div>
				<div><span class="icon defense"></span> Defense : Protects the creature by reducing some of the incoming damage.</div>
				<div><span class="icon movement"></span> Movement : Any creature can move a certain number of hexagons every turn.</div>
			</div>
			<div class="card_info masteries_desc">
				<span>There are 9 common types of damage and a rare one called Pure damage that bypasses the formula bellow, doing a fixed non-variable amount of harm no matter what.</span><br><br>
				<span><u>Damage Formula</u><br>attack damage +<br>attack damage / 100 *<br>(offense of attacking unit -<br>defense of unit attacked /<br>number of hexagons hit +<br>source stat of attacker -<br>source stat of defender)</span><br><br>
				<span>Minimum damage is usually 1<br>unless the hit is being avoided.</span>
			</div>

			<!-- Card Anchor -->
			<a href="#" title="Go to the next card" onClick="nextCard();return false;"><div style="height:100%;"></div></a>
<?php		
			// Display unit info
			echo '<a href="#" class="name" style="color: white;" onClick="nextCard();return false;"><div class="section info sinG">
					Check out the game features <span id="position">1</span>/5
			</div></a>
		</div></div>';

		// Side B
		echo '
		<div class="card sideB" style="background-image: url(' . $site_url . 'images/cards/margin.png), url(' . $site_url . 'images/cards/G.jpg);">
				<div class="section numbers stats">';
					// Display Stats
					$r["stats"] = [
									"health"=>190,
									"regrowth"=>2,
									"endurance"=>33,
									"energy"=>80,
									"meditation"=>3,
									"initiative"=>80,
									"offense"=>30,
									"defense"=> 5,
									"movement"=> 4,
									"pierce"=> 6,
									"slash"=> 6,
									"crush"=> 6,
									"shock"=> 1,
									"burn"=> 1,
									"frost"=> 1,
									"poison"=> 5,
									"sonic"=> 6,
									"mental"=> 7];
					$i=1;
					foreach ($r["stats"] as $key => $value) {
					 	if( $i > 0 && $i < 10) {
				 			displayStat($key,$value);
				 		}
						$i++;
					}
					echo '
				</div>
				<div class="section abilities" onClick="nextCard();" style="cursor: pointer;">';
			  		// Display Abilities
					echo '
					<div class="ability">
						<div id="first_icon" class="icon">
							<div class="contour"></div>
						</div>
						<div class="wrapper">
							<div class="info">
								<h3 id="first_title"></h3>
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
					';

				echo '
				</div>
				<div class="section numbers masteries">';
					// Display Masteries
					$i=1;
					foreach ($r["stats"] as $key => $value) {
					 	if( $i > 9 &&  $i < 19) { 
					 		displayStat($key,$value,""); 
				 		}
				 		$i++;
					}
					echo '
				</div>
			</div>';
?>
</div>

<div class="div" id="plot">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#plot">Plot</a></h3>
<p>
It's the year 2653. In the last few centuries, technology advanced exponentially and everyone had a fair chance of playing God. With help from the <a href="http://reprap.org" target="_blank"><b>RepRap</b></a> project, a free desktop 3d printer, which gave anyone power to build their own weapon factory or genetic laboratory on their own property. Mechanic parts or genetic modifications turned from a fashion option into a requirement for daily survival.
</p><p>
Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield, split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here and only the strong ones will surpass it.
</p>
<div class="center"><audio id="narration" controls src="plot.ogg" style="width:475px;"></audio></div>
<br>
</div>

<img src="images/hand.png" class="image lighten" width=400px height=387px onclick="toggleSound();" style="cursor: pointer;" title="Click to play narrative">
<audio id="narration" src="plot.ogg"></audio>
</div>

</article>
<?php include('footer.php'); ?>

<!-- Change Feature Slides -->
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
    next.css({opacity: 0.0})
      .addClass('active')
      .animate({opacity: 1.0}, 1000, function() {
          active.removeClass('active last-active');
    });
  }
  $(function() { setInterval("slideSwitch()", 4000); });
</script>

<!-- Toggle Plot Narration -->
<script>
function toggleSound() {
	var audioElem = document.getElementById('narration');
	if (audioElem.paused) audioElem.play();
	else audioElem.pause();
}
</script>
