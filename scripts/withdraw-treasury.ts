/**
 * Sweep accrued house fees from the treasury to a wallet of your choice.
 * Must be signed by the treasury admin (the deployer / authority wallet).
 *
 * Usage:
 *   ANCHOR_PROVIDER_URL=$MAINNET_RPC \
 *   ANCHOR_WALLET=~/.config/solana/mainnet-authority.json \
 *     npx ts-node scripts/withdraw-treasury.ts <DESTINATION_WALLET> [AMOUNT_SOL]
 *
 *   - DESTINATION_WALLET: where the fees are sent (any pubkey you control).
 *   - AMOUNT_SOL (optional): how much to withdraw. Omit to sweep ALL available
 *     fees (everything above the rent-exempt minimum).
 *
 * Examples:
 *   npx ts-node scripts/withdraw-treasury.ts 9xQeW...yourWallet          # sweep all
 *   npx ts-node scripts/withdraw-treasury.ts 9xQeW...yourWallet 1.5      # withdraw 1.5 SOL
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NkYNEeX6eUiNrK89cHfNmZoigaUCdi5NLGKgRFJ77oZ");

(async () => {
  const destArg = process.argv[2];
  if (!destArg) {
    console.error("Usage: npx ts-node scripts/withdraw-treasury.ts <DESTINATION_WALLET> [AMOUNT_SOL]");
    process.exit(1);
  }
  const destination = new PublicKey(destArg);
  const amountSol = process.argv[3] ? parseFloat(process.argv[3]) : undefined;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = require("../app/idl/duelpvp.json");
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const [treasury] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], PROGRAM_ID);

  // Figure out how much is withdrawable (balance minus rent-exempt minimum).
  const conn = provider.connection;
  const balance = await conn.getBalance(treasury);
  const acctInfo = await conn.getAccountInfo(treasury);
  const rentMin = await conn.getMinimumBalanceForRentExemption(acctInfo!.data.length);
  const available = Math.max(balance - rentMin, 0);

  const lamports = amountSol !== undefined
    ? Math.round(amountSol * LAMPORTS_PER_SOL)
    : available;

  console.log("Treasury:   ", treasury.toBase58());
  console.log("Admin:      ", provider.wallet.publicKey.toBase58());
  console.log("Destination:", destination.toBase58());
  console.log("Balance:    ", balance / LAMPORTS_PER_SOL, "SOL");
  console.log("Withdrawable:", available / LAMPORTS_PER_SOL, "SOL (above rent)");
  console.log("Withdrawing:", lamports / LAMPORTS_PER_SOL, "SOL");

  if (lamports <= 0) {
    console.log("Nothing to withdraw.");
    return;
  }
  if (lamports > available) {
    console.error(`Requested ${lamports} lamports but only ${available} available above rent.`);
    process.exit(1);
  }

  const sig = await program.methods
    .withdrawTreasury(new BN(lamports))
    .accounts({ admin: provider.wallet.publicKey, treasury, destination })
    .rpc();

  console.log("\n✅ Swept fees. Tx:", sig);
  console.log("   solscan: https://solscan.io/tx/" + sig);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
