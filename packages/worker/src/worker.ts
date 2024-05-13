import TelegramExecutionContext from '../../main/src/ctx';
import TelegramBot from '../../main/src/telegram_bot';

export interface Environment {
	SECRET_TELEGRAM_API_TOKEN: string;
	KV_GET_SET: KVNamespace;
	KV_UID_DATA: KVNamespace;

	SECRET_TELEGRAM_API_TOKEN2: string;

	SECRET_TELEGRAM_API_TOKEN3: string;

	SECRET_TELEGRAM_API_TOKEN4: string;

	SECRET_TELEGRAM_API_TOKEN5: string;

	AI: Ai;

	DB: D1Database;

	R2: R2Bucket;

	CHAT_MODEL: string;
}

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	fetch: async (request: Request, env: Environment, ctx: ExecutionContext) => {
		const bot = new TelegramBot(env.SECRET_TELEGRAM_API_TOKEN);
		const bot2 = new TelegramBot(env.SECRET_TELEGRAM_API_TOKEN2);
		const bot3 = new TelegramBot(env.SECRET_TELEGRAM_API_TOKEN3);
		await Promise.all([
			bot
				.on('clear', async function (ctx: TelegramExecutionContext) {
					switch (ctx.update_type) {
						case 'message':
							await env.DB.prepare('DELETE FROM Messages WHERE userId=?')
								.bind(ctx.update.inline_query ? ctx.update.inline_query.from.id : ctx.update.message?.from.id)
								.run();
							await ctx.reply('history cleared');
							break;

						default:
							break;
					}
					return new Response('ok');
				})
				.on('default', async function (ctx: TelegramExecutionContext) {
					switch (ctx.update_type) {
						case 'message': {
							const prompt = ctx.update.message?.text?.toString() ?? '';
							const { results } = await env.DB.prepare('SELECT * FROM Messages WHERE userId=?')
								.bind(ctx.update.inline_query ? ctx.update.inline_query.from.id : ctx.update.message?.from.id)
								.all();
							const message_history = results.map((col) => ({ role: 'system', content: col.content as string }));
							const messages = [
								...message_history,
								{
									role: 'user',
									content: prompt,
								},
							];
							const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages });
							if ('response' in response) {
								await ctx.reply(response.response ?? '');
							}
							await env.DB.prepare('INSERT INTO Messages (id, userId, content) VALUES (?, ?, ?)')
								.bind(
									crypto.randomUUID(),
									ctx.update.inline_query ? ctx.update.inline_query.from.id : ctx.update.message?.from.id,
									'[INST] ' + prompt + ' [/INST]' + '\n' + response,
								)
								.run();
							break;
						}
						case 'inline': {
							const inline_messages = [
								{ role: 'system', content: 'You are a friendly assistant' },
								{
									role: 'user',
									content: ctx.update.inline_query?.query.toString() ?? '',
								},
							];
							const inline_response = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: inline_messages, max_tokens: 50 });
							if ('response' in inline_response) {
								await ctx.reply(inline_response.response ?? '');
							}
							break;
						}

						default:
							break;
					}
					return new Response('ok');
				})
				.handle(request.clone()),
			bot2
				.on('default', async function (ctx: TelegramExecutionContext) {
					switch (bot2.update_type) {
						case 'message': {
							await ctx.reply('https://duckduckgo.com/?q=' + encodeURIComponent(ctx.update.message?.text?.toString() ?? ''));
							break;
						}
						case 'inline': {
							await ctx.reply('https://duckduckgo.com/?q=' + encodeURIComponent(ctx.update.inline_query?.query ?? ''));
							break;
						}

						default:
							break;
					}
					return new Response('ok');
				})
				.handle(request.clone()),
			bot3
				.on('default', async function (ctx: TelegramExecutionContext) {
					switch (bot3.update_type) {
						case 'inline': {
							const translated_text = await fetch(
								'https://clients5.google.com/translate_a/t?client=at&sl=auto&tl=en&q=' +
									encodeURIComponent(bot3.update.inline_query?.query.toString() ?? ''),
							)
								.then((r) => r.json())
								.then((json) => (json as [string[]])[0].slice(0, -1).join(' '));
							await ctx.reply(translated_text ?? '');
							break;
						}

						default:
							break;
					}

					return new Response('ok');
				})
				.handle(request.clone()),
		]);

		return new Response('ok');
	},
};
