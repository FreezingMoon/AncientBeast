<!--
 * Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
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
-->

<?php $page_title = "Page Not Found";
require_once("../header.php");
start_segment();
echo "<center>"; 
include("top_ad.php");
echo "<br><br><table style='width: 100%;'><tr><td>";
include("side_ad.php");
echo "</td><td><center><a href=\"$site_root\" title=\"Go to homepage\"><img src=\"404.gif\"></a></center></td><td>";
include("side_ad.php");
echo "</td></tr></table></center>";
end_segment();
end_page();
?>
