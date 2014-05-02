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
require_once("../images/stats/index.php"); ?>
<style>
.card table,#card table{border-spacing: 0px;}

.card {
	width: 430px;
	height: 550px;
	background-repeat: no-repeat;
	cursor: default;
	background-position: 16px 15px;
	position : relative; 
}
.section.cardborder {
	background-image: url('<?php echo $site_root; ?>images/cards/margin.png');
	background-repeat: no-repeat;
	border: 0px;
	width: 430px;
	display: block;
	height: 550px;
}
.section {
	color: #fff;
	border-style: solid;
	border-color: transparent;
	border-spacing: 0px;
	width: 402px;
	text-shadow: black 0.1em 0.1em 0.2em;
	font-weight: bold;
	font-size: 16px;
}
.embed {
	position: absolute;
	margin: 15px 0 0 15px;
}

.recto .info {
	background: rgba(0,0,0,0.7);
	border-radius: 15px;
	border: 4px ridge !important;
	top: 497px;
	left: 15px;
	position: absolute; 
	z-index:1; 
}
.recto .info tr{ 
	font-size: 24px;
	text-align: center;
	
}
.recto .info.sin-{border-color: grey !important;}
.recto .info.sinA{border-color: gold !important;}
.recto .info.sinE{border-color: orange !important;}
.recto .info.sinG{border-color: green !important;}
.recto .info.sinL{border-color: red !important;}
.recto .info.sinP{border-color: violet !important;}
.recto .info.sinS{border-color: blue !important;}
.recto .info.sinW{border-color: indigo !important;}

.recto .info.sin- tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em grey;}
.recto .info.sinA tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em gold;}
.recto .info.sinE tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em orange;}
.recto .info.sinG tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em green;}
.recto .info.sinL tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em red;}
.recto .info.sinP tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em violet;}
.recto .info.sinS tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em blue;}
.recto .info.sinW tr{text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em indigo;}


.verso.sin-{ background-image: url('<?php echo $site_root; ?>images/cards/-.jpg'); }
.verso.sinA{ background-image: url('<?php echo $site_root; ?>images/cards/A.jpg'); }
.verso.sinE{ background-image: url('<?php echo $site_root; ?>images/cards/E.jpg'); }
.verso.sinG{ background-image: url('<?php echo $site_root; ?>images/cards/G.jpg'); }
.verso.sinL{ background-image: url('<?php echo $site_root; ?>images/cards/L.jpg'); }
.verso.sinP{ background-image: url('<?php echo $site_root; ?>images/cards/P.jpg'); }
.verso.sinS{ background-image: url('<?php echo $site_root; ?>images/cards/S.jpg'); }
.verso.sinW{ background-image: url('<?php echo $site_root; ?>images/cards/W.jpg'); }
.verso{ margin: 0 0 0 15px; }

.verso .cardborder{
	width: 400px; 
	height: 520px;
	padding: 15px;
	top: 0px; 
	position: absolute; 
	z-index: 2;
}

.abilities {
	vertical-align: top;
	text-align: left;
	padding: 5px 0px 5px 0px;
	margin: 0px;
	width: 390px;
	height: 416px;
}

.abilities h3{ font-size: 16px; margin: 0; text-decoration: underline;}

.abilities .icon{
	position: absolute;
	left: 0px;
	top: 0px;
}

.abilities .icon,.contour{
	display: inline-block;
	background-size: 100% 100%;
	width: 100px;
	height: 100px;
	background-image: url('<?php echo $site_root; ?>images/missing.png')
}

.abilities .icon .contour{
	background-image: url('<?php echo $site_root; ?>images/contour.png');
}

.ability{position: relative;}

.abilities .ability .wrapper{
	display: table-cell; 
	vertical-align: middle;
	height: 100px;
	padding-left: 103px;
}

.abilities .ability .info{
	display: inline-block;
}

.numbers {
	font-size: 12px;
	font-weight: bold;
	text-align: center;
}

.card_info {
	position: absolute;
	top: 15px;
	left: 16px;
	display: none;
	background: rgba(0,0,0,.8);
	width: 400px;
	color: white;
	height: 520px;
	opacity: 1;
	font-size: 17px;
	z-index: 2;
	text-align: left;
}
.card_info .stat_desc,
.card_info .masteries_desc{
	margin: 5px 10px;
	font-size: 100%;
}
.card_info .stat_desc div,
.card_info .masteries_desc div{
	margin: 5px;
}

.low_row .stats_infos {
	bottom: 100%;
	top: auto;
	left: 0px;
}

.stats_infos {
	width: 400px;
	height: 415px;
	position: absolute;
	left: 0px;
	background: black;
	opacity: 0;
	height: 0;
	color: white;
	z-index: 2;
	line-height: 20px;
	font-size: 15px;
	overflow: hidden;
	text-align: left;
/*	transition: all 250ms;
	-moz-transition: all 250ms; 
	-webkit-transition: all 250ms; 
	-ms-transition: all 250ms;
	-o-transition: all 250ms; 
*/
	border-radius: 10px;
}

.stats_infos div { margin: 10px 20px; }
.stats_infos div.textcenter { text-align: center; }

.stats:hover{
	background: black;
	border-radius: 10px;
}


#dash .stats:hover{
	border-top-left-radius: 10px;
	border-top-right-radius: 10px;
	border-bottom-left-radius: 0px;
	border-bottom-right-radius: 0px;
}

#dash .low_row .stats:hover{
	border-top-left-radius: 0px;
	border-top-right-radius: 0px;
	border-bottom-left-radius: 10px;
	border-bottom-right-radius: 10px;
}


.stats:first-child .stats_infos{ border-top-left-radius: 0px; }
.stats:last-child .stats_infos{ border-top-right-radius: 0px; }

.low_row .stats:first-child .stats_infos{ border-top-left-radius: 10px; border-bottom-left-radius: 0px; }
.low_row .stats:last-child .stats_infos{ border-top-right-radius: 10px; border-bottom-right-radius: 0px; }

.stats:hover .stats_infos {
  height: auto;
  opacity: 1;
}


</style>
<script>
function CallCreature(shout) {
	var thissound=document.getElementById(shout);
	thissound.play();
}

function ucfirst (str) {
  str += '';
  var f = str.charAt(0).toUpperCase();
  return f + str.substr(1);
}

//The website use a different jquery shortcut than the game. Using jQuery object fix that.
jQuery(document).ready(function(){

	var activate = function(){
		var stat = jQuery(this).attr('stat');
		var card = jQuery(this).parent().parent().parent().parent().parent().parent();
		if( typeof G != "undefined" && G instanceof Game){
			G.UI.showStatInfos(stat);
		}
	};

	jQuery(".card .stat_table").first().mouseenter(function(){
		var card = jQuery(this).parent().parent().parent().parent().parent().parent();
		jQuery(card).find(".card_info").show();
		jQuery(card).find(".stat_desc").show();
		jQuery(card).find(".masteries_desc").hide();
	});
	jQuery(".card .stat_table").last().mouseenter(function(){
		var card = jQuery(this).parent().parent().parent().parent().parent().parent();
		jQuery(card).find(".card_info").show();
		jQuery(card).find(".stat_desc").hide();
		jQuery(card).find(".masteries_desc").show();
	});
	jQuery(".card .stat_table").mouseleave(function(){
		var card = jQuery(this).parent().parent().parent().parent().parent().parent();
		jQuery(card).find(".card_info").hide();
	});

	jQuery(".card .numbers .stats").mouseenter(activate);
	jQuery(".card .numbers .stats").click(activate);
});
</script>
<?php
function cards($r = "", $id = -1, $embed = 0, $tooltip = false) { //Print a card
	global $site_root; // from global.php
	global $stats2;

	if( $id != -1 && !is_array($r) ){
		$ab_id = $id;

		$ab_creatures = get_creatures();
		$r = reset($ab_creatures);
	}
  
	//Card entry
	$spaceless = str_replace(' ', '%20', $r['name'] );
	$underscore = str_replace(' ', '_', $r['name'] );
	$CallCreature = 'CallCreature(\'' . $spaceless . '_shout\');';

	echo '
	<table class="center" border=0>
		<th class="card recto" style="background-image: url(\'' . $site_root . 'units/artwork/' . $r['name'] . '.jpg\');">
			<div class="card_info">
				<div class="stat_desc">
					<div><span class="icon health"></span> Health: The raw amount of damage points a creature can take before it dies.</div>
					<div><span class="icon regrowth"></span> Regrowth: Amount of health that gets restored at the beginning of every turn.</div>
					<div><span class="icon endurance"></span> Endurance :  Protects unit from fatigue, which disables regrowth and meditation.</div><br><br>
					<div><span class="icon energy"></span> Energy : Allows the use of abilities.</div>
					<div><span class="icon meditation"></span> Meditation : Energy restored each turn.</div>
					<div><span class="icon initiative"></span> Initiative : Creatures with higher amount of initiative points get to act their turn faster.</div><br><br>
					<div><span class="icon offense"></span> Offense : Influences the damage output done by all the creature\'s attack abilities.</div>
					<div><span class="icon defense"></span> Defense : Protects the creature by reducing some of the incoming damage.</div>
					<div><span class="icon movement"></span> Movement : Any creature can move a certain number of hexagons every turn.</div>
				</div>
				<div class="masteries_desc">
					<div style="text-align: center; font-size: x-large;">
					<span>There are 9 common types of damage and a rare one called Pure damage that bypasses the formula bellow, doing a fixed non-variable amount of harm.</span><br><br>
					<span><u>Damage Formula</u><br>attack damage +<br>attack damage / 100 *<br>(offense of attacking unit -<br>defense of unit attacked /<br>number of hexagons hit +<br>source stat of attacker -<br>source stat of defender)</span><br><br>
					<span>Minimum damage is usually 1 unless the hit is being avoided.
					</div>
				</div>
			</div>
			<div href="#' . $underscore . '" class="section cardborder">
			</div>
			';
			//Display 3d creature if option enabled
			if ($embed == 1) echo '<div class="embed"><iframe frameborder="0" height="520" width="400" src="http://sketchfab.com/embed/' . $r['embed'] . '?autostart=1&transparent=1&autospin=1&controls=0&watermark=0&desc_button=0&stop_button=0"></iframe></div>';
			echo '<table class="section info sin' . $r['realm'] . '">
				<tr>
					<td class="type" creature_type="'.$r['realm'].$r['lvl'].'" style="width:20%;">'.$r['realm'].$r['lvl'].'</td>
					<td><audio src="shouts/' . $spaceless . '.ogg" id="' . $spaceless . '_shout" style="display:none;" preload="auto"></audio>
					<a class="name" onClick="' . $CallCreature . '" onmouseover="' . $CallCreature . '" creature_name="' . $r['name'] . '" >' . $r['name'] . '</a></td>
					<td class="hexs" creature_size="' . $r['size'] . 'H" style="width:20%;">' . $r['size'] . 'H</td>
				</tr>
			</table>
		</th>
		<th class="card verso sin' . $r['realm'] . '">
			<div class="section cardborder">
				<table class="section stat_table" style="position: relative;">
					<tr class="numbers">';
					//Display Stats Numbers
					$i=0;
					foreach ($r["stats"] as $key => $value) {
					 	if( $i >= 0 &&  $i <= 8) { 
				 			displayStat($key,$value,"",$tooltip); 
				 		}
						$i++;
					}
					echo '
					</tr>
				</table>
				<div class="section abilities">';
			  	//Display Abilities
				for ($i=0; $i < 4; $i++) { 
				 	# code...
					echo '
					<div class="ability">
						<div class="icon" style="background-image: url(\'' . $site_root . 'units/icons/' . $r["name"] . ' ' . $i . '.svg\');">
							<div class="contour"></div>
						</div>
						<div class="wrapper">
							<div class="info">
								<h3>' . $r["ability_info"][$i]["title"] . '</h3>
								<span class="desc" id="desc">' . $r["ability_info"][$i]["desc"] . '</span><br>
								<span class="desc" id="info">' . $r["ability_info"][$i]["info"] . '</span>
							</div>
						</div>
					</div>';
				}
				echo '
				</div>
				<table class="section low_row stat_table" style="position: absolute; top: 481px; left: 15px;">
					<tr class="numbers">';
					//Display Masteries Numbers
					$i=0;
					foreach ($r["stats"] as $key => $value) {
					 	if( $i >= 9 &&  $i <= 17) { 
					 		displayStat($key,$value,"",$tooltip); 
				 		}
				 		$i++;
					}
					echo '
					</tr>
				</table>
			</div>
		</th>
	</table>';
}
?>
