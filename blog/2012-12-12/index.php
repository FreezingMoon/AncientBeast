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

$page_title = "Version 0.1 Released";
require_once("../../header.php");
?>
<div class="div">
<img src="banner.jpg">
<h2 class="center">Version 0.1 was released on 12th December (2012)</h2>

<p><b>Arcade mode.</b> This is a developer preview, allowing to play locally (hotseat) via <b>mouse</b> or <b>touch screen</b> in 1vs1 or 2vs2 modes. There's a pre-match screen that allows for quite a few configurations that will influence the gameplay and possible strategies quite a bit, anyway the default values are very reasonable for a nice match.
<img src="prematch.jpg"></p>

<p><b>Unit cardboards.</b> The units are pretty static for now, lacking any complex animations until we'll get them 3d modeled and animated, which takes a lot of effort, but you can check out this early but awesome <a href="http://AncientBeast.com/viewer" target="_blank"><b>preview</b></a>.<br></p>

<p><b>Basic UI.</b> The current user interface includes an unit queue at the top, showing the active unit in the top-left corner and the units that will follow it based on the initiative stat. Under the current unit avatar there are the passive and active abilities displayed. The right side of the screen displays score along with some common action buttons, such as audio, skip, delay and forfeit, while at the bottom there's a minimized combat log which expands on click, listing everything that's going on in case you missed any details and want to review.</p>
<img src="interface.jpg"></p>

<p><b>Score Screen.</b> At the end of every match you can review the scoreboard along with all the bonuses players got. We'll make sure in a future version to give access to this screen during matches and some useful buttons to it.
<img src="score.jpg"></p>

<p><b>Dark Priest.</b> Each player is represented on the battle field by a summoner. While rather deadly, it's definitely not your best combat unit as it's quite slow and fragile if not for his plasma shield. Anyway, at all costs try to defend this unit by making other units in order to do your fighting, which is a way better use for your plasma.
<img src="summoners.jpg"></p>

<p><b>5 playable units: Snow Bunny, Swine Thug, Magma Spaw, Chimera and Impaler.</b> Every unit in the game is like a tool that you need to put to good use as the match develops and scenarios shape up, it's all up to you!
<img src="units.jpg"></p>

<p><b>3 combat locations: Dark Forest, Frozen Skull and Shadow Cave.</b> Combat locations don't affect gameplay in order to keep things fair so with time you can expect a large variety of them, there's also a nice random option.
<img src="locations.jpg"></p>
</div>

<?php
disqus();
include('../../footer.php'); ?>
