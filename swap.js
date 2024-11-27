const { Connection, Keypair, VersionedTransaction } = require('@solana/web3.js');
const fetch = require('cross-fetch');
const { Wallet } = require('@project-serum/anchor');
const bs58 = require('bs58');
require('dotenv').config();


// It is recommended that you use your own RPC endpoint.
// get your own RPC endpoint from https://www.helius.dev/ , or you can use https://api.mainnet-beta.solana.com ( often it don't work due to high usage )
const connection = new Connection('YOUR_RPC_ENDPOINT');


var PRIVATE_KEY_ARRAY = bs58.default.decode(process.env.PRIVATE_KEY); // converting base58 private key to Uint8Array.

const wallet = new Wallet(Keypair.fromSecretKey(PRIVATE_KEY_ARRAY));

 

async function swapToken(amount, inputToken , outputToken , slippage){


const quoteResponse = await (
  await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputToken}&outputMint=${outputToken}&amount=${amount}&slippageBps=${slippage}`)
).json();


if (!quoteResponse) {
  

 console.log('No routes found for the given token pair.');
return { status: 'error', message: 'No routes found for the given token pair.' };
}

// get serialized transactions for the swap
const { swapTransaction } = await (
  await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // quoteResponse from /quote api
      quoteResponse,
      // user public key to be used for the swap
      userPublicKey: wallet.publicKey.toString(),
      // auto wrap and unwrap SOL. default is true
      wrapAndUnwrapSol: true,
      // custom priority fee
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 2000000,
          global: false,
          priorityLevel: "veryHigh" // veryHigh to buy immediately
        }}



    })
  })
).json();

// deserialize the transaction
const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
var transaction = VersionedTransaction.deserialize(swapTransactionBuf);


// sign the transaction
transaction.sign([wallet.payer]);

// Execute the transaction
const rawTransaction = transaction.serialize()
const txid = await connection.sendRawTransaction(rawTransaction, {
  skipPreflight: true,
  maxRetries: 2
  // computeUnitPrice: 1000, // Lower compute unit price (default is higher)
  // computeUnitsLimit: 200000 // Limit compute units (default can be higher)

});

await connection.confirmTransaction({
    signature: txid,
    commitment: 'confirmed'
  });
  
console.log(`https://solscan.io/tx/${txid}`);
return { status: 'success', message: `https://solscan.io/tx/${txid}` };

}



module.exports = {swapToken}; // export the function to be used in the main file
