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
require_once "../images/stats/index.php"; ?>
<link rel="stylesheet" href="../units/cards.css">

<script>
function CallCreature(shout) {
	var thisSound = document.getElementById(shout);
	thisSound.play();
}

// The website uses a different jQuery shortcut than the game, using jQuery object fixes that
jQuery(document).ready(function() {
	// Show description of stats
	jQuery(".stats").mouseenter(function() {
		var card = jQuery(this).parent().siblings().find(".stats_desc");
		jQuery(card).show();
	});
	// Show description of masteries
	jQuery(".masteries").mouseenter(function() {
		var card = jQuery(this).parent().siblings().find(".masteries_desc");
		jQuery(card).show();
	});
	// Hide any descriptions
	jQuery(".section").mouseleave(function() {
		var card = jQuery(this).parent().siblings().find(".card_info");
		jQuery(card).hide();
	});
});
</script>
<?php
// Create the unit cards
function cards($r = "", $id = -1, $modifiers = false) {
	global $site_url; // From global.php
	global $stats;

	if ($id != -1 && !is_array($r)) {
		$ab_id = $id;

		$ab_creatures = get_creatures();
		$r = reset($ab_creatures);
	}

	// Preparing shout
	$spaceless = str_replace(' ', '%20', $r['name'] );
	$underscore = str_replace(' ', '_', $r['name'] );
	$CallCreature = 'CallCreature(\'' . $spaceless . '_shout\');';

	// Side A
?>
	<div class="center" style="display: inline-block; vertical-align: top;">
		<div class="card sideA" style="background-image: url('<?php echo $site_url; ?>images/cards/margin.png'), url('<?php echo $site_url; ?>game/deploy/units/artwork/<?php echo $r['name']; ?>.jpg');">

			<!-- On hover mini tutorial -->
			<div class="card_info stats_desc"><br>
				<div><span class="icon health"></span> Health: The raw amount of damage points a creature can take before it dies.</div>
				<div><span class="icon regrowth"></span> Regrowth: Amount of health that gets restored at the beginning of every turn.</div>
				<div><span class="icon endurance"></span> Endurance :  Protects unit from fatigue, which disables regrowth and meditation.</div><br>
				<div><span class="icon energy"></span> Energy : Each unit ability requires a certain amount of energy to be used.</div>
				<div><span class="icon meditation"></span> Meditation : Energy restored each turn.</div>
				<div><span class="icon initiative"></span> Initiative : Units with higher amount of initiative points get to act their turn faster.</div><br>
				<div><span class="icon offense"></span> Offense : Influences the damage output done by all the creature's attack abilities.</div>
				<div><span class="icon defense"></span> Defense : Protects the creature by reducing some of the incoming damage.</div>
				<div><span class="icon movement"></span> Movement : Any creature can move a certain number of hexagons every turn.</div>
			</div>
			<div class="card_info masteries_desc">
				<span>There are 9 common types of damage and a rare one called Pure damage that bypasses the formula bellow, doing a fixed non-variable amount of harm no matter what.</span><br><br>
				<span><u>Damage Formula</u><br>attack damage +<br>attack damage / 100 *<br>(offense of attacking unit -<br>defense of unit attacked /<br>number of hexagons hit +<br>source stat of attacker -<br>source stat of defender)</span><br><br>
				<span>Minimum damage is usually 1<br>unless the hit is being avoided.</span>
			</div>

			<!-- Card Anchor -->
			<a href="#<?php echo $underscore; ?>"><div style="height: 100%;"></div></a>
<?php
			// Display unit info
			echo '<div class="section info sin' . $r['realm'] . '">
					<span class="type" creature_type="' . $r['realm'] . $r['level'] . '" style="float: left; margin-left: 22px;">' . $r['realm'] . $r['level'] . '</span>
					<span><audio src="../game/deploy/units/shouts/' . $spaceless . '.ogg" id="' . $spaceless . '_shout" style="display: none;" preload="auto"></audio>
					<a class="name" onClick="' . $CallCreature . '" onmouseover="' . $CallCreature . '" creature_name="' . $r['name'] . '" >' . $r['name'] . '</a></span>
					<span class="hexs" creature_size="' . $r['size'] . 'H" style="float: right; margin-right: 22px;">' . $r['size'] . '&#11041;</span>
			</div>
		</div></div>';

		// Side B
		echo '
		<div class="card sideB" style="background-image: url(' . $site_url . 'images/cards/margin.png), url(' . $site_url . 'images/cards/' . $r['realm'] . '.jpg);">
				<div class="section numbers stats">';
					// Display Stats
					$i=1;
					foreach ($r["stats"] as $key => $value) {
					 	if( $i > 0 && $i < 10) {
				 			displayStat($key, $value, $modifiers);
				 		}
						$i++;
					}
					echo '
				</div>
				<div class="section abilities">';
			  		// Display Abilities
					for ($i=0; $i < 4; $i++) {
						// Figure out if upgradable
						if (!empty($r["ability_info"][$i]["upgrade"])) { $upgrade = '<br><span class="desc" id="upgrade">Upgrade: ' . $r["ability_info"][$i]["upgrade"] . '</span>'; }
						// Figure out the cost
						if ($i==0) { $cost = ' - this ability is passive.'; } else { $cost = ' - costs ' . $r["ability_info"][$i]["costs"]["energy"] . ' energy pts.'; }
						echo '
						<div class="ability">
							<div class="icon" style="background-image: url(\'' . $site_url . 'game/deploy/units/abilities/' . $r["name"] . ' ' . $i . '.svg\');">
								<div class="contour"></div>
							</div>
							<div class="wrapper">
								<div class="info">
									<h3><span style="text-decoration: underline;">' . $r["ability_info"][$i]["title"] . '</span>' . $cost . '</h3>
									<span class="desc" id="desc">' . $r["ability_info"][$i]["desc"] . '</span><br>
									<span class="desc" id="info">' . $r["ability_info"][$i]["info"] . '</span>'
									. $upgrade . '
								</div>
							</div>
						</div>';
						$upgrade = NULL;
				}
				echo '
				</div>
				<div class="section numbers masteries">';
					// Display Masteries
					$i=1;
					foreach ($r["stats"] as $key => $value) {
					 	if( $i > 9) {
					 		displayStat($key, $value, $modifiers);
				 		}
				 		$i++;
					}
					echo '
				</div>
			</div>';
}
?>
