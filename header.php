<?php
require_once("global.php");
?>
<!doctype html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html;charset=utf-8">
<meta name="description" content="Turn Based Strategy Game Played Online Against Other People. Master your beasts!">
<meta name="keywords" content="game, online, multiplayer, TBS, PvP, RPG, strategy, combat, arena, free, foss, open source, 2d, animation, chess, creatures, beasts, bitcoin, bets">
<meta name="author" content="Dread Knight">
<!--set page title-->
<title><?php
if (isset($page_title)) {
	echo $page_title;
}
else {
	echo "Ancient Beast";
}?></title>
<link rel="stylesheet" href="<?php echo $site_root; ?>stylesheet.css">
<?php
if (isset($style)) {
	echo "<style>$style</style>";
}
if (isset($stylesheet)) {
	echo "<link rel='stylesheet' href='$stylesheet'>";
} ?>
<!--flattr-->
<script type="application/javascript" src="http://api.flattr.com/js/0.6/load.js?mode=auto"></script>
<!--jquery-->
<script type="application/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js"></script>
<!--pixastic-->
<script type="application/javascript" src="<?php echo $site_root; ?>utils/pixastic.js"></script>
<script type="application/javascript" src="<?php echo $site_root; ?>utils/lighten.js"></script>
<script type="application/javascript">
$(document).ready(function(){
	$('.lighten').each(function(){
		$(this).mouseenter(function() {
			var c = Pixastic.process($('img', this).get(0), "lighten", {amount:0.4});
			$(this).mouseleave(function() {
				Pixastic.revert(c);
			});
		});
	});
});
</script>
</head>
<body>
<?php
include_once("analytics.php");
?>
<!--banner-->
<header id="header">
<div style="margin-top: -15px; margin-bottom: 50px;"><a href="<?php echo $site_root; ?>"><img src="<?php echo $site_root; ?>images/AncientBeast.png" alt="Ancient Beast"></a>
<!--navigation menu-->
<nav><table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$menu = array("bestiary", "items", "bets", "game", "chat", "gallery");
foreach ($menu as &$menuItem) {
	echo "<td><a href='{$site_root}$menuItem' id='$menuItem' class='lighten'><img alt='".ucfirst($menuItem)."' src='{$site_root}images/icons/$menuItem.png' width='100' height='100' style='display:block;'>".ucfirst($menuItem)."</a></td>";
} ?>
</tr></table></nav>
</div>
</header>

<!--main area-->
<div id="wrapper">
