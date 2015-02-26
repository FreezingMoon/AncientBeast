<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2014 Valentin Anastase (a.k.a. Dread Knight)
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * https://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

$page_title = 'Contribute';
$style = '
.donate { color: #FFE873 !important; }
.artwork { color: #FC8585 !important; }
.coding { color: #6EDD64 !important; }
.audio { color: #AFC8FF !important; }
.image { margin-left: 10px; width: 400px; height: 250px; }
';
require_once('../header.php'); 
?>

<div class="center" id="social" style="margin-bottom: 5px;">
	<div style="display: inline-block; cursor: pointer;" class="lighten">
		<a href="http://reddit.com/r/AncientBeast" target="_blank"><img src="../images/squares/reddit.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Join the Community on Reddit</div></a>
	</div>
	<div style="display: inline-block; cursor: pointer;" class="lighten">
		<a href="https://github.com/FreezingMoon/AncientBeast" target="_blank"><img src="../images/squares/github.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">Fork the Project on Github</div></a>
	</div>
	<div style="display: inline-block; cursor: pointer;" class="lighten">
		<a href="http://ancient-beast.deviantart.com" target="_blank"><img src="../images/squares/deviantart.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Submit Fanart on deviantArt</div></a>
	</div>
</div>

<div class="div" id="donate">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#donate">Donate</a></h3>
<p>
We strongly believe in open source software development, but to run a successful project, you still require quite a bit of money in order to have at least few people work part-time on the project and deal with the stuff nobody else wants to ever actually do and there are also services and hardware requirements that must be met which tend to add up quite a bit. Please consider donating via <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CJF8R55CJE9R4" target="_blank"><b>Paypal</b></a> or <a href="bitcoin:1ALLZzy3AZGvAuNso4Wca8SCx9YGXJdFGb?label=Ancient%20Beast"><b>Bitcoin</b></a>, even if you're not into turn based strategy games you must see the bigger picture: we're setting an example in the industry and also creating a huge high quality art repository that you and others can use for commercial work and possibly even make other neat games, comics or maybe even animations. Feel free to become our <a href="http://patreon.com/AncientBeast" target="_blank"><b>Patreon</b></a> and receive cool rewards.<br>
You can address individual issues by using <a href="https://bountysource.com/teams/freezingmoon/issues?tracker_ids=260151" target="_blank"><b>Bounty Source</b></a>.<br>
If you wish to become a sponsor, get in touch via an <a href="mailto:DreadKnight@FreezingMoon.org?Subject=I want to Sponsor the Project" target="_blank"><b>email</b></a>.<br>
Any amount you can donate is very appreciated, thank you!<br>
<!--Don't forget you can always spend some in our online <a href="https://AncientBeast.com/shop"><b>shop</b></a>.-->
</p>
<p><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CJF8R55CJE9R4" target="_blank"><img src="paypal.png" class="lighten" width=68px height=20px></a>
<a href="bitcoin:1ALLZzy3AZGvAuNso4Wca8SCx9YGXJdFGb?label=Ancient%20Beast" target="_blank"><img src="bitcoin.png" class="lighten" width=85px height=20px></a>
<a href="https://flattr.com/thing/126547/Ancient-Beast" target="_blank"><img src="flattr.png" width=90px class="lighten" height=20px></a>
<a href="https://gratipay.com/AncientBeast" target="_blank"><img src="gratipay.png" class="lighten" width=77px height=20px></a>
<a href="https://bountysource.com/teams/freezingmoon/issues?tracker_ids=260151" target="_blank"><img src="bountysource.png" class="lighten" width=64px height=20px></a>
<a href="https://centup.org/publisher/ancient-beast" target="_blank"><img src="centup.png" class="lighten" width=64px height=20px></a></p>
</div>

<div style="display: inline-block; vertical-align: top;" class="center">
<table style="width:400px;"><tr><td><b>Top Donors via PayPal</b></td><td><b>$</b></td></tr>
<tr><td><a href="https://harumorii.deviantart.com" target="_blank" class="lighten donate"><img src="bly.png"> Haru <img src="bry.png"></a></td><td>2500</td></tr>
<tr><td><a href="https://fiverr.com/dreadknight" target="_blank" class="lighten donate"><img src="bly.png"> Dread Knight <img src="bry.png"></a></td><td>1250</td></tr>
<tr><td><a href="https://github.com/unhammer" target="_blank" class="lighten donate"><img src="bly.png"> Kevin Brubeck Unhammer <img src="bry.png"></a></td><td>50</td></tr>
<tr><td><a href="https://teogreengage.blogspot.com" target="_blank" class="lighten donate"><img src="bly.png"> Teo Cazghir <img src="bry.png"></td><td>50</td></tr>
<tr><td><a href="https://bountysource.com" target="_blank" class="lighten donate"><img src="bly.png"> David Rappo <img src="bry.png"></a></td><td>50</td></tr>
<tr><td><a href="https://facebook.com/silvernessa" target="_blank" class="lighten donate"><img src="bly.png"> Vanessa Young <img src="bry.png"></a></td><td>46</td></tr>
<tr><td><a href="https://github.com/hpvb" target="_blank" class="lighten donate"><img src="bly.png"> Hein-Pieter van Braam <img src="bry.png"></a></td><td>40</td></tr>
<tr><td><a href="http://qubodup.net" target="_blank" class="lighten donate"><img src="bly.png"> Iwan Gabovitch <img src="bry.png"></a></td><td>25</td></tr>
<tr><td><a href="https://facebook.com/akumdara" target="_blank" class="lighten donate"><img src="bly.png"> Adam Dalton <img src="bry.png"></a></td><td>20</td></tr>
<tr><td><a href="https://twitter.com/alexandredes" target="_blank" class="lighten donate"><img src="bly.png"> Alexandre Deschamps <img src="bry.png"></a></td><td>20</td></tr>
<tr><td><a href="" target="_blank" class="lighten donate"><img src="bly.png"> Leif Larsen <img src="bry.png"></td><td>10</td></tr>
<tr><td><a href="http://mrfaemir.deviantart.com" target="_blank" class="lighten donate"><img src="bly.png"> Daniel Cohen <img src="bry.png"></a></td><td>5</td></tr>
<tr><td><a href="" target="_blank" class="lighten donate"><img src="bly.png"> gamesandspace <img src="bry.png"></a></td><td>3</td></tr>
<tr><td><a href="" target="_blank" class="lighten donate"><img src="bly.png"> Markus Eliassen <img src="bry.png"></a></td><td>3</td></tr>
<tr><td><a href="" target="_blank" class="lighten donate"><img src="bly.png"> Pandu Aji Wirawan <img src="bry.png"></a></td><td>2</td></tr>
<tr><td><a href="" target="_blank" class="lighten donate"><img src="bly.png"> Max Mazon <img src="bry.png"></a></td><td>1</td></tr>
<tr><td>Your Name</td><td>?</td></tr>
</table></div>
</div>

<div class="div" id="artwork">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#artwork">Artwork</a></h3>
<p>
Perhaps it's not money you want to contribute, but rather spend some time and energy while putting your pen and brush to some good use in order to create more visual content for the project or simply having fun drawing fan art of already existing creatures? If you have something lying around and you think it could nicely fit the game while under the same <a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><b>CC-BY-SA 3.0</b></a> license, feel free to send it our way!<br>
If you want a task assigned, simply drop by our <a href="../chat"><b>chat</b></a> room and poke DreadKnight, the project's founder, he'll brief you.
</p><p>
Several ways you can help out using with your artistic skills:<br>
<p><b>Draw playable creatures or characters</b><br>
All new units should be rather original, so no typically known fantasy monsters, also their negative shape should stand out when next to the ones of the other ingame <a href="../units"><b>characters</b></a>.</p>

<p><b>Make fanart of existing creatures</b><br>
We always love seeing the current game <a href="../units"><b>characters</b></a> in new poses and doing new things or interacting with each other. If you can come up with a small comic strip, then awesome!</p>

<p><b>3d model or animate creatures</b><br>
All the in-game units are being made into 3d and animated using <a href="http://blender.org" target="_blank"><b>Blender</b></a> package, then rendered as <a href="../viewer"><b>sprite sheets</b></a> using our <a href="https://github.com/Fweeb/blender_spritify" target="_blank"><b>Spritify</b></a> add-on (requires <a href="http://ImageMagick.org" target="_blank"><b>ImageMagick</b></a> installed).
</p>

<p><b>Create more combat locations</b><br>
Each location can be themed to fit any of the game <a href="../media/?type=realms"><b>realms</b></a>. Only the two lower thirds of the height are for unit walking. The background has to be 1920 by 1080 pixels, png format.
</p>

<p><b>Prototype better ability icons</b><br>
White icon over black background, svg format, 512 by 512 pixels, similar style to the ones from <a href="http://game-icons.net" target="_blank"><b>www.game-icons.net</b></a><br>
The <a href="https://inkscape.org" target="_blank"><b>Inkscape</b></a> vector graphics editor is the right tool for this.</p>

<p><b>Design various promotional items</b><br>
We can always use some more desktop <a href="../media/?type=wallpapers"><b>wallpapers</b></a>, 1920 by 1080 pixels and more merchandise for our online <a href="../shop"><b>shop</b></a>, such as <b>miniatures</b>, <b>plushies</b>, <b>T-shirts</b>, <b>posters</b> & <b>stickers</b>.
</p>
<a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><img src="http://img.shields.io/badge/license-CC--BY--SA%203.0-green.svg" class="lighten"></a><a href="https://mega.co.nz/#F!GAJAjAzL!AhBUayQndZbH_j2IL2B-nA" target="_blank"><img src="http://img.shields.io/badge/repository-MEGA-red.svg" class="lighten"></a><a href="https://ancient-beast.deviantart.com" target="_blank"><img src="deviantart.png" class="lighten" width=124px height=18px></a>
</div>

<?php $i = 0; ?>
<div style="display: inline-block; vertical-align: top;" class="center">
<table style="width:400px;"><tr><td><b>Top Art Contributors</b></td><td><b>#</b></td></tr>
<tr><td><a href="http://sythgara.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Katarzyna Zalecka <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://velvetcat.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Indre Lelertaviciute <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://ashirox.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Ashirox <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://turjuque.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Clement Foucault <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://n-pigeon.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> n-pigeon <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://gabriel-verdon.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Gabriel Verdon <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://youtube.com/user/Jeepster3D" target="_blank" class="lighten artwork"><img src="blr.png"> Jeepster3D <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://seekerofawe.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Mihai Walther <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://dreadknight666.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Dread Knight <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://opengameart.org/users/piacenti" target="_blank" class="lighten artwork"><img src="blr.png"> piacenti <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://youtube.com/user/thisroomthatIkeep" target="_blank" class="lighten artwork"><img src="blr.png"> Roberto Roch <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://opengameart.org/users/5hiroi" target="_blank" class="lighten artwork"><img src="blr.png"> shiroikuro <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://undeadkitty13.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> UndeadKitty13 <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://theshock.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Ramon Miranda <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://deevad.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> David Revoy <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="" target="_blank" class="lighten artwork"><img src="blr.png"> GetBacon <img src="brr.png"></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://slyth3rin.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Bri Arwiie <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://rougespark.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Rogue Spark <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://monsterjavaguns.com" target="_blank"  class="lighten artwork"><img src="blr.png"> Fweeb <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://betasector.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> BetaSector <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://nynn.contact.free.fr" target="_blank" class="lighten artwork"><img src="blr.png"> Nynn <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="" target="_blank"  class="lighten artwork"><img src="blr.png"> Maggot Master <img src="brr.png"></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://random223.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> random223 <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://onirke.deviantart.com" target="_blank" class="lighten artwork"><img src="blr.png"> Oliwia Grambo <img src="brr.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td>Your Name</td><td>?</td></tr>
</table><br>
<div style="display: inline-block;" class="center"><img src="gumble.png" class="image"></div>
</div>
</div>

<div class="div" id="coding">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#coding">Coding</a></h3>
<p>
We can always use an extra hand or two when it comes to polishing and adding new functionality to the website and to the game itself of course. All the coding languages used are web based, such as HTML, CSS, PHP, Javascript and Node.js. The project uses the great <a href="www.phaser.io" target="_blank"><b>Phaser</b></a> game engine, having a neat <a href="http://html5gamedevs.com/forum/14-phaser/" target="_blank"><b>community</b></a>, <a href="http://docs.phaser.io" target="_blank"><b>documentation</b></a> and <a href="http://examples.phaser.io/" target="_blank"><b>examples</b></a>. It's also open source, you can find it's repository on <a href="https://github.com/photonstorm/phaser" target="_blank"><b>Github</b></a>.<br>
If you want a task assigned, simply drop by our <a href="http://AncientBeast.com/chat"><b>chat</b></a> room and poke DreadKnight, the project's founder, he'll brief you.<br>
Sometimes even reviewing or talking code can greatly help.
</p>
<a href="http://www.gnu.org/licenses/agpl-3.0.html" target="_blank"><img src="http://img.shields.io/badge/license-AGPL3.0-green.svg" class="lighten"></a><a href="https://github.com/FreezingMoon/AncientBeast/issues" target="_blank"><img src="http://img.shields.io/github/issues/FreezingMoon/AncientBeast.svg" class="lighten"></a><a href="https://bountysource.com/teams/ancientbeast" target="_blank"><a href="https://www.bountysource.com/teams/ancientbeast/issues?utm_source=Ancient%20Beast&utm_medium=shield&utm_campaign=bounties_received" target="_blank"><img src="https://bountysource.com/badge/team?team_id=44509&style=bounties_received" class="lighten"></a>
</div>

<?php $i = 0; ?>
<div style="display: inline-block; vertical-align: top;" class="center">
<table style="width:400px;"><tr><td><b>Top Code Contributors</b></td><td><b>#</b></td></tr>
<tr><td><a href="https://github.com/Hypersomniac" target="_blank" class="lighten coding"><img src="blg.png"> Clement Turjuque <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://fiverr.com/dreadknight" target="_blank" class="lighten coding"><img src="blg.png"> Dread Knight <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/Dobz" target="_blank" class="lighten coding"><img src="blg.png"> Dobz <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/Archiboldian" target="_blank" class="lighten coding"><img src="blg.png"> Archiboldian <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/Fweeb" target="_blank" class="lighten coding"><img src="blg.png"> Fweeb <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/Nehmulos" target="_blank" class="lighten coding"><img src="blg.png"> Nehmulos <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/SlimeTP" target="_blank" class="lighten coding"><img src="blg.png"> SlimeTP <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/hjaarnio" target="_blank" class="lighten coding"><img src="blg.png"> hjaarnio <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/Uhkis" target="_blank" class="lighten coding"><img src="blg.png"> Uhkis <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://github.com/randompast" target="_blank" class="lighten coding"><img src="blg.png"> randompast <img src="brg.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td>Your Name</td><td>?</td></tr>
</table></div>
</div>

<div class="div" id="audio">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#audio">Audio</a></h3>
<p>
If composing is more of your expertise, we can always use more tracks of epic genre, as example you can check out the existing tracks and also some from related games, such as the Heroes of Might and Magic 3's combat tracks and the OST from the King's Bounty games. I also consider sound fx is another important area that can make or break gameplay, it should not be annoying and repetitive while nicely complementing and reinforcing the ongoing actions.
</p><p>
Check out these tracks as reference, but always be original:<br>
<a href="http://AncientBeast.com/media?type=music" target="_blank"><b>Ancient Beast Official Soundtrack</b></a><br>
<a href="https://www.youtube.com/watch?v=7hbaNfHToT8" target="_blank"><b>Heroes of Might and Magic 3: Combat 1</b></a><br>
<a href="https://www.youtube.com/watch?v=GSwATqPUsv0" target="_blank"><b>Heroes of Might and Magic 3: Combat 2</b></a><br>
<a href="https://www.youtube.com/watch?v=ea5RiOfcF6k" target="_blank"><b>Heroes of Might and Magic 3: Combat 3</b></a><br>
<a href="https://www.youtube.com/watch?v=M0ObS62Js-4" target="_blank"><b>Heroes of Might and Magic 3: Combat 4</b></a><br>
<a href="https://www.youtube.com/watch?v=iKGrzdwyW-M&list=PL570FD020D275457E" target="_blank"><b>King's Bounty: The Legend (playlist)</b></a><br>
<a href="https://www.youtube.com/watch?v=tnNowmSdP1c&list=PL5052849DDF6C95A6" target="_blank"><b>King's Bounty: Armored Princess (playlist)</b></a><br>
</p>
All tracks and sfx need to be under <a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><b>CC-BY-SA 3.0</b></a> license.
</div>

<?php $i = 0; ?>
<div style="display: inline-block; vertical-align: top;" class="center">
<table style="width:400px;"><tr><td><b>Top Audio Contributors</b></td><td><b>#</b></td></tr>
<tr><td><a href="http://youtube.com/user/moonthiefro" target="_blank" class="lighten audio"><img src="blb.png"> Moonthief <img src="brb.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="https://twitter.com/Jenskiilstofte" target="_blank" class="lighten audio"><img src="blb.png"> Jens Kiilstofte <img src="brb.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://youtube.com/user/DruoxTheShredder" target="_blank" class="lighten audio"><img src="blb.png"> Dreux Ferrano <img src="brb.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td><a href="http://opengameart.org/users/haeldb" target="_blank" class="lighten audio"><img src="blb.png"> Brandon756 <img src="brb.png"></a></td><td><?php echo ++$i; ?></td></tr>
<tr><td>Your Name</td><td>?</td></tr>
</table><br><br>
<div style="display: inline-block;" class="center"><img src="band.jpg" class="image"></div>
</div>
</div>

<div class="div" id="supporter">
<div style="width: 475px; text-align: justify; display:inline-block;">
<h3 class="indexheader"><a href="#supporter">Supporter</a></h3>
<p>
No moneys and no coding or artistic skills? No worries, you can still help out by being part of the community, testing out the game and reporting issues, brainstorming and spreading out the word as our marketing budget is pretty much non-existend, so we rely on you for that! Feedback and boosting the numbers are always nice, as they can also boost up morale and reassure us we're on the proper path.
Click on the icons below and join our various project groups. You can also hang out with us in our own project <a href="http://AncientBeast.com/chat"><b>chat</b></a> room.
</p>
</div>
<div style="display: inline-block;" class="center"><img src="together.jpg" class="image"></div>
</div>

<?php include('../footer.php'); ?>
<script>
function toggleSound() {
	var audioElem = document.getElementById('narration');
	if (audioElem.paused) audioElem.play();
	else audioElem.pause();
}
</script>
