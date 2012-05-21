<?php $page_title = "Ancient Beast - Bestiary";
require_once("../header.php");
require_once("../global.php");
require_once("../stats/index.php");
require_once("cards.php");
require_once("progress.php");

//echo "<script type="text/javascript" src={$site_root}utils/tinybox.js"></script>";
$creatures = "SELECT * FROM ab_creatures ORDER BY sin, lvl";
$creature_results = db_query($creatures);

start_segment();
	echo "<div style='text-align:center; margin-left:-6px;'><a name='grid'>";
	foreach ($creature_results as $r) {
		echo "<div class='lighten' style=\"background:url('{$site_root}bestiary/{$r["name"]}/avatar.jpg'); background-size: 100%; display: inline-block; margin-bottom:-3px; cursor: pointer;\"><a href='#{$r["name"]}'><img style='display: block;' src='{$site_root}bestiary/frame.png' alt='frame'></a></div>";
	}
	echo "</a></div>";
end_segment();

	foreach ($creature_results as $r) {
		start_segment();
			echo "<center><a name=\"{$r["name"]}\">";
			cards($r["id"]);
			progress($r["id"]);
			echo "</a></center>";
		end_segment();
	}

start_segment();
include("../utils/disqus.php");
end_segment();

end_page();
?>
