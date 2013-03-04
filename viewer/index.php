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

<?php
$page_title = "Ancient Beast - Sprite Sheet Animation Viewer";
require_once("../header.php");
start_segment(); ?>

<div align="center">
<canvas class="center" id="kanvas" width="500" height="400" onclick="{pauseButtonPressed()}">
No canvas support.
</canvas>
</div>
<?php separate_segment(); ?>
<style>
.control_pane {
	text-align: left;
	float: left;
	width: 25%;
}
.control_buttons {
	list-style-type: none;
	width: 100%;
	font-size: 18px;
	font-weight: bold;
	margin: 0;
	padding: 0;
	margin-left: auto;
	margin-right: auto;

	text-align: center;
}
.control_buttons li {
	display: inline;
	padding: 25px;
}
</style>

<div align="center">
<p class="control_pane">
<input type="text" size="10" id="textField4" value="24"> frame count<br>
<input type="text" size="10" id="textField0" value="30"> frame rate<br>
<input type="text" size="10" id="textField5" value="1"> frame step
</p>

<p class="control_pane">
<input type="text" size="10" id="textField2" value="256"> sprite width<br>
<input type="text" size="10" id="textField3" value="256"> sprite height<br>
<input type="text" size="10" id="textField10" value="3"> sprite offset
</p>

<p class="control_pane">
<input type="text" size="10" id="textField8" value="0"> X offset<br>
<input type="text" size="10" id="textField9" value="0"> Y offset<br>
<input type="text" size="10" id="textField1" value="transparent"> bg color
</p>

<p class="control_pane">
<input type="text" size="10" id="textField6" value="3"> rows<br>
<input type="text" size="10" id="textField7" value="8"> columns<br>
<input type="text" size="10" id="textField11" value="sample"> image
</p>
</div>

<ul class="control_buttons">
<li><button id="updateButton" onClick="{updateFields();}"> Update </button></li>
<li><button id="pauseButton" onClick="{pauseButtonPressed()}"> Pause </button></li>
<li><button id="share_link"> Copy </button></li>
<li><button id="download_link"> Save </button></li>
</ul>

<textarea id="JSON_out" value="" style="display:none;" disabled></textarea>

<script type="text/javascript" src="b64.js"></script>
<script type="text/javascript">
var start_json = "";
<?php if($_GET['s']){ ?>
start_json = "<?php echo $_GET['s']; ?>";
start_json = Base64.decode(start_json);
start_json = JSON.parse(start_json);

	document.getElementById("textField0").value = start_json.fps;
	document.getElementById("textField1").value = start_json.bcol;
	document.getElementById("textField2").value = start_json.sprw;
	document.getElementById("textField3").value = start_json.sprh;
	document.getElementById("textField4").value = start_json.icnt;
	document.getElementById("textField5").value = start_json.step;
	document.getElementById("textField6").value = start_json.rows;
	document.getElementById("textField7").value = start_json.cols;
	document.getElementById("textField8").value = start_json.ix;
	document.getElementById("textField9").value = start_json.iy;
	document.getElementById("textField10").value = start_json.off;

<?php } ?>
</script>

<script id="code" type="text/javascript" src="code.js"></script>

<?php separate_segment();
echo '<div class="center">You can use <a href="https://raw.github.com/Fweeb/blender_spritify/master/spritify.py" target="_blank" download><b>Spritify</b></a> <a href="http://blender.org" target="_blank"><b>blender</b></a> <a href="https://github.com/Fweeb/blender_spritify" target="_blank"><b>addon</b></a> to generate <a href="spritesheet.png" target="_blank"><b>sprite sheets</b></a>. Feel free to share your sprite sheets below.</div>';
separate_segment();
include('../utils/disqus.php');
end_segment();
end_page(); ?>
