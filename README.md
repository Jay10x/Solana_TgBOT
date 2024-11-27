# Solana Swap Bot 🚀

A Telegram bot for swapping Solana tokens using Jupiter DEX. This bot allows users to check token balances, perform swaps, and get token price information directly through Telegram.

## Features
- Check wallet balances with USD values
- Swap tokens using Jupiter DEX aggregator
- View token prices and liquidity pools
- Support for SOL and SPL tokens
- Automatic price impact and slippage protection
- Token price information from DexScreener

## Prerequisites
- Node.js v16+
- Telegram Bot Token (from @BotFather)
- Solana Wallet Private Key
- Helius API Key (for RPC)

## Installation
1. Clone the repository:
```bash
git clone <repository-url>
cd solana-swap-bot
```
2. Install dependencies:
  ```bash
node app.js
```
3. Use your RPC Endpoint in swap.js and app.js

  
4. Available Commands:
/start - Display welcome message and available commands
/balance - Check wallet token balances
/swap [output_token] [amount] [slippage] [input_token] - Perform token swap
/info [token] - Get token price and liquidity information

NOTE: in the swap command, the amount represents to input token. For example, if you are buying USDC from SOL. you will put a command like this /swap {USDC_CONTRACT_ADDRESS} {AMOUNT_IN_SOLANA} {SLIPPAGE} 



## Technical Details
Built with Grammy.js for Telegram bot functionality
Uses @solana/web3.js for blockchain interactions
Jupiter DEX API for best swap routes
DexScreener API for token prices
Supports versioned transactions
Automatic SOL wrapping/unwrapping
Configuration
Default slippage: 10%
Default input token: SOL
RPC Node: Helius (mainnet)
Network: Solana Mainnet


## Security Notes
Never share your private keys
Keep your .env file secure
Monitor slippage settings
Review transactions before confirming

