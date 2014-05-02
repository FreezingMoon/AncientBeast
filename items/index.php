<?php
$page_title = "Ancient Beast - Items";
$style = "
.fix {
	margin-bottom: -15px;
}
.item {
	text-align: center;
	width: 14%;
	vertical-align: top;
}
.stats{ padding: 0 4px; }";
require_once("../header.php");
require_once("../global.php");
require_once("../images/stats/index.php");


// Sorts the arrays by absolute value
function sortItems($a, $b)
{
	global $sortingArray;

	// For each critera
	for ($i=0; $i < count($sortingArray); $i++) {

		$sortIndex = $sortingArray[$i];

		if( $a[$sortIndex] == "" ){
			$a = $a["stats"];
			$b = $b["stats"];
		}

		// If same value continue to the next sorting critera
	    if ($a[$sortIndex] == $b[$sortIndex]) {
	        continue;
	    }

	    // Else determine what to do
	    return (abs($a[$sortIndex]) < abs($b[$sortIndex])) ? -1 : 1;
	}

    return 0;
}

function filterStat($var){
	global $statSelected;
	return ( $var["stats"][$statSelected] != "" );
}

// Get the SQL query order 
function getItems() {
	global $stats;
	global $statSelected;
	global $sortingArray;

	$data = json_decode(file_get_contents('items.json'), true);
	if( !isset($_GET['filter']) || !in_array( $_GET['filter'], array_keys($stats), true) ) {
		$sortingArray = array("value","type");
		uasort($data, "sortItems");
		$data = array_reverse($data);
	} else {
		$statSelected = $_GET['filter'];
		$sortingArray = array( $_GET['filter'] );
		$data = array_filter($data,"filterStat");
		uasort($data, "sortItems");
		$data = array_reverse($data);
	}

	return $data;
}

// Gathering Data
$data = getItems();

// Show filters
?>
<div class="div center"><table style="width: 100%;"><tr>
<?php
foreach($stats as $k => $x)
	displayStat($k,$statCount[$k],"index.php?filter=$k");
?>
</tr></table></div><div class="div">
<!-- grid view -->
<table style="width: 100%;"><tr>
<?php
$i = 0;
foreach ($data as $r) {
	$i++;
	echo "<td class=\"item\"><span style=\"cursor: pointer;\"><a href=\"#{$r['id']}\">
	<img class=\"fix lighten center\" src=\"sprites/" . rawurlencode($r['name']) . ".png\" style=\"display:block;\"><br>{$r['name']}</a></span></td>";
	if (($i % 6) == 0) echo '</tr><tr>';
}
?>
</tr></table></a></div>
<?php
//detailed view
foreach ($data as $r) {
	echo "<div class='div' id='{$r['id']}'>";
	echo "<table style='width: 100%; text-align:center;'>";
	echo "<tr><td style=\"width: 132px;\"><a href=\"#{$r['id']}\"><img src=\"sprites/" . rawurlencode($r['name']) . ".png\"></a></td>";
	echo "<td><table style='width: 100%; font-size:24px; text-align:left;'><tr>";
	echo "<td style='width: 40%;'><a href='#{$r['id']}'>{$r['name']}</a></td>";
	echo "<td style='width: 20%;'><a href='#'>{$r['value']}<img src='coins.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Gift<img src='gift.png'></a></td>";
	echo "<td style='width: 20%;'><a href='#'>Purchase<img src='purchase.png'></a></td>";
	echo "</tr></table><br><table style='text-align:center;'><tr>";

	foreach ($r['stats'] as $key => $value) {
		if($value) displayStat($key,$value);
	}
?>
	</tr></table></td></tr></table></div>
<?php
}

disqus();
include("../footer.php"); ?>
