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
<canvas id="kanvas" width="500" height="400" onclick="{pauseButtonPressed()}">
No canvas support.
</canvas>

<style>
.control_pane {
	text-align: left;
	float:left;
	margin-right:20px;
}

#download_link {
	font-size:14px;
}

</style>

<div id="controls" >
<p class="control_pane" >
<input type="text" id="textField0" value="30">framerate<br>
<input type="text" id="textField5" value="1">framestep<br>
<input type="text" id="textField1" value="transparent">bg color<br>
<input type="text" id="textField2" value="256">sprite width<br>
<input type="text" id="textField3" value="256">sprite height<br>
<input type="text" id="textField10" value="3">offset<br>
<input type="text" id="textField4" value="24">number of frames<br>
<input type="text" id="textField6" value="3">rows<br>
<input type="text" id="textField7" value="8">columns<br>
</p>
<p class="control_pane" >
<input type="text" id="textField8" value="0">X<br>
<input type="text" id="textField9" value="0">Y<br>
<button id="updateButton" onClick="{updateFields();}"> update </button>
<button id="pauseButton" onClick="{pauseButtonPressed()}"> Pause </button><br><br>
sprite.json <span id="download_link" ></span><br>
<textarea id="JSON_out" value="" style="max-width:200px;max-height:80px;min-width:200px;min-height:80px;" disabled></textarea>
</p>
<p class="control_pane" >
<input type="text" id="textField11" value="example">image url<br>
<button id="updateButton2" onClick="{updateImageSource();}"> update </button><br>
<span type="text" id="share_link" >share link</span><br>
</p>
</div>
</div>

<script type="text/javascript" src="b64.js"></script>
<script type="text/javascript" >
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

<?php end_segment();
end_page(); ?>
