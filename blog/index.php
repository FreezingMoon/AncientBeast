<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

require_once("functions.php");

$post_count = 1;
$next_button = "next ->";
$prev_button = "<- previous";
$latest_button = "<-- latest";
$oldest_button = "oldest -->";

if($_GET['off']){
	$offset = intval($_GET['off']);
}else{
	$offset = 0;
}
$blog_posts = array();
if ($handle = opendir('entries')) {
	while (false !== ($entry = readdir($handle))) {
		if ($entry != "." && $entry != ".." && $entry != ".DS_Store") {
			array_unshift($blog_posts, $entry);
		}
	}
	closedir($handle);
	array_multisort($blog_posts,SORT_DESC);
}

$page_title = "Ancient Beast - Blog";

$published_posts = 0;
foreach($blog_posts as $post){
	$post = get_post($post,'entries/');
	$post_vars = $post["post_variables"];
	
	if($published_posts>=$offset && $published_posts<$post_count+$offset && $post_count==1){
		$page_title .= ' - '.$post_vars["title"];
	}
	if(post_published($post)){
		$published_posts ++;
	}
}

require_once("../header.php");
require_once("../global.php");
?>
<div class="div center">
<?php
$i = 0;
foreach($blog_posts as $post){
	$post = get_post($post,'entries/');
	if($i>=$offset && $i<$post_count+$offset){
		if(post_published($post)){
			if($i!=$post_count+$offset-1){ end_segment(); start_segment(); }
			echo '<div class="center" >';
			view_post($post);
			echo '</div>';
		}
	}else if($i>=$post_count+$offset){
		break;
	}
	if(post_published($post)){
		$i+=1;
	}
}
?>
</div>
<div class="div center">
<?php
if($offset-$post_count>=0){ echo '<a href="?off='.($offset-$post_count).'" >'.$prev_button.'</a>'; }
if($offset-$post_count>=0 && $offset+$post_count<$published_posts){ echo ' | '; }
if($offset+$post_count<$published_posts){ echo '<a href="?off='.($offset+$post_count).'" >'.$next_button.'</a>'; }
echo '<br>';
if($offset!=0){ echo '<a href="?off=0" >'.$latest_button.'</a>'; }
if($offset!=0 && $offset+$post_count!=$published_posts){ echo ' | '; }
if($offset+$post_count!=$published_posts){ echo ' <a href="?off='.($published_posts-1).'" >'.$oldest_button.'</a>'; }
?>
</div>

<?php disqus();

if($post_count==1){
?>
	<div class="div center">
	<b>Blog Archive:</b><br><br>
	<div class="blog_archive_list" >
	<?php
	$i = 0;
	foreach($blog_posts as &$post){
		$post = get_post($post,'entries/');
		if(post_published($post)){
			echo '<div class="blog_archive_list_item" >';
			$post_vars = $post["post_variables"];
			echo '<a href="?off='.$i.'" >'.$post_vars["post_date"].' - '.$post_vars["title"].'</a>';
			echo '</div>';
			$i++;
		}
	}
?>
</div></div></div>
<?php
}
disqus();
include('../footer.php'); ?>
