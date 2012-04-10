<?php require_once("../config.php"); ?>
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
.title {
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
</style>
<?php $max_result = mysql_query('select max(id) as max_id from ab_spells');
$max_id = mysql_result($max_result, 0, 0);
if (!isset($ab_id)) {
	$ab_id = (isset($_POST['id'])) ? mysql_real_escape_string($_POST['id']) : 1;
	if (!is_numeric($ab_id)) $ab_id = 1;
	if ($ab_id > $max_id) $ab_id = $max_id;
	if ($ab_id < 1) $ab_id = 1;
}
$spell = "SELECT * FROM ab_spells WHERE id = $ab_id";
$result = mysql_query($spell);
while ($row = mysql_fetch_assoc($result)) {
	echo "<div class='card'><table class='section'><tr class='title'><td width='20%'>L" . $row["lvl"] . "</td><td>" . strtoupper($row["name"]) . "<td width='20%'>" . $row["mana"] . "M</td></tr></table>";
	echo "<img style='margin-left:-30px;' src='icons/$ab_id.svg'>";
	echo "<div class='section' style='text-align: center; width: 390px; padding: 5px 0px;'>" . $row["description"] . "</div></div>";
} mysql_free_result($result); ?>
