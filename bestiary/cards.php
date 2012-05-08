<style>
.card {
	width: 430px;
	height: 550px;
	background-image: url(card.png);
	background-repeat: no-repeat;
	padding: 15px;
	margin: 0px;
	vertical-align: top;
	cursor: default;
}
.beast {
	font-family: Lucida Grande;
	font-size: 24px;
	text-align: center;
}
.section {
	color: #fff;
	border-style: solid;
	border-color: transparent;
	width: 400px;
	text-shadow: black 0.1em 0.1em 0.2em;
	font-weight: bold;
	font-size: 16px;
	font-family: 'Lucida Grande', Verdana, Arial, Sans-Serif;
}
.abilities {
	vertical-align: top;
	text-align: left;
}
.numbers {
	font-size: 12px;
	font-weight: bold;
	text-align: center;
}
</style>
<?php
function ability($x, &$y, $ab_id, $row) {
	global $site_root; ?>
		<tr>
			<td style="background-image: url('contour.png'), url('<?php echo "{$site_root}creatures/$ab_id/$y.svg"; ?>'), url('missing.png'); background-size: 100% 100%; width:99px; height:99px;"></td>
			<td><u><?php echo $row[$x]; ?></u><br><?php echo $row["$x info"]; ?></td>
		</tr>
	<?php
	$y++;
}
function cards($id) {
	global $site_root;
	$ICON_LIST = array(HEALTH_ICON, REGROWTH_ICON, FATIGUE_ICON, ENERGY_ICON, MEDITATION_ICON, DELAY_ICON, OFFENSE_ICON, DEFENSE_ICON, MOVEMENT_ICON, PIERCE_ICON, SLASH_ICON, CRUSH_ICON, SHOCK_ICON, BURN_ICON, FROST_ICON, POISON_ICON, SONIC_ICON, MENTAL_ICON);
	$ab_id = mysql_real_escape_string($id);
	$ab_creatures = "SELECT * FROM ab_creatures WHERE id = '$ab_id'";
	$ab_stats  = "SELECT health, regrowth, fatigue, energy, meditation, delay, offense, defense, movement FROM ab_stats WHERE id = '$ab_id'";
	$ab_stats2 = "SELECT pierce, slash,    crush,   shock,  burn,       frost, poison,  sonic,   mental   FROM ab_stats WHERE id = '$ab_id'";
	$ab_abilities = "SELECT * FROM ab_abilities WHERE id = '$ab_id'";
	$rows = db_query($ab_creatures); ?>
	<table style="860px" border="0">
		<tr>
		<th class="card"><?php
	foreach ($rows as $r) { ?>
		<table class='section'>
			<tr class='beast'>
				<td width='20%'><?php echo $r['sin'] . $r['lvl']; ?></td>
				<td><a href="#<?php echo $r['id']; ?>" id="<?php echo $r['id']; ?>"><?php echo strtoupper($r['name']); ?></a></td>
				<td width='20%'><?php echo $r['hex']; ?>H</td>
			</tr>
		</table>
		<a href="#grid">
			<div class="section" style="border: 0px; background:url('<?php echo "{$site_root}creatures/$ab_id/artwork.jpg" ?>'); width:400px; height:400px;"><img src="AB.png" style="position:relative; top:365px; left:180px;"></div>
		</a>
		<div class='section' style='text-align: center; width: 390px; padding: 5px 0px;'><?php echo $r['description']; ?></div><?php
	} ?>
		</th>
		<th class='card'>
			<table class='section'>
				<tr class='numbers'><?php
	for($i = 0; $i<9; $i++) { ?>
					<th><?php echo $ICON_LIST[$i]; ?></th><?php } ?>
				</tr>
				<tr class='numbers'><?php
	$rows = db_query($ab_stats);
	foreach ($rows as $r) {
		foreach ($r as $key => $x) {
			if($key == 'id') continue; ?>
					<td><?php echo $x; ?></td><?php } ?>
				</tr>
			</table><?php } ?>
			<table style='margin-top:-10px; margin-bottom:-10px;' class='section abilities'>
				<?php
	$abilities = array("passive", "weak", "medium", "strong");
	$y = 0;
	$rows = db_query($ab_abilities);
	foreach ($rows as $r)
		foreach ($abilities as $x)
			ability($x, $y, $ab_id, $r); ?>
			</table>
			<table class='section'>
				<tr class='numbers'><?php
	for($i = 9; $i<18; $i++) { ?>
					<th><?php echo $ICON_LIST[$i]; ?></th><?php } ?>
				</tr>
				<tr class='numbers'><?php
	$rows = db_query($ab_stats2);
	foreach ($rows as $r) {
		foreach ($r as $key => $x) {
			if($key == 'id') continue; ?>
					<td><?php echo $x; ?></td><?php } ?>
				</tr>
			</table><?php } ?>
		</th>
		</tr>
	</table><?php
}?>
