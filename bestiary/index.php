<?php $page_title = "Ancient Beast - Bestiary";
require_once("../header.php");
require_once("../global.php");
require_once("../stats/index.php");
require_once("cards.php");
require_once("progress.php");
$spaceless = str_replace(" ", "_", $r['name']);

//echo "<script type="text/javascript" src={$site_root}utils/tinybox.js"></script>";
$creatures = "SELECT * FROM ab_creatures ORDER BY sin, lvl";
$creature_results = db_query($creatures);

echo "<div style='text-align:center;'><a name='grid'>";
foreach ($creature_results as $r) {
	$spaceless = str_replace(" ", "_", $r['name']);
	echo "<div class='lighten' style=\"background:url('{$site_root}bestiary/{$r["name"]}/avatar.jpg'); background-size: 100%; display: inline-block; margin-bottom:-3px; cursor: pointer;\"><a href='#{$spaceless}'><img style='display: block;' src='{$site_root}bestiary/frame.png' alt='frame'></a></div>";
}
echo "</a></div>";

foreach ($creature_results as $r) {
	start_segment();
	cards($r["id"]);
	progress($r["id"], $r["name"]);
	end_segment();
}

start_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>
