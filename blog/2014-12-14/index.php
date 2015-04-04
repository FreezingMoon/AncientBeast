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

$page_title = "Duel";
require_once("../header.php");
?>

<!-- TODO: game box + buy  button (discounted) or just take a cut -->
<!-- TODO: display icons of the 4 referenced games -->
<!-- TODO: explain how the duel / bet system works -->
<!-- TODO: show previous matches and results / champions -->
<!-- TODO: show scheduled matches that you can bet on and watch -->

<div class="div" style="text-align: justify;">
Ancient Beast is the product of almost a decade of gaming experience, game design study, research and trial. I've listed below a few popular games that served as inspiration or have some big similarities with this project, while I noted some aspects I fully embraced and some things I didn't approved and how I managed to fix them.<br><br>
<div style="display: block; vertical-align: top;"><a href="http://chess.com" target="_blank"><img src="chess.png" style="float: left;" class="lighten"></a>
<h3>The Ancient Game of Chess</h3>
The game of Chess has been around since ancient times slightly changing over the years. Given the current technological expansion and trends, it needs to evolve again. Overall it's considered a bit racist since the whole white vs black conflict and it's considered that the first player has a major advantage, which makes the game rather flawed. Also, it's pretty static and not very appealing to most kids these days. A bit of a waste to use all that processing power for something like that and only old people tend to have real chess pieces while playing in parks with each others.
</div>

<div style="display: block; height: 222px;"><a href="http://heroesofmightandmagic.com/heroes3" target="_blank"><img src="homm3.png" style="float: left;" class="lighten"></a>
<h3>Heroes of Might and Magic 3</h3>
This is one of the games I've fell in love with at first sight and definitely a great source of inspiration when it comes to Ancient Beast's focus on combat, since I consider the adventure mode to be too painfully slow when playing in multiplayer. Some notable changes are that in Ancient Beast you only start with your hero, which is now a playable unit and you summon your choice of units as you see fit. Also, there's no longer a spell book, instead each unit you make has a couple of abilities in order to keep things more versatile and balanced since magic was superior to might. There are no more unit stacks so now all estimations are easier.
</div>

<div style="display: block; height: 222px;"><a href="http://dota2.com" target="_blank"><img src="dota.png" style="float: left;" class="lighten"></a>
<h3>Defense of the Ancients</h3>
I've been a Dota player since about the beginning and I've playing it obsesivelly over the years, along with other similar games. It's a nice game but team work is definitely not for everyone and it's a harder job and less artistic and profitable than having a band for example, while 1vs1 matches don't really make much sense. I strongly belive a lot of people will come to the same conclusion and prefer a proper game designed for 1vs1 and 2vs2 battles, in case you want to tag alogn with your best friend / soul mate, o simply play in pairs when having a party.
</div>

<div style="display: block; height: 222px;"><img src="mtg.png" style="float: left;">
<h3>Magic: The Gathering</h3>
This game sure has a lot of fans. For me the amazing thing about MTG was the versatility of cards and spells you could encounter in every game by using different decks and by playing versus different players. One of the things I dislike about this game is the amount of randomness it has, it kinda makes you feel like having your hands tied to your back at times, also your card deck can be completely useless in certain situations. My vision for Ancient Beast is to have a large and versatile pool of unique units but only allow you to choose a limited combination every battle, so it's your decision if and when you want to pull a rabbit or something out of the hat.
</div>

<div style="display: block; height: 222px;"><img src="mk.png" style="float: left;">
<h3>Mortal Kombat</h3>
I like beat'em'up games, but the problem with most of them is that they're rather hard to master and most newbies have the tendency to button-smash all the time which replaces skills with random events or luck basically. They're also kinda dependant on game pads, so they're less fun on PC's not equiped with some. Ancient Beast is designed to be playable with a high range of input devices while retaining this high level of competitiveness meant for pro players and creates panic moments as well especially when the player turns are limited in duration. Soon there will be some Fatalities & Bestialities implemented as finishing moves.
</div>

<div style="display: block; height: 222px;"><img src="ssbb.png" style="float: left;">
<h3>Super Smash Bros Brawl</h3>
I'm really fond of games that are easy to get into and can be played with friends while throwing a party, there aren't too many games that can be played by 4 players (or more) at the same time and I really love the character versatility that it offers. Ancient Beast is rather similar, but instead of having a mash up of characters from various games, it starts the other way around: it has a wide range of original characters that are constantly making their way into a lot of other games, especially indie / open source titles hence the creative commons licensing.
</div>

The game is completely playable for free upfront and players always have the option go pro and battle others for bitcoins for a small symbolic fee to show devotement, while others can simply bet on upcoming matches.<br><br>
In order to finance the project, we are pre-selling access to the duel feature at a discount, along with making all units available in the ladder mode and also a hour of training with the project's founder (limited time offer).
</div>

<?php
disqus();
include('../footer.php'); ?>
