<!-- TODO: Update the URL to contain the new units id -->
<link rel="stylesheet" href="carousel.css">
<link rel="stylesheet" href="progress.css">

<!-- Carousel -->
<?php
// Get the selected ID or pick a random valid id
$id = isset($_GET['id']) ? $_GET['id'] : $random;

// Calculate the total number of existing units
$total_units = count($creature_results);

// TODO: Make sure the id actually exists
//$valid = array_search($id, $total_units);

// Make sure random id is within range
if ($id == $random) {
	$id = rand(1, $total_units);
}
?>
<script>
	var selectedUnit = <?php echo $id; ?>;
	var siteUrl = "<?php echo $site_url; ?>";
</script>
<script type="text/javascript" src="carousel.js"></script>

<!-- Warning: Work in progress! -->
<div class="center warning">This viewer is currently not fully functional, as it requires a bit more coding. Go check out the <a href="/?view=sets"><u>sets view</u></a> instead!</div>

<div id="carousel"></div>

<div class="div center">
<?php
// Cards
// TODO: Check if the unit id exists, if not, assign random valid id
// TODO: Sort these by set / realm / level instead of id
require_once 'cards.php';
foreach ($creature_results as $r) {
	if ($r['id'] == $id) {
		$page_title = 'Ancient Beast - ' . $r['name'];
		?>
		<!-- Use unit name as page title -->
		<script>document.title = "<?php echo $page_title; ?>";</script>
		<?php
		cards($r);
		echo '<br>';
		progress($r['progress'], $r);
		// TODO: Add left and right arrow hotkeys
		// TODO: Add card flip eyecandy animation
		echo '</div>';
		//TODO: Fix Disqus page title
		disqus($page_title);
	}
}

// TODO: Show unit drop along with its modifiers
echo "</div>";
disqus($page_title);
