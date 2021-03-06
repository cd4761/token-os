import range from "lodash/range";

export function advanceBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_mine",
      id: Date.now(),
    }, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

export async function advanceManyBlock(n) {
  for (const _ of range(n)) {
    await advanceBlock();
  }
}

// Advances the block number so that the last mined block is `number`.
export default async function advanceToBlock(number) {
  if (web3.eth.blockNumber > number) {
    throw Error(`block number ${ number } is in the past (current is ${ web3.eth.blockNumber })`);
  }

  while (web3.eth.blockNumber < number) {
    await advanceBlock();
  }
}
