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

<style>
.card table{border: none;}

.card {
	width: 430px;
	height: 550px;
	background-repeat: no-repeat;
	cursor: default;
	background-position: center;
}
.section.cardborder{
	background-image: url('<?php echo $site_root; ?>images/cards/margin.png');
	border: 0px; 
	width: 430px;
	display: block;
	height: 550px;
}
.section {
	color: #fff;
	border-style: solid;
	border-color: transparent;
	width: 400px;
	text-shadow: black 0.1em 0.1em 0.2em;
	font-weight: bold;
	font-size: 16px;
}
.embed{
	position: absolute; 
	margin: 15px 0 0 15px;
}

.recto .info{
	background: rgba(0,0,0,0.7); 
	border-radius: 15px; 
	border: 4px ridge; 
	position: relative; 
	top: 495px; 
	left: 15px;
}
.recto .info tr{ 
	font-size: 24px; 
	text-align: center; 
	
}
.recto .info.sin-{border-color: grey;}
.recto .info.sinA{border-color: gold;}
.recto .info.sinE{border-color: orange;}
.recto .info.sinG{border-color: green;}
.recto .info.sinL{border-color: red;}
.recto .info.sinP{border-color: violet;}
.recto .info.sinS{border-color: blue;}
.recto .info.sinW{border-color: indigo;}

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
.verso{ background-position: center; margin: 0 0 0 15px; }

.verso .cardborder{
	width: 400px; 
	height: 520px;
	padding: 15px;
}

.icon{
	height: 32px;
	width: 32px;
	display: inline-block;
}

.health .icon{ background-image: url('<?php echo $site_root; ?>images/stats/health.png'); }
.regrowth .icon{ background-image: url('<?php echo $site_root; ?>images/stats/regrowth.png'); }
.fatigue .icon{ background-image: url('<?php echo $site_root; ?>images/stats/fatigue.png'); }
.energy .icon{ background-image: url('<?php echo $site_root; ?>images/stats/energy.png'); }
.meditation .icon{ background-image: url('<?php echo $site_root; ?>images/stats/meditation.png'); }
.initiative .icon{ background-image: url('<?php echo $site_root; ?>images/stats/initiative.png'); }
.offense .icon{ background-image: url('<?php echo $site_root; ?>images/stats/offense.png'); }
.defense .icon{ background-image: url('<?php echo $site_root; ?>images/stats/defense.png'); }
.movement .icon{ background-image: url('<?php echo $site_root; ?>images/stats/movement.png'); }

.pierce .icon{ background-image: url('<?php echo $site_root; ?>images/stats/pierce.png'); }
.slash .icon{ background-image: url('<?php echo $site_root; ?>images/stats/slash.png'); }
.crush .icon{ background-image: url('<?php echo $site_root; ?>images/stats/crush.png'); }
.shock .icon{ background-image: url('<?php echo $site_root; ?>images/stats/shock.png'); }
.burn .icon{ background-image: url('<?php echo $site_root; ?>images/stats/burn.png'); }
.frost .icon{ background-image: url('<?php echo $site_root; ?>images/stats/frost.png'); }
.poison .icon{ background-image: url('<?php echo $site_root; ?>images/stats/poison.png'); }
.sonic .icon{ background-image: url('<?php echo $site_root; ?>images/stats/sonic.png'); }
.mental .icon{ background-image: url('<?php echo $site_root; ?>images/stats/mental.png'); }

.health:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/health.gif'); }
.regrowth:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/regrowth.gif'); }
.fatigue:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/fatigue.gif'); }
.energy:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/energy.gif'); }
.meditation:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/meditation.gif'); }
.initiative:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/initiative.gif'); }
.offense:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/offense.gif'); }
.defense:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/defense.gif'); }
.movement:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/movement.gif'); }

.pierce:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/pierce.gif'); }
.slash:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/slash.gif'); }
.crush:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/crush.gif'); }
.shock:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/shock.gif'); }
.burn:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/burn.gif'); }
.frost:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/frost.gif'); }
.poison:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/poison.gif'); }
.sonic:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/sonic.gif'); }
.mental:hover .icon{ background-image: url('<?php echo $site_root; ?>images/stats/mental.gif'); }

.abilities {
	vertical-align: top;
	text-align: left;
	padding: 0 5px;
	margin: 0px 0px -5px 0px;
	border: none;
	width: 390px;
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
	background-image:  url('<?php echo $site_root; ?>images/missing.png')
}

.abilities .icon .contour{
	background-image: url('<?php echo $site_root; ?>images/contour.png');
}

.ability{position: relative;}

.abilities .ability .wrapper{
	display: table-cell; 
	vertical-align: middle;
	height: 100px;
	padding-left: 100px;
}

.abilities .ability .info{
	display: inline-block;
}

.numbers {
	font-size: 12px;
	font-weight: bold;
	text-align: center;
}
</style>
<script>
function CallCreature(shout) {
	var thissound=document.getElementById(shout);
	thissound.play();
}
</script>
<?php
function cards($r = "", $id = -1) { //Print a card
	global $site_root; // from global.php
	global $stats2;

	if( $id != -1 || !is_array($r) ){
		$ab_id = mysql_real_escape_string($id);

		$ab_creatures = "SELECT ab_creatures.*, ab_stats.*, ab_abilities.* FROM ab_creatures
						LEFT JOIN ab_stats ON ab_creatures.id = ab_stats.id
						LEFT JOIN ab_abilities ON ab_creatures.id = ab_abilities.id
						WHERE ab_creatures.id = '$ab_id'";

		$r = db_query($ab_creatures);
		$r = $r[0];
	}
  
	//Card entry
	$spaceless = str_replace(' ', '_', $r['name'] );
	$CallCreature = 'CallCreature(\'' . $r['name'] . '_shout\');';

	echo '
<center>
	<table border=0>
		<th class="card recto" style="background-image: url(\'' . $site_root . 'bestiary/' . $r['name'] . '/artwork.jpg\');">
			<a href="#' . $spaceless . '" class="section cardborder">
				<div class="embed">' . $r['embed'] . '</div>
				<table class="section info sin' . $r['sin'] . '">
					<tr>
						<td class="type" width="20%">'.$r['sin'].$r['lvl'].'</td>
						<td><audio src="' . $r['name'] . '/' . $r['name'] . '.ogg" id="' . $r['name'] . '_shout" style="display:none;" preload="auto"></audio>
							<a class="name" onClick="' . $CallCreature . '" onmouseover="' . $CallCreature . '">' . $r['name'] . '</a>
						</td>
						<td class="hexs" width="20%">' . $r['hex'] . 'H</td>
					</tr>
				</table>
			</a>
		</th>
		<th class="card verso sin' . $r['sin'] . '">
			<div class="section cardborder">
				<table class="section">
					<tr class="numbers">';
					//Display Stats Numbers
					$i=0;
					foreach ($r as $key => $value) {
					 	if( $i > 5 &&  $i < 15) {
							echo '
							<td class="' . $key . '" title="' . ucfirst($key) . '">
								<div class="icon"></div>
								<div class="value">' . $value . '</div>
							</td>';
						}
						$i++;
					}
					echo '
					</tr>
				</table>
				<div class="section abilities">';

			  	//Display Abilities
				$abilities = array('passive', 'weak', 'medium', 'strong');
				for ($i=0; $i < 4; $i++) { 
				 	# code...
					echo '
					<div class="ability">
						<div class="icon" style="background-image: url(\'' . $site_root . 'bestiary/' . $r["name"] . '/' . $i . '.svg\');">
							<div class="contour"></div>
						</div>
						<div class="wrapper">
							<div class="info">
								<h3>' . $r[$abilities[$i]] . '</h3>
								<span class="desc">' . $r[$abilities[$i] . " info"] . '</span>
							</div>
						</div>
					</div>';
				}
				echo '
				</div>
				<table class="section">
					<tr class="numbers">';
					//Display Masteries Numbers
					$i=0;
					foreach ($r as $key => $value) {
					 	if( $i > 14 &&  $i < 24) {
							echo '
							<td class="' . $key . '" title="' . ucfirst($key) . '">
								<div class="icon" ></div>
								<div class="value">' . $value . '</div>
							</td>';
						}
						$i++;
					}
					echo '
					</tr>
				</table>
			</div>
		</th>
	</table>
</center>';
}
?>
