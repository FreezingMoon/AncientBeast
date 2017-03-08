<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
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

$page_title = "Version 0.3 Released";
require_once("../../header.php");
?>

<link rel="stylesheet" href="<?php echo $site_root; ?>media/fancybox/jquery.fancybox-1.3.4.css" media="screen">
<script src="<?php echo $site_root; ?>jquery.min.js"></script>

<div class="div" id="intro">
<h2 class="indexheader"><a href="#intro">Version 0.3 was released on 8th March (2017)</a></h2>

<p>Hello to all sinners! It's been quite a long time since the last release, but rest assured that we haven't been slacking. Even when I'm not at my machine mashing buttons, I tend to think about the multitude of things that go into this project. Like how to improve things, what works, what doesn't, how to take things to the next level. Personally I dealt with a life changing surgery, a few moves, anxiety, depression, computer related addictions, also ending up being financially broke several times. I'm constantly struggling to get everything in proper place.</p>

<p>This new release codenamed as "Bouncer" definitely deserves it's name and is a big step forward in terms of both gameplay and pipeline. It's still a pre-alpha release, very rough around the edges and not yet meant for the mainstream, but you know the saying, Rome wasn't built in one day. I have been constantly pushing back the release as I'm a perfectionist, always trying to have things more polished and better looking, but I had to draw a line somewhere. Will try aiming for a RERO approach, which stands for "release early, release often" so that the project will hopefully become more active and get in better shape by being more battle tested along the way.</p>
</div>

<div class="div" id="game">
<h2 class="indexheader"><a href="#game">Game changes</a></h2>

<p><b>5 more playable creatures.</b> Unlike chess, this project is very modular and extendable. We're aiming to add a high number of units given enough time and resources, each one being unique and serving certain purposes, like a tool. The more units out there, the more interesting the gameplay becomes, as the posibilities will increase exponentially. Ladies and gents, I introduce you to Nutcase, Nightmare, Headless, Scavenger and Cyber Hound.</p>
<img src="creatures.jpg" alt="creatures" title="New playable creatures">

<p><b>Big revamps for all previous units.</b> When you look at a unit, you should pretty much instantly be able to tell what's it capable overall. I consider this one of the key elements for a good design for such a game. Some unit abilities got revamped even 5 times, until I felt they're intuitive, have good synergy with the other ones and also have strategic value that really enriches the gameplay.</p>
<img src="revamps.jpg" alt="revamps" title="Unit revamps">

<p><b>Added unit ability upgrades.</b> This is an awesome feature that really takes the gameplay to a whole new level, rewarding players that manage to keep a unit alive long enough to unlock its potential. Passive abilities tend to get upgraded after a number of rounds, while active ones after a number of uses, having extra stomping power or functionality that comes in handy. Also, this feature makes things more interesting when you get to see multiple units of the same type as the same time on the combat field, as each might specialize in different attacks or abilities first. While this wasn't a MVP thing (minimum viable product), I thought I would prioritize this as it requires a lot of thinking and balancing to get right. Other gaming companies would had probably added this as a paid expansion way later on, this is how the industry usually works, DLC's on top of even more DLC's.</p>

<a href="<?php echo $site_root; ?>units/?view=viewer#focus" target="_blank"><img src="upgrades.jpg" alt="upgrades" title="All unit abilities can be upgraded now!"></a>

<p><b>In-game music player and tracklist.</b> You can now view the tracks and choose which one you want to play. There are also volume sliders you can play with in order to adjust the in-game music independently from the sound fx.</p>
<a href="<?php echo $site_root; ?>media/?type=music" target="_blank"><img src="<?php echo $site_root; ?>media/band.jpg" alt="music" title="Enjoy the epic tracks!"></a>

<p><b>Functional energy and meditations.</b> Each unit replenishes a certain amount of energy each round, provided they're not harmed too much. Energy can be used to perform attacks or activate abilities, so try to use it wisely!</p>

<p><b>Functional endurance and fatigue.</b> Some units replenish more health and energy then others, but some are more consistent in doing so by having a higher endurance, meaning they can take more damage until becoming fatigued, which would cancel their regrowth and meditation for that turn. This adds a lot more to the strategy.</p>

<p><b>Unit names shouted when materialized.</b> It's easier to learn how the units are called, by constantly hearing them getting introduced when materialized on the combat field each match you play or watch. Know your team!</p>
<img src="waveform.jpg" alt="waveform" title="Gilded Maiden's shout waveform">

<p><b>Item drops from killed units.</b> Pick them up to instantly restore a small amount of health and/or energy. Yummy!</p>
<img src="drops.jpg" alt="drops" title="Pick them up!">

<p><b>Improved pre-match screen.</b> The layout has been improved and a few more game options have been added.</p>
<a rel="pop" href="<?php echo $site_root; ?>media/screenshots/v0.3 Before Match.jpg"><img class="shadow artwork" width=100% src="<?php echo $site_root; ?>media/screenshots/v0.3 Before Match.jpg" title="Pre-match screen" alt="pre-match screen"></a>

<p><b>Improved the action log look.</b> This part of the UI has been refined to have a modern look, pleasant to the eye.</p>

<p><b>Non-obstructive mini-tutorial.</b> Players can optionally check out some very useful tips on how to get started.</p>
<a rel="pop" href="<?php echo $site_root; ?>media/screenshots/v0.3 Frozen Skull.jpg"><img class="shadow artwork" width=100% src="<?php echo $site_root; ?>media/screenshots/v0.3 Frozen Skull.jpg" title="v0.3 Frozen Skull" alt="Frozen Skull"></a>

<p><b>Ability tooltips display more info.</b> Ability upgrade status is included, along with numbers of uses remaining.</p>

<p><b>Improved unit grid behavior.</b> More hexagon types are used in order to differentiate between various states.</p>
<img src="improvements.jpg" alt="improvements" title="Dashed hexagons and cancel cursor">

<p><b>Many usability enhancements.</b> You can switch between usable abilities with the mouse screen wheel or cancel when clicking outside the abilitie's targeting area, which will show a different type of cursor now. The unit queue displays more info under each unit and hovering an avatar will evidentiate that unit, so you can locate it easier. Also, hovering over the round marker will show the coordinates of all the hexagons, helping out strategy talks.</p>
<img src="enhancements.jpg" alt="enhancements" title="Queue info and grid coordinates">

<p><b>Lots of bug fixes and balancing.</b> All the problematic unit abilities have been fixed, no longer freezing the game.</p>

<p><b>Removed the PHP dependency.</b> Setting up a local copy of the game to play offline, test or patch is simpler now.</p>

<p><b>Updated Phaser game engine.</b> We've updated our game engine, <a href="http://phaser.io" target="_blank">Phaser</a>, one major version, from 1.1.3 all the way to 2.3.0, which packs more features and performs better, as quite a few bugs have been fixed along the way and the rendering engine used, <a href="http://www.pixijs.com" target="_blank">Pixi.js</a> was also updated in the process, which is faster, supporting more devices.</p>
<a href="https://phaser.io" target="_blank"><img src="Phaser.jpg" alt="Phaser" title="Phaser game engine"></a>
</div>

<div class="div" id="website">
<h2 class="indexheader"><a href="#website">Website changes</a></h2>

<p> <a href="../../units"><b>Expanded the units page.</b></a> Now it includes several <a href="../../units"><u>view modes</u></a>, no longer defaulting to a very heavy asset page.</p>

<p><a href="../../contribute"><b>Created contribution guides.</b></a> Quite a few people asked how they could pitch in and help out the project, so I've finally made a guide to help them get going with that in order to vitalize this project. Go take a peek at the <a href="../../contribute"><u>guide</u></a>.</p>

<p><b>New chatroom using Gitter.</b> Over the last few years I got to the conclusion that the IRC chatroom we used was rather dated and really holding back the project, as people with slow connections constantly disconnected and lost the chat log, also a lot of new visitors weren't sticking out long enough in order to receive a reply from me, as I require 5 hours of quality sleep now and then. This new chatroom fixes that and even integrates nicely with GitHub and Twitter, so even if accounts are now mandatory, it's pretty easy to get into the <a href="../../chat"><u>chatroom</u></a> to say "hi".</p>

<p><b>Subreddit as a forum board.</b> If you're not much for chatrooms but would still be active in the community, then you're in luck, as you can join us in <a href="https://reddit.com/r/AncientBeast" target="_blank"><u>/r/AncientBeast</u></a> subreddit, where you can brainstorm with us project ideas.</p>

<p><b>Lots of website improvements.</b> I'm a big fan of UX (and <a href="http://littlebigdetails.com" target="_blank" title="I suffer from OCD! D:"><u>LittleBigDetails</u></a> along with it), so I strongly belive that a great website is very important for most games in order to become popular. I hope you agree with me on this :-)</p>

<p><b>Semi-useless user accounts.</b> These are a <a href="<?php echo $site_root; ?>account/register" target="_blank"><b>development</b></a> <a href="<?php echo $site_root; ?>account/login" target="_blank"><b>preview</b></a> and don't serve much point for now, but there is a lot of stuff planned down the line, like player profiles with statistics, bets, online multiplayer, shop and so on.</p>
</div>

<div class="div" id="pipeline">
<h2 class="indexheader"><a href="#pipeline">Pipeline changes</a></h2>

<p><b>Development version of game.</b> There was a huge need for one, as in previous version I constantly worked on the so called "stable" one and broke the working prototype in no time, but that will happen no more, as now we can do more drastic changes without affecting the playerbase, while also testing things properly: quality assurance! We should be able to cherrypick important hot-fixes and push them to the stable version to keep players happy.</p>

<p><b>Added a few automated tasks.</b> We've adopted a modern web development set-up using Node.js and Grunt, so we can do a lot of optimizations easily while patching the game, also, these tasks will open up new posibilities in the future, allowing to further optimize the game, even more for different scenarios, such as various resolutions.</p>

<p><b>Restructured the game assets.</b> Now it's way easier to find stuff and to do bulk operations. At some point we'll have support for different resolutions of the game and also versions tailored for specific platforms. The website now revolves around the steady version of the game instead of having things simply merged together, order ftw!</p>

<p><b>Moved from Wuala repo to MEGA.</b> The former one sadly doesn't offer a free version anymore. Transitions are always stressful and Wuala even corrupted some important source files of unit 3d models, so I had to put in extra time to review the repository and recover the corrupted assets. MEGA seems pretty cool, but it sure has it's own set of drawbacks; as a regression, now the unit progress widgets point to the repo itself instead of the files related to the viewed unit. I might be looking at OwnCloud in the future, which requires paid hosting usually.</p>
</div>

<div class="div" id="issues">
<h2 class="indexheader"><a href="#issues">Known Issues</a></h2>

<p>All the things listed below will hopefully be worked on and fixed asap. Feel free to <a href="https://github.com/FreezingMoon/AncientBeast/issues" target="_blank"><b>report</b></a> if you find some more.</p>

<a href="https://github.com/FreezingMoon/AncientBeast/issues/844" target="_blank"><b>#844</b></a> the buff/debuff in-game UI currently broken<br>
<a href="https://github.com/FreezingMoon/AncientBeast/issues/890" target="_blank"><b>#890</b></a> Units card viewer doesn't update any abilities<br>
<a href="https://github.com/FreezingMoon/AncientBeast/issues/1100" target="_blank"><b>#1100</b></a> Snow Bunny's Freezing Spit upgraded ability used at melee range doesn't freeze the foe</p>
</div>
<div class="div" id="support">
<h2 class="indexheader"><a href="#support">Support needed</a></h2>

<p>My old and faithful smartphone broke recently, my Wacom died, my hard drives are dying, I got no steady income (if any at all) and even the chair I'm sitting on is broken, so I'm constantly falling when I'm trying to sit at my desk to get some work done. Also, even if the project is open source, it still requires someone to get paid in order to maintain the codebase and do all the dirty work nobody wants to do. Please consider donating via <a href="https://www.patreon.com/FreezingMoon" target="_blank"><b>Patreon</b></a>, <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CJF8R55CJE9R4" target="_blank"><b>Paypal</b></a> or <a href="bitcoin:1ALLZzy3AZGvAuNso4Wca8SCx9YGXJdFGb?label=Ancient%20Beast"><b>Bitcoin</b></a>, or getting involved in other ways but only if you're serious about it! It's really awful when people waste my time wanting to contribute and then vanishing or slacking even before properly finishing the first patch or drawing. It's very depressing, time consuming and energy draining. Open source is great when dealing with passionate people that can be self motivated but most people quit after the first road bump.</p>

<a href="<?php echo $site_root;?>contribute" target="_blank"><img src="contribute.jpg" alt="contribute" title="Your support is needed!"></a>

<p><b>Future plans.</b> Will try to release another version in the next few months, fixing quite a few important bugs, revamping some of the current abilities, adding 3 more playable creatures, improving some of the existing artwork, 1-2 more combat locations and sound effects for all the existing abilities and actions in the game.</p>
</div>

<div class="div" id="thanks">
<h2 class="indexheader"><a href="#thanks">Special thanks</a></h2>
<p>I wanna thank my parents and <a href="https://harumorii.deviantart.com" target="_blank">Haru</a> for all the support they offered me so far, I couldn't have made it without it!
Also, big thanks to <a href="https://www.patreon.com/user?u=55200" target="_blank">Rob</a> for breaking the ice with our new and underground <a href="" target="_blank"><b>Patreon page</b></a>, please go check it out!</p>
<a href="https://www.patreon.com/FreezingMoon" target="_blank"><img src="Patreon.jpg" alt="Patreon" title="Support us on Patreon!"></a>
</div>

<?php
disqus();
include('../../footer.php'); ?>

<script type="text/javascript" src="<?php echo $site_root; ?>media/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script defer type="text/javascript" src="<?php echo $site_root; ?>media/fancybox/jquery.easing-1.3.pack.js"></script>

<script type="text/javascript">
// Change URL to viewed image
$(document).ready(function() {
	var basePage = window.location.href.replace(/#.*/, "");
	$("a[rel=pop]").fancybox({
		'overlayColor'  : 'black',
		'transitionIn'	: 'elastic',
		'transitionOut'	: 'elastic',
		'onComplete'	: function(array, index) {
			history.replaceState("", "", basePage + "#id=" + index);
		},
		'onClosed'		: function() {
			history.replaceState("", "", basePage);
		}
	});
	
	if (/[\#&]id=(\d+)/.test(location.hash))
		$("#img" + RegExp.$1).trigger("click");
});
</script>
