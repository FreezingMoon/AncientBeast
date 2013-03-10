<?php

function get_post($filename, $entries_root){
	$post_file = file_get_contents( $entries_root.$filename );
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

?>
