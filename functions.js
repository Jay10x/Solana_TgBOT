const { Connection, Keypair, VersionedTransaction , PublicKey} = require('@solana/web3.js');

// function to get token decimals

const getTokenDecimals = async (mintAddress) => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const mintPublicKey = new PublicKey(mintAddress);
    const mintAccountInfo = await connection.getParsedAccountInfo(mintPublicKey);
    const decimal = mintAccountInfo.value.data.parsed.info.decimals;
    const decimals = 1 * Math.pow(10, decimal);
    
    return decimals;
};


module.exports = { getTokenDecimals };
