<script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
<?php
$page_title = 'Ancient Beast - Units';
$stylesheet = '../combat/css/grid.css';
require_once('../header.php');
require_once('../global.php');
require_once('../images/stats/index.php');
require_once('functions.php');
require_once('cards.php');
require_once('grid.php');

$creature_results = get_creatures();
//navigation bar
//TODO
//echo '<nav>Modes: Normal | List | Versus - Log-in to purchase creatures. || You own x out of 50 creatures. - View: 2D/3D - SketchFab gallery</nav>';
//get link php variable
//if normal, list or versus...

//grid view
?>
<style type="text/css">
	#creaturegrid .vignette,
	.vignette div.border,
	.vignette div.overlay {
		height: 128px;
		width: 128px;
	}
	#creaturegrid {
		width: 896px;
		height: 896px;
	}
</style>
<?php creatureGrid($creature_results); ?>
<br>
<?php
//detailed view
$i = 0;
foreach ($creature_results as $r) {
	$underscore = str_replace(' ', '_', $r['name']);
	echo "<div class='div center' id='$underscore'>";
	cards($r);
	echo '<br>';
	progress($r['progress'],$r);
	echo '</div>';
	$i++;
}
disqus('Ancient Beast - Bestiary');
include('../footer.php'); ?>
