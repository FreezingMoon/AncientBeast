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

$page_title = "Blog";
require_once("../header.php");
require_once("../global.php");
?>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<!-- TODO: php should check for link variable, if there's none, then scan for folders and gather data, make an array of items, get some variables to generate the thumbnails/info;
if there's a GET link variable, it should gather that and display that article only; this whole thing is to automise the blog and remove manual work and template redundancy -->
<div class="center">
	<div style="display: inline-block;" class="lighten">
		<a href="2017-03-8"><img src="2017-03-8/thumb.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">Version 0.3 Released</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="2016-02-1"><img src="2016-02-1/thumb.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">We Are Hiring A Coder</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="2013-06-15"><img src="2013-06-15/thumb.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Version 0.2 Released</div></a>
	</div>
	</div>
</div>

<div>
	<div style="display: inline-block;" class="lighten">
		<a href="2012-12-12"><img src="2012-12-12/thumb.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">Version 0.1 Released</div></a>
	</div>
</center>

<?php
include('subscribe.php');
include('../footer.php');
?>
