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

function get_post($filename){
	$post_file = file_get_contents( 'entries/'.$filename );
	$post_lines = explode(PHP_EOL, $post_file);
	$variables = array( "post_date" => substr($filename, 0, 10) );
	$content = "";
	$variable_init = false;
	$variables_declared = false;
	foreach ($post_lines as $line){
		$line = explode("//", $line);
		$line = $line[0];
		if($line==""){ continue; }
		if($line=="~" && !$variable_init && !$variables_declared){
			$variable_init = true;
			continue;
		}
		if($line=="~" && $variable_init && !$variables_declared){
			$variable_init = false;
			$variables_declared = true;
			continue;
		}
		if($line!="~" && $variable_init){
			$var = explode(":",$line);
			$variables[$var[0]] = $var[1];
			continue;
		}
		if($variables_declared){
			$content .= $line.PHP_EOL;
			continue;
		}
	}
	return array( "post_content" => $content, "post_variables" => $variables);
}

function post_published($post){
	$post_vars = $post["post_variables"];
	return $post_vars["status"]=="PUBLISHED";
}

function view_post($post){
	$post_vars = $post["post_variables"];
	echo '<div class="blog_post_title"><b>'.$post_vars["title"].' - '.$post_vars["post_date"].'</b></div><br>';
	echo '<div class="blog_post_content">'.$post["post_content"].'</div>';
}


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

$page_title = "Ancient Beast - Blog - ";

$published_posts = 0;
foreach($blog_posts as $post){
	$post = get_post($post);
	$post_vars = $post["post_variables"];
	
	if($published_posts>=$offset && $published_posts<$post_count+$offset && $post_count==1){
		$page_title .= $post_vars["title"];
	}
	if(post_published($post)){
		$published_posts ++;
	}
}

require_once("../header.php");
require_once("../global.php");

start_segment();
$i = 0;
foreach($blog_posts as $post){
	$post = get_post($post);
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
end_segment();

start_segment();
echo '<div class="center" >';
if($offset-$post_count>=0){ echo '<a href="?off='.($offset-$post_count).'" >'.$prev_button.'</a>'; }
if($offset-$post_count>=0 && $offset+$post_count<$published_posts){ echo ' | '; }
if($offset+$post_count<$published_posts){ echo '<a href="?off='.($offset+$post_count).'" >'.$next_button.'</a>'; }
echo '<br>';
if($offset!=0){ echo '<a href="?off=0" >'.$latest_button.'</a>'; }
if($offset!=0 && $offset+$post_count!=$published_posts){ echo ' | '; }
if($offset+$post_count!=$published_posts){ echo ' <a href="?off='.($published_posts-1).'" >'.$oldest_button.'</a>'; }
echo '</div>';
end_segment();

start_segment();
include("../utils/disqus.php");
end_segment();

if($post_count==1){
	start_segment();
	echo '<div class="center" >';
	echo '<b>Blog Archive:</b><br><br>';
	echo '<div class="blog_archive_list" >';
	$i = 0;
	foreach($blog_posts as &$post){
		$post = get_post($post);
		if(post_published($post)){
			echo '<div class="blog_archive_list_item" >';
			$post_vars = $post["post_variables"];
			echo '<a href="?off='.$i.'" >'.$post_vars["post_date"].' - '.$post_vars["title"].'</a>';
			echo '</div>';
			$i++;
		}
	}
	echo '</div>';
	echo '</div>';
	end_segment();
}

end_page(); ?>




