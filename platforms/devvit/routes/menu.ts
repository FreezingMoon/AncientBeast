import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from './post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
	try {
		const post = await createPost();

		return c.json<UiResponse>(
			{
				navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
			},
			200,
		);
	} catch (error) {
		console.error(`Error creating post: ${error}`);
		return c.json<UiResponse>(
			{
				showToast: 'Failed to create Ancient Beast post',
			},
			400,
		);
	}
});
