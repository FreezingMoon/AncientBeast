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

$page_title = "Chat";
$style = '
.gitter-chat-embed-action-bar { display: none; }
.gitter iframe { width: 100%; height: 600px; }

#bar {
	background: transparent;
	width: 100%;
	height: 25px;
	position: relative;
	margin-top: -35px;
	padding-bottom: 5px;
}
#bar a {
	text-decoration: none;
	text-shadow: none;
	font-weight: bold !important;
	font-family: Verdana, Arial, sans-serif;
	font-size: .9em !important;
	padding: 2px 7px !important;
	cursor: pointer;
	border-radius: 4px;
	border: 1px solid #d3d3d3;
	color: #555555;
	background: rgb(255,255,255); /* Old browsers */
	background: linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(241, 241, 241, 1) 50%, rgba(225, 225, 225, 1) 51%, rgba(246, 246, 246, 1) 100%);
}
#bar a:hover { background: white; color: black; }

';
require_once("../header.php");
?>
<div id="bar">
	<a href="https://gitter.im/FreezingMoon/AncientBeast" style="margin-left: 815px;" target="_blank">Open Gitter</a>
</div>

<!-- Hightlight active page -->
<script>document.getElementById("<?php echo $page_title; ?>").className += " active";</script>

<div class="div gitter"></div>
<script>
	((window.gitter = {}).chat = {}).options = {
		room: 'FreezingMoon/AncientBeast',
		showChatByDefault: true,
		targetElement: '.gitter',
		useStyles: false,
		preload: true
	};
</script>
<script src="https://sidecar.gitter.im/dist/sidecar.v1.js" async defer></script>

<div class="div">
<iframe src="https://discordapp.com/widget?id=154868963132571649&theme=dark" width="100%" height="400" allowtransparency="true" frameborder="0"></iframe>
</div>

<div class="center" id="action">
	<div style="display: inline-block;" class="lighten">
		<a href="http://reddit.com/r/AncientBeast" target="_blank"><img src="../images/squares/reddit.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Reddit: Join Forum</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="https://github.com/FreezingMoon/AncientBeast" target="_blank"><img src="../images/squares/github.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png); ;">GitHub: Fork Project</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="http://ancient-beast.deviantart.com" target="_blank"><img src="../images/squares/deviantart.jpg" class="frame"><br>
		<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">deviantArt: Submit Art</div></a>
	</div>
</div>

<?php
disqus();
include('../footer.php'); ?>
