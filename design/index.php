<?php

// Display default or selected page
$view = isset($_GET['view']) ? $_GET['view'] : 'default';

// Set page title
$page_title = ucfirst($view);

require_once "../header.php";

// Display list of subpages
$sections = array(
	'info',
	'input',
	'combat',
	'arcade',
	'tournament',
	'kingdom'
);
echo '<div class="center warning">The game design documentation is currently a very rough early draft and it requires a few more writing sessions.</div>';
echo '<nav class="div center" id="navigation"><ul class="sections">';
foreach ($sections as &$sectionItem) {
	echo '<li style="display: inline;"><a href="?view=' . $sectionItem . '"  id="' . $sectionItem . '" style="padding: 2em;">' . ucfirst($sectionItem) . '</a></li>';
}
echo '</ul></nav>';

// This div serves as an anchor
echo '<div id="focus"></div>';

switch ($view) {
	default:
		?>
		<script>/* Custom page title */ document.title = "Ancient Beast - This is my design";</script>

		<div class="center">
			<div style="display: inline-block;" class="lighten">
				<a href="?view=info"><img src="<?php echo $site_root; ?>images/squares/info.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Project Info</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=combat"><img src="<?php echo $site_root; ?>images/squares/combat.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Combat Details</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=input"><img src="<?php echo $site_root; ?>images/squares/input.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Input Methods</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=arcade"><img src="<?php echo $site_root; ?>images/squares/arcade.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Arcade Mode</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=tournament"><img src="<?php echo $site_root; ?>images/squares/tournament.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Monthly Tournament</div></a>
			</div>
			<div style="display: inline-block;" class="lighten">
				<a href="?view=kingdom"><img src="<?php echo $site_root; ?>images/squares/kingdom.jpg" class="frame"><br>
				<div class="button" style="background-image: url(<?php echo $site_root; ?>images/push_button.png);">Kingdom Wars</div></a>
			</div>
		</div>
		
		<?php
		break;

	case 'info':
		include 'info.php';
		break;

	case 'input':
		include 'input.php';
		break;

	case 'combat':
		include 'combat.php';
		break;

	case 'arcade':
		include 'arcade.php';
		break;

	case 'tournament':
		include 'tournament.php';
		break;

	case 'kingdom':
		include 'kingdom.php';
}
?>

<?php include("../footer.php"); ?>

<!-- Highlight active subpage -->
<script>document.getElementById("<?php echo $view; ?>").className += " active";</script>

<!-- Focus on content when clicking subpage again -->
<script>document.getElementById("<?php echo $view; ?>").href += "#focus";</script>
