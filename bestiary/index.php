<?php $page_title = "Ancient Beast - Bestiary";
require_once("../header.php");
require_once("../global.php");
require_once("../ico/index.php");
require_once("cards.php");
require_once("progress/index.php");
?>
<script type="application/javascript" src="<?php echo $site_root; ?>utils/tinybox.js"></script>
<?php
start_segment(); ?>
<a id="grid"></a><div style="text-align:center; margin-left:-6px;"><?php
$creatures = "SELECT * FROM ab_creatures ORDER BY sin, lvl";
$rows = db_query($creatures);
foreach ($rows as $r) { ?>
<div class="lighten" style="background:url('<?php echo "{$site_root}creatures/{$r["id"]}/avatar.jpg"; ?>'); background-size: 100%; display: inline-block; margin-bottom:-3px; cursor: pointer;">
<a href="#<?php echo $r["id"]; ?>"><img style="display: block;" src="<?php echo "{$site_root}bestiary/frame.png"; ?>" alt="frame"></a>
</div><?php
} ?>
</div><?php
end_segment();
$rows = db_query($creatures);
foreach ($rows as $r) {
	start_segment();
	echo "<center>";
	cards($r["id"]);
	progress($r["id"]);
	echo "</center>";
	end_segment();
}
start_segment();
include("../utils/disqus.php");
end_segment();
end_page();
?>
