/**
 * Solana Swap Bot
 * A Telegram bot for swapping Solana tokens using Jupiter DEX
 */

// =============== LIBRARY IMPORTS ===============
// Telegram Bot Framework
const {Bot,Keyboard, session, HttpError ,InlineKeyboard, InlineQueryResultBuilder } = require('grammy');
const { conversations } = require('@grammyjs/conversations')
const { hydrateReply, parseMode } = require("@grammyjs/parse-mode");



// Solana Libraries
const { Connection, Keypair, VersionedTransaction , PublicKey} = require('@solana/web3.js');
const { Wallet } = require('@project-serum/anchor');

// Utility Libraries
const fetch = require('cross-fetch');
const bs58 = require('bs58');

// Local Imports
const {swapToken} = require('./swap.js');
const {getTokenDecimals} = require('./functions.js');

// Load environment variables from .env file ( to keep private keys and tokens safe)
require('dotenv').config();


// =============== BOT INITIALIZATION ===============
/**
 * Initialize Telegram bot with token from environment variables
 * Bot token should be set in .env file as TELEGRAM_BOT_TOKEN
 */

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);


// Enable HTML/Markdown message formatting support while sending messages
bot.use(hydrateReply);



// =============== COMMAND HANDLERS ===============
/**
 * Handle /start command
 * Displays welcome message and available commands to new users
 */

bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to Solana Swap Bot! 🚀\n\n" +
        "Here are some commands to get you started:\n\n" +
        "/balance - Check your wallet balance\n" +
        "/swap - Start a new swap\n" +
        "/price [token] - Get the current price of a token\n\n" +
        "Happy Trading!");
});

/**
 * Handle /balance command
 * Fetches and displays token balances for connected wallet
 * Shows token amounts and their USD values using DexScreener API
 */
bot.command("balance", async (ctx) => {
    try {
        // Initialize Solana connection to mainnet
        const connection = new Connection('https://api.mainnet-beta.solana.com');
        
        // Convert private key from base58 string to Uint8Array format
        var PRIVATE_KEY_ARRAY = bs58.default.decode(process.env.PRIVATE_KEY);
        
        // Generate public key from private key for wallet identification
        const publicKey = Keypair.fromSecretKey(PRIVATE_KEY_ARRAY).publicKey;
        
        // Fetch all SPL tokens owned by this wallet
        // TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA is Solana's Token Program ID
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        });

        // Build response message showing balances
        let balanceMessage = "Wallet Balances:\n";

        // Loop through each token account
        for (const {account} of tokenAccounts.value) {
            // Extract token amount and contract address
            const tokenAmount = account.data.parsed.info.tokenAmount.uiAmount;
            const mintAddress = account.data.parsed.info.mint;

            // Fetch current token price from DexScreener API
            const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
            const result = await fetch(apiUrl);
            const data = await result.json();

            // If price data exists, add token to balance message
            if (data.pairs) {
                const tokenSymbol = data.pairs[0].baseToken.symbol;
                const priceInUsdt = parseFloat(data.pairs[0].priceUsd);
                
                // Format balance entry with token name, amount and USD value
                balanceMessage += `Token: <a href="https://solscan.io/token/${mintAddress}">${tokenSymbol}</a>\n` +
                    `Balance: ${tokenAmount}\n` +
                    `Value: $${(tokenAmount * priceInUsdt).toFixed(4)}\n\n`;
            }
        }

        // Send formatted balance message
        await ctx.replyWithHTML(balanceMessage);

    } catch (error) {
        console.error('Error fetching wallet balances:', error);
        await ctx.reply('Sorry, there was an error fetching the wallet balances. Please try again later.');
    }
});

/**
 * Handle /swap command
 * Format: /swap [output_token] [amount] [slippage] [input_token]
 * Defaults: slippage=10%, input_token=SOL
 */
bot.command("swap", async (ctx) => {
    // Parse command parameters
    var outputToken = ctx.message.text.split(" ")[1];  // Token to receive
    var amount_input = ctx.message.text.split(" ")[2]; // Amount to swap
    var slippage = ctx.message.text.split(" ")[3] || 10;  // Slippage tolerance (default 10%)
    var inputToken = ctx.message.text.split(" ")[4] || "So11111111111111111111111111111111111111112"; // Token to send (default SOL)
    
    if (!outputToken || !amount_input) {
        await ctx.reply("Please provide a valid swap query. Example: /swap [contract_address ( buying token)] [amount_in_sol] [slippage - default: 10%] [inputToken - default: SOL]");
        return;
    }

    // conversion ( conver amount in decimals )
    var decimals_inputToken = await getTokenDecimals(inputToken);
    var decimals_outputToken = await getTokenDecimals(outputToken);

    var amount_in_decimals = amount_input * decimals_inputToken; // converting to lamports
    var slippageBps = slippage * 100; // converting to bps

    try {
        // Construct the API URL with the provided contract address
        const apiUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputToken}&outputMint=${outputToken}&amount=${amount_in_decimals}&slippageBps=${slippageBps}`; // amount here is given in lamports (1 SOL)
        
        // Fetch data from Jupiter API
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.error) {
            await ctx.reply(`Error: Something went wrong.`);
            console.log("API Error:", data.error);
            return;
        }

        // Calculate price and format response
        const inAmount = data.inAmount / decimals_inputToken; // Convert from decimals to token_amount
        const outAmount = data.outAmount / decimals_outputToken; // dividing by decimals of output token
        const price = outAmount / inAmount;
        const priceImpact = parseFloat(data.priceImpactPct).toFixed(2);
        const slippage = data.slippageBps / 100;
        const minAmountToBeReceived = data.otherAmountThreshold / decimals_outputToken; // Assuming USDC decimals
        const FromToken = data.inputMint;
        const ToToken = data.outputMint;


      

        // Create an inline keyboard with a button to excute the swap when clicked
        const keyboard = new InlineKeyboard()
            .text("Confirm Swap", `swap_${amount_in_decimals}_${slippageBps}`);

        // Send message with the inline keyboard
        await ctx.replyWithHTML(`🔄️ Swap details:\n` +
            `▫️<b>Input:</b> ${inAmount} Tokens\n` +
            `▫️<b>Output:</b>  ${outAmount} Tokens\n` +
            `▪️<b>Price:</b>  ${price.toFixed(7)}\n` +
            `▪️<b>Price Impact:</b>  ${priceImpact}%\n` +
            `▫️<b>Slippage:</b>  ${slippage.toFixed(2)}%\n` +
            `▫️<b>Minimum amount to be received:</b>  ${minAmountToBeReceived} \n` +
            ' \n' +
            `▪️<b> From Token:</b>  ${FromToken}\n` +
            `▪️<b> To Token:</b>  ${ToToken}`, 
            { 
                parse_mode: 'HTML',
                reply_markup: keyboard 
            }
        );



    } catch (error) {
        console.error('API Error:', error);
        await ctx.reply('Sorry, there was an error fetching the price. Please try again later.');
    }

    
});




// To get the price and other details of a token i.e. liquidity pools.
bot.command("info", async (ctx) => {
    const token = ctx.message.text.split(" ")[1];
    if (!token) {
        await ctx.reply("Please provide a token address");
        return;
    }

    try {
        const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${token}`;
        const response = await fetch(apiUrl);
        const data = await response.json();


        if (data.pairs && data.pairs.length > 0) {
            // Sort pairs by volume
            const sortedPairs = data.pairs.sort((a, b) => 
                parseFloat(b.volume.h24) - parseFloat(a.volume.h24)
            );
           
        
            let message = `🔍 Token Details for ${sortedPairs[0].baseToken.name } (${sortedPairs[0].baseToken.symbol })\n\n`;
        
            // Loop through each pair (pool)
            for (let i = 0; i < Math.min(sortedPairs.length, 5); i++) {
                const pair = sortedPairs[i];
                
                // Format price and volume 
                const price = parseFloat(pair.priceUsd).toFixed(6);
                const volume24h = parseFloat(pair.volume.h24).toFixed(2);
                const liquidity = parseFloat(pair.liquidity.usd).toFixed(2);
        
                message += `📊 <b>DEX:</b> ${pair.dexId}\n`;
                message += `💰 <b>Price:</b> $${price}\n`;
                message += `📈 <b>24h Volume:</b> $${volume24h}\n`;
                message += `💧 <b>Liquidity:</b> $${liquidity}\n`;
                message += `🔗 <a href="https://dexscreener.com/solana/${pair.pairAddress}">View Pool</a>\n\n`;
            }
           console.log(message);
            await ctx.reply(message, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
            });
        } else {
            await ctx.reply("No trading pools found for this token");
        }










    } catch (error) {
        console.error('API Error:', error);
        await ctx.reply('Sorry, there was an error fetching the token info.');
    }
});










// listen for inline keyboard button press


bot.on("callback_query", async (ctx) => {
    try {
        const [action, amt, slip] = ctx.callbackQuery.data.split('_');

        // Verify if the inline button press is for a swap operation
        if (action !== 'swap') {
            await ctx.answerCallbackQuery("Invalid operation");
            return;
        }

        const messageText = ctx.callbackQuery.message.text;

        const fromTokenMatch = messageText.match(/From Token:  ([^\n]+)/)[1]; // input
        const toTokenMatch = messageText.match(/To Token:  ([^\n]+)/)[1]; // output

       


        // // Acknowledge the button press
        await ctx.answerCallbackQuery("Processing swap...");
        
        // Update original message to show processing
        await ctx.editMessageText(`🔄 Processing swap transaction...\n\n▫️<b>Amount:</b> ${amt} \n▫️<b>Slippage:</b> ${slip }% \n▫️<b>From Token:</b> ${fromTokenMatch} \n▫️<b>To Token:</b> ${toTokenMatch} `, {
            chat_id: ctx.callbackQuery.message.chat.id,
            message_id: ctx.callbackQuery.message.message_id,
            parse_mode: 'HTML',
            reply_markup: undefined // Remove the inline keyboard
        });

         
        // Execute the swap operation
        const result = await swapToken(amt,fromTokenMatch,toTokenMatch, slip).catch(error => {
            console.error('Swap Error:', error);
            return { status: 'error', message: 'Error processing swap' };
        });
        
        // Check the result of the swap operation and send a message to the user.
        if(result.status === 'success') {
            await ctx.reply(`Success! Trasaction link: ${result.message}`);
        }

        else if(result.status === 'error') {
            await ctx.reply("Sorry, Something went wrong processing swap.");
        }
        else{
            await ctx.reply("Sorry, there was an error processing your swap request.");
        }


        

    } catch (error) {
        console.error('Callback Error:', error);
        await ctx.answerCallbackQuery("Error processing swap");
        await ctx.reply("Sorry, there was an error processing your swap request.");
    }
});




// Basic error handler
bot.catch((err) => {
    console.error("Bot error:", err);
});

// Start the bot
console.log("Bot is starting...");
bot.start();
