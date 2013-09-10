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

$page_title = 'Ancient Beast - Bestiary';
require_once('../header.php');?>
<script>$("body").attr("id","units");</script><?php
require_once('../global.php');
require_once('../images/stats/index.php');
require_once('functions.php');
require_once('cards.php');
require_once('grid.php');

$creature_results = get_creatures();
//TODO: reuse code with the game

//grid view
echo '<style type="text/css">
		#creaturegrid .vignette,
		.vignette div.border,
		.vignette div.overlay{
			height: 128px;
			width: 128px;
		}
		#creaturegrid{
			width: 896px;
			height: 896px;
		}
	</style>';
creatureGrid($creature_results);
echo "<br>";

//detailed view
$i = 0;
foreach ($creature_results as $r) {
	$underscore = str_replace(' ', '_', $r['name']);
	cards($r);
	echo '<br>';
	//progress should only be shown in units page at most
	progress($r["progress"],$r);
	$i++;
}?>
</body></html>
