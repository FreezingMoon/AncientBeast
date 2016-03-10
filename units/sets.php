<?php
require_once 'grid.php';
require_once 'cards.php';
?>

<script>document.title = "Ancient Beast - Sets";</script>

<!-- Grid Adjustments -->
<style type="text/css">
#creaturegrid .vignette,
.vignette div.border,
.vignette div.overlay {height: 128px; width: 128px;}
#creaturegrid {width: 896px; height: 896px;}
</style>

<link rel="stylesheet" href="progress.css">
<?php creatureGrid($creature_results); ?>
<div class="center">
	<div style="display: inline-block;" class="lighten">
		<a href="?set=alpha"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">(α) Alpha Set</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="?set=beta"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">(β) Beta Set</div></a>
	</div>
	<div style="display: inline-block;" class="lighten">
		<a href="?set=gamma"><div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">(γ) Gamma Set</div></a>
	</div>
</div>

<?php
// Cards
$i = 0;
foreach ($creature_results as $r) {
	$underscore = str_replace(' ', '_', $r['name']);
	echo '<div class="div center" id="' . $underscore . '">';
	cards($r);
	echo '<br>';
	progress($r['progress'],$r);
	echo '</div>';
	$i++;
}
echo $license;
?>
