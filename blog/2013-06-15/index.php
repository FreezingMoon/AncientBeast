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

$page_title = "Version 0.2 Released";
require_once("../../header.php");
?>
<div class="div">
<img src="banner.jpg">
<h2 class="center">Version 0.2 was released on 15th June (2013)</h2>

<p><b>Perspective grid has been dropped.</b> It was working horrible in Firefox, sigh. Now the game feels less 3d-ish, but on the good side, the hexagons maintain their size so they're easier to target on touch devices and there's also less code to maintain. We might introduce this as an option later on though for those who prefer it more.</p>

<p><b>3 new playable units: Gumble, Uncle Fungus and Abolished.</b> Let us know which ones are your favorite :-)<br>
<img src="units.jpg"></p>

<p><b>Unit balancing.</b> We're constantly play testing the game in order to figure out what units are over powered and which ones don't bring enough to the table, so we're revamping out abilities even multiple times in order to enhance and balance the gameplay, also stats get constantly tweaked to make things interesting. We'll make a habit of documenting these changes better with time as the game gets more stable and has more updates.</p>

<p><b>Hotkey support.</b> Even though the game UI's designed for touch devices, it's meant to be playable with pretty much any input device possible, so we're working on implementing them one by one. Current hotkeys are <b>Tab</b> (unit dash), <b>WER</b> (left side icons: active abilities), <b>ASDF</b> (right side icons: audio, skip, delay, forfeit), the <b>arrow keys</b> can select a target hexagon in the combat view and toggle between units in the dash, <b>Spacebar</b> confirms selected hexagon and the <b>Return</b> key selects the unit from dash in order for the Dark Priest to materialize it.
<img src="hotkeys.jpg"></p>

<p><b>Improved UI behaviour.</b> We're constantly tweaking the UI to look and behave better, which means nicer looking elements, displayed tooltip information and various animations so it shouldn't slow the gameplay.</p>

<p><b>Less MySQL usage.</b> We've ported all the unit data from MySQL into JSON format, making it easier to tweak things like stats and other unit information, while at the same time making it easier for developers to dig in!</p>

<p><b>A lot of bug fixes.</b> Everytime something is added or removed in a complex project, chances are that something else will start squeaking or even break, even if it might seem non-related, so at times new issues might be introduced, though you can help out by testing and reporting issues, anyway, this is a collaborative project and there's always something to work on, so if you can patch, feel free! Check out the full change log on <a href="https://github.com/FreezingMoon/AncientBeast/issues?q=milestone%3A%220.2+-+Adaptation%22" target="_blank"><b>Github</b></a>.</p>

</div>

<?php
disqus();
include('../../footer.php'); ?>
