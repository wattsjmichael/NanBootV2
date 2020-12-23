'use strict';

/**
 * This script interfaces with AWS.LexRuntime.
 * References https://docs.sumerian.amazonaws.com/articles/concierge-experience/
 */

function setup(args, ctx) {
	const settings = {
		botAlias: args.botAlias,
		botName: args.botName
	}

	ctx.settings = validateLexSettings(settings);

	// If your AWS Region doesn't support Amazon Lex, you may need to configure the Region like the following:
	// lex = new AWS.LexRuntime({region: 'us-east-1'});
	// See the Amazon Lex supported Regions: https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/
	let lex = null;
	sumerian.SystemBus.addListener('aws.sdkReady', () => {
		lex = new AWS.LexRuntime();
	}, true);

	const lexParams = {
		botAlias: ctx.settings.botAlias,
		botName: ctx.settings.botName,
		contentType: 'audio/x-l16; rate=16000',
		userId: 'testId',
	}

	/**
	 * Sends request to Amazon Lex with audio or text input.
	 * Emits scene.lexResponseEvent event if Amazon Lex comes back with a successful response.
	 * @param {Blob | string} [data] Microphone recording (Blob) or string of text to send to Amazon Lex.
	 */
	ctx.onQueryLex = (data) => {

		lexParams.inputStream = data;


		if (data instanceof Blob) {
			lexParams.contentType = 'audio/x-l16; rate=16000';
		} else {
			lexParams.contentType = 'text/plain; charset=utf-8';
		}

		lex.postContent(lexParams, (err, data) => {
			if (err) {
				throw new Error(`Error sending query to Amazon Lex: ${err.name}. ${err.message}`);
			} else {
				sumerian.SystemBus.emit("scene.lexResponseEvent", data);
			}
		});
	}

	sumerian.SystemBus.addListener("scene.lexQueryEvent", ctx.onQueryLex);
};

function cleanup(args, ctx) {
	sumerian.SystemBus.removeListener("scene.lexQueryEvent", ctx.onQueryLex);
};

	/**
	 * Validates user input for Amazon Lex.
	 * Uses $LATEST bot if the bot alias is not provided.
	 * @param {Object} [settings] Amazon Lex conversation bot settings.
	 */
function validateLexSettings(settings) {
	if (settings.botAlias === '') {
		console.log("Using the latest bot.");
		settings.botAlias = "$LATEST";
	}

	if (settings.botName === '') {
		throw new Error("Please provide a Lex bot name.");
	}

	return settings;
}

var parameters = [
	{
		name: 'Bot alias',
		key: 'botAlias',
		type: 'string',
		description: "Amazon Lex bot alias."

	},
	{
		name: "Bot Name",
		key: 'botName',
		type: 'string',
		description: "Amazon Lex bot name."
	}
];