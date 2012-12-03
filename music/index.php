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

$page_title = "Ancient Beast - Music";
require_once("../header.php");
start_segment();
//include
echo "<center>";
$tracks = scandir("/tracks");
natsort($tracks);
$i = 0;
echo "<ul id='playlist'>";
foreach($tracks as $track) {
	if($track == "." || $track == "..") continue;
	$title = substr($track, 0, -4); 
	echo "<li><a id='track{$i}' href='{$site_root}music/tracks/$track' title='$title'></a></li>";
	$i++;
}
echo "</ul>";
echo "</center>";
separate_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>
