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

<div class="div">
<h2 class="center">Version 0.3 was released on 9th December (2016)</h2>
<p>Hello to all sinners! It's been quite a long time since the last release, but rest assured that we haven't been slacking. Even when I'm not at my machine mashing buttons, I tend to think about the multitude of things that go into this project. Like how to improve things, what works, what doesn't, how to take things to the next level. Personally I dealt with a life changing surgery, a few moves, anxiety, depression, computer related addictions, also ending up being financially broke several times. I'm constantly struggling to get everything in proper place.</p>

<p>This new release codenamed as "Bouncer" definitely deserves it's name and is a big step forward in terms of both gameplay and pipeline. It's still a pre-alpha release, very rough around the edges and not yet meant for the mainstream, but you know the saying, Rome wasn't built in one day. I have been constantly pushing back the release as I'm a perfectionist, always trying to have things more polished and better looking, but I had to draw a line somewhere. Will try aiming for a RERO approach, which stands for "release early, release often" so that the project will hopefully become more active and get in better shape by being more battle tested along the way.</p>
</div>

<div class="div">
<h2 class="center">Game</h2>

<p><b>5 more playable creatures.</b> Unlike chess, this project is very modular and extendable. We're aiming to add a high number of units given enough time and resources, each one being unique and serving certain purposes, like a tool. The more units out there, the more interesting the gameplay becomes, as the posibilities will increase exponentially. Ladies and gents, I introduce you to Nutcase, Nightmare, Headless, Scavenger and Cyber Hound.</p>

<p><b>Added unit ability upgrades.</b> This is an awesome feature that really takes the gameplay to a whole new level, rewarding players that manage to keep a unit alive long enough to unlock its potential. Passive abilities tend to get upgraded after a number of rounds, while active ones after a number of uses, having extra stomping power or functionality that comes in handy. Also, this feature makes things more interesting when you get to see multiple units of the same type as the same time on the combat field, as each might specialize in different attacks or abilities first. While this wasn't a MVP thing (minimum viable product), I thought I would prioritize this as it requires a lot of thinking and balancing to get right. Other gaming companies would had probably added this as a paid expansion way later on, this is how the industry usually works, DLC's on top of even more DLC's.</p>

<p><b>Big revamps for all previous units.</b> When you look at a unit, you should pretty much instantly be able to tell what's it capable overall. I consider this one of the key elements for a good design for such a game. Some unit abilities got revamped even 5 times, until I felt they're intuitive, have good synergy with the other ones and also have strategic value that really enriches the gameplay.</p>

<p><b>In-game music player and tracklist.</b> You can now view the tracks and choose which one you want to play. There are also volume sliders you can play with in order to adjust the in-game music independently from the sound fx.</p>

<p><b>Functional energy and meditations.</b> Each unit replenishes a certain amount of energy each round, provided they're not harmed too much. Energy can be used to perform attacks or activate abilities, so try to use it wisely!</p>

<p><b>Functional endurance and fatigue.</b> Some units replenish more health and energy then others, but some are more consistent in doing so by having a higher endurance, meaning they can take more damage until becoming fatigued, which would cancel their regrowth and meditation for that turn.</p>

<p><b>Unit names shouted when materialized.</b> It's easier to learn how the units are called, by constantly hearing them getting introduced when materialized on the combat field each match you play or watch.</p>

<p><b>Ability tooltips display more info.</b> </p>

<p><b>Item drops from killed units.</b></p>

<p><b>Improved pre-match screen.</b></p>

<p><b>Improved the action log look.</b></p>

<p><b>Improved unit grid behavior.</b></p>

<p><b>Many usability enhancements.</b></p>

<p><b>Lots of bug fixes and balancing.</b></p>

<p><b>Removed the PHP dependency.</b></p>

<p><b>Easier to get into development.</b></p>

<p><b>Updated Phaser game engine.</b> We've updated our game engine, <a href="http://phaser.io" target="_blank">Phaser</a>, one major version, from 1.1.3 all the way to 2.3.0, which packs more features and performs better, as quite a few bugs have been fixed along the way and the rendering engine used, <a href="http://www.pixijs.com" target="_blank">Pixi.js</a> was also updated in the process, which is way faster.</p>
</div>

<div class="div">
<h2 class="center">Website</h2>

<p> <a href="../../units"><b>Expanded the units page.</b></a> Now it includes several <a href="../../units"><u>view modes</u></a>, no longer defaulting to a very heavy asset page.</p>

<p><a href="../../contribute"><b>Created contribution guides.</b></a> Quite a few people asked how they could pitch in and help out the project, so I've finally made a guide to help them get going with that in order to vitalize this project. Go take a peek at the <a href="../../contribute"><u>guide</u></a>.</p>

<p><b>New chatroom using Gitter.</b> Over the last few years I got to the conclusion that the IRC chatroom we used was rather dated and really holding back the project, as people with slow connections constantly disconnected and lost the chat log, also a lot of new visitors weren't sticking out long enough in order to receive a reply from me, as I require 5 hours of quality sleep now and then. This new chatroom fixes that and even integrates nicely with GitHub and Twitter, so even if accounts are now mandatory, it's pretty easy to get into the <a href="../../chat"><u>chatroom</u></a> to say "hi".</p>

<p><b>Subreddit as a forum board.</b> If you're not much for chatrooms but would still be active in the community, then you're in luck, as you can join us in <a href="https://reddit.com/r/AncientBeast" target="_blank"><u>/r/AncientBeast</u></a> subreddit, where you can brainstorm with us project ideas.</p>

<p><b>Semi-useless user accounts.</b> These are a development preview and don't serve much point for now, but there's a lot of stuff planned down the line, like player profiles with statistics, bets, online multiplayer, shop, and so on...</p>

<p><b>Lots of website improvements.</b> I'm a big fan of UX (and <a href="http://littlebigdetails.com" target="_blank"><u>LittleBigDetails</u></a> along with it), so I strongly belive that a great website is very important for most games in order to become popular. I hope you agree with me on this :-)</p>
</div>

<div class="div">
<h2 class="center">Pipeline</h2>

<p><b>Development version of game.</b> There was a huge need for one, as in previous version I constantly worked on the so called "stable" one and broke the working prototype in no time, but that will happen no more, as now we can do more drastic changes without affecting the playerbase, while also testing things properly. We should be able to cherrypick important hot-fixes and push them to the stable version to keep players happy.</p>

<p><b>Added a few automated tasks.</b> We've adopted a modern webdevelopment set-up using Node.js and grunt, so we can do a lot of optimizations easily while patching the game, also, these tasks will open up new posibilities in the future, allowing to further optimize the game, even more for different scenarios.</p>

<p><b>Restructured the game assets.</b> Now it's way easier to find stuff and to do bulk operations. At some point we'll have support for different resolutions of the game and also versions tailored for specific platforms. The website now revolves around the steady version of the game instead of having things simply merged together, order ftw!</p>

<p><b>Moved from Wuala repo to MEGA.</b> The former one sadly doesn't offer a free version anymore. Transitions are always stressful and Wuala even corrupted some important source files of unit 3d models, so I had to put in extra time to review the repository and recover the corrupted assets. MEGA seems pretty cool, but it sure has it's own set of drawbacks; as a regression, now the unit progress widgets point to the repo itself instead of the files related to the viewed unit. I might be looking at OwnCloud in the future, which requires paid hosting usually.</p>

Known Issues
- the buff/debuff in-game UI currently broken
- units card viewer doesn't update abilities
</div>

<div class="div">
<h2 class="center">Support needed</h2>

My old and faithful smartphone broke recently, my Wacom died, my hard drives are dying, I got no steady income (if any at all) and even the chair I'm sitting on is broken, so I'm constantly falling when I'm trying to sit at my desk to get some work done. Also, even if the project is open source, it still requires someone to get paid in order to maintain the codebase and do all the dirty work nobody wants to do. Please consider donating via Paypal or Bitcoin, or getting involved in other ways but only if you're serious about it! It's really awful when people waste my time wanting to contribute and then vanishing or slacking even before properly finishing the first patch or drawing. It's very depressing, time consuming and energy draining. Open source is great when dealing with passionate people that can be self motivated but most people quit when encountering the first road bump.
</div>

<div class="div">
<h2 class="center">Special thanks</h2>
I wanna thank my parents and <a href="https://harumorii.deviantart.com" target="_blank">Haru</a> for all the support they offered me so far, I couldn't have made it without it!
</div>

<?php
disqus();
include('../../footer.php'); ?>
