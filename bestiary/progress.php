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

function progress($id, $ab_name) {
	$ab_id = mysql_real_escape_string($id);
	$ab_progress = "SELECT * FROM ab_progress WHERE id = '$ab_id'";
	$rows = db_query($ab_progress);
	foreach ($rows as $r) {
		$sum = array_sum($r);
		$total = ($sum - $r['id']) / 10;
		$rounded_total = 10 * round ($total/10) ;
		echo "<center><div style='width:825px; background-image:url(../images/progress/widget.png);'><a href='http://www.wuala.com/AncientBeast/bestiary/$ab_name' target='_blank'>";
		foreach($r as $key => $value) {
			if($key == 'id') continue;
			$title = ucfirst($key) . ": $value% complete";
			echo "<img src='../images/progress/$value.png' title='$title'>";
		} echo "<img src='../images/progress/$rounded_total.png' title='Total: $total% completed'></a></div></center>";
	}
} ?>
