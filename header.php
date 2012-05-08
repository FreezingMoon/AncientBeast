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
<script type="text/javascript" src="http://api.flattr.com/js/0.6/load.js?mode=auto"></script>
<!--jquery-->
<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js"></script>
<!--pixastic-->
<script type="text/javascript" src="<?php echo $site_root; ?>utils/pixastic.js"></script>
<script type="text/javascript" src="<?php echo $site_root; ?>utils/lighten.js"></script>
<script type="text/javascript">
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
<?php include_once("menu/index.php") ?>
</div>
</header>

<!--main area-->
<div id="wrapper">
